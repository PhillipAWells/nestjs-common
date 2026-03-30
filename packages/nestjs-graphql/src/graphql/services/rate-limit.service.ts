declare global {
	namespace NodeJS {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		interface Timeout {}
	}
}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const DEFAULT_RATE_LIMIT_WINDOW_MINUTES = 15;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100;
const CLEANUP_INTERVAL_MS = 60_000;

/**
 * Rate limit result interface
 */
export interface IRateLimitResult {
	allowed: boolean;
	remaining: number;
	limit: number;
	resetTime: number;
	current?: number; // Added for enhanced result
}

/**
 * Rate limit configuration
 */
export interface IRateLimitConfig {
	windowMs: number; // Time window in milliseconds
	maxRequests: number; // Maximum requests per window
}

/**
 * Storage backend interface for rate limiting
 */
export interface IRateLimitStorage {
	increment(key: string, windowMs: number): Promise<number>;
	get(key: string): Promise<number>;
	reset(key: string): Promise<void>;
	cleanup(): Promise<void>;
}

/**
 * In-memory rate limit store entry
 */
interface IRateLimitEntry {
	count: number;
	resetTime: number;
}

/**
 * In-memory storage implementation
 */
@Injectable()
export class MemoryRateLimitStorage implements IRateLimitStorage {
	private readonly Storage = new Map<string, { count: number; resetTime: number }>();

	// eslint-disable-next-line require-await
	public async increment(key: string, windowMs: number): Promise<number> {
		const now = Date.now();
		const entry = this.Storage.get(key);

		if (!entry || now > entry.resetTime) {
			// Create new entry
			const resetTime = now + windowMs;
			this.Storage.set(key, { count: 1, resetTime });
			return 1;
		} else {
			// Increment existing entry
			entry.count++;
			this.Storage.set(key, entry);
			return entry.count;
		}
	}

	// eslint-disable-next-line require-await
	public async get(key: string): Promise<number> {
		const entry = this.Storage.get(key);
		const now = Date.now();

		if (!entry || now > entry.resetTime) {
			return 0;
		}

		return entry.count;
	}

	// eslint-disable-next-line require-await
	public async reset(key: string): Promise<void> {
		this.Storage.delete(key);
	}

	// eslint-disable-next-line require-await
	public async cleanup(): Promise<void> {
		const now = Date.now();
		for (const [key, entry] of this.Storage.entries()) {
			if (now > entry.resetTime) {
				this.Storage.delete(key);
			}
		}
	}
}

/**
 * GraphQL Rate Limit Service
 *
 * Implements sliding window rate limiting with configurable storage backends.
 * Supports both in-memory and external storage (Redis, etc.) for distributed rate limiting.
 * Tracks requests per client identifier and enforces configurable limits.
 *
 * @example
 * ```typescript
 * const result = await rateLimitService.checkLimit('user:123');
 * if (!result.allowed) {
 *   throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
 * }
 * ```
 */
@Injectable()
export class RateLimitService implements OnModuleInit, OnModuleDestroy, ILazyModuleRefService {
	public readonly Module: ModuleRef;
	private readonly Store = new Map<string, IRateLimitEntry>();

	// eslint-disable-next-line no-undef
	private CleanupInterval?: NodeJS.Timeout;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get Logger(): AppLogger {
		return this.AppLogger.createContextualLogger(RateLimitService.name);
	}

	private get Storage(): IRateLimitStorage | undefined {
		try {
			return this.Module.get<IRateLimitStorage>('RATE_LIMIT_STORAGE', { strict: false });
		} catch {
			return undefined;
		}
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
	 * Default rate limit configuration
	 * 100 requests per 15 minutes
	 */
	private readonly DefaultConfig: IRateLimitConfig = {
		windowMs: DEFAULT_RATE_LIMIT_WINDOW_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND, // 15 minutes
		maxRequests: DEFAULT_RATE_LIMIT_MAX_REQUESTS,
	};

	/**
	 * Custom configurations per operation type
	 */
	private readonly OperationConfigs = new Map<string, IRateLimitConfig>();

	public onModuleInit(): void {
		// Start cleanup interval to remove expired entries
		this.CleanupInterval = setInterval(async () => {
			await this.cleanup();
		}, CLEANUP_INTERVAL_MS); // Clean up every minute

		this.Logger.info('Rate limit service initialized');
	}

	public onModuleDestroy(): void {
		if (this.CleanupInterval) {
			clearInterval(this.CleanupInterval);
		}
		this.Logger.info('Rate limit service destroyed');
	}

	/**
	 * Checks if a client is within rate limits
	 *
	 * @param clientId - Unique client identifier (user ID or IP)
	 * @param operation - Optional operation name for custom limits
	 * @returns Promise<IRateLimitResult> - Rate limit check result
	 */
	// eslint-disable-next-line require-await
	public async checkLimit(clientId: string, operation?: string): Promise<IRateLimitResult> {
		const config = operation ? this.getConfigForOperation(operation) : this.DefaultConfig;

		// Use storage backend if available, otherwise fall back to in-memory
		const { Storage } = this;
		if (Storage) {
			return this.checkLimitWithStorage(clientId, config, Storage);
		} else {
			return this.checkLimitInMemory(clientId, config);
		}
	}

	/**
	 * Check rate limit using storage backend
	 */
	private async checkLimitWithStorage(clientId: string, config: IRateLimitConfig, storage: IRateLimitStorage): Promise<IRateLimitResult> {
		try {
			const current = await storage.increment(clientId, config.windowMs);
			const remaining = Math.max(0, config.maxRequests - current);
			const allowed = current <= config.maxRequests;

			return {
				allowed,
				remaining,
				limit: config.maxRequests,
				resetTime: Date.now() + config.windowMs,
				current,
			};
		} catch (error) {
			this.Logger.error(`Storage rate limit check failed for ${clientId}:`, getErrorMessage(error));
			// Fall back to in-memory on storage error
			return this.checkLimitInMemory(clientId, config);
		}
	}

	/**
	 * Check rate limit using in-memory storage (legacy implementation)
	 */
	private checkLimitInMemory(clientId: string, config: IRateLimitConfig): IRateLimitResult {
		const now = Date.now();

		let entry = this.Store.get(clientId);

		if (!entry || now > entry.resetTime) {
			// Create new entry or reset expired entry
			entry = {
				count: 0,
				resetTime: now + config.windowMs,
			};
		}

		const allowed = entry.count < config.maxRequests;

		if (allowed) {
			entry.count++;
			this.Store.set(clientId, entry);
		}

		const remaining = Math.max(0, config.maxRequests - entry.count);

		return {
			allowed,
			remaining,
			limit: config.maxRequests,
			resetTime: entry.resetTime,
			current: entry.count,
		};
	}

	/**
	 * Sets custom rate limit configuration for a specific operation
	 *
	 * @param operation - Operation name (e.g., 'query', 'mutation')
	 * @param config - Rate limit configuration
	 */
	public setOperationConfig(operation: string, config: IRateLimitConfig): void {
		this.OperationConfigs.set(operation, config);
		this.Logger.info(`Set custom rate limit for operation '${operation}': ${config.maxRequests} requests per ${config.windowMs}ms`);
	}

	/**
	 * Gets rate limit configuration for an operation
	 *
	 * @param operation - Operation name
	 * @returns IRateLimitConfig - Configuration for the operation
	 */
	private getConfigForOperation(operation: string): IRateLimitConfig {
		return this.OperationConfigs.get(operation) ?? this.DefaultConfig;
	}

	/**
	 * Manually resets rate limit for a client
	 *
	 * @param clientId - Client identifier to reset
	 */
	public async resetLimit(clientId: string): Promise<void> {
		this.Store.delete(clientId);
		// Also reset in storage backend if available
		if (this.Storage) {
			try {
				await this.Storage.reset(clientId);
			} catch (error) {
				this.Logger.error(`Failed to reset rate limit in storage for ${clientId}:`, getErrorMessage(error));
			}
		}
		this.Logger.info(`Reset rate limit for client: ${clientId}`);
	}

	/**
	 * Gets current rate limit status for a client
	 *
	 * @param clientId - Client identifier
	 * @param operation - Optional operation name
	 * @returns IRateLimitResult | null - Current status or null if no record
	 */
	public async getStatus(clientId: string, operation?: string): Promise<IRateLimitResult | null> {
		const config = operation ? this.getConfigForOperation(operation) : this.DefaultConfig;

		// Check storage backend first if available
		if (this.Storage) {
			try {
				const count = await this.Storage.get(clientId);
				if (count > 0) {
					const remaining = Math.max(0, config.maxRequests - count);
					return {
						allowed: count < config.maxRequests,
						remaining,
						limit: config.maxRequests,
						resetTime: Date.now() + config.windowMs,
						current: count,
					};
				}
			} catch (error) {
				this.Logger.error(`Storage status check failed for ${clientId}:`, getErrorMessage(error));
				// Fall back to in-memory
			}
		}

		// Fall back to in-memory store
		const entry = this.Store.get(clientId);

		if (!entry) {
			return null;
		}

		const now = Date.now();
		const remaining = Math.max(0, config.maxRequests - entry.count);

		return {
			allowed: entry.count < config.maxRequests && now <= entry.resetTime,
			remaining,
			limit: config.maxRequests,
			resetTime: entry.resetTime,
		};
	}

	/**
	 * Cleans up expired rate limit entries
	 */
	private async cleanup(): Promise<void> {
		// Clean up storage backend if available
		const { Storage } = this;
		if (Storage) {
			try {
				await Storage.cleanup();
			} catch (error) {
				this.Logger.error('Storage cleanup failed:', getErrorMessage(error));
			}
		}

		// Clean up in-memory store
		const now = Date.now();
		let cleaned = 0;

		for (const [clientId, entry] of this.Store.entries()) {
			if (now > entry.resetTime) {
				this.Store.delete(clientId);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			this.Logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
		}
	}

	/**
	 * Gets statistics about the rate limit store
	 *
	 * @returns Object with store statistics
	 */
	public getStats(): { totalEntries: number; operationConfigs: number } {
		return {
			totalEntries: this.Store.size,
			operationConfigs: this.OperationConfigs.size,
		};
	}
}
