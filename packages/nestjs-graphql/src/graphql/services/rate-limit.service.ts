declare global {
	namespace NodeJS {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		interface Timeout {}
	}
}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
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
	Increment(key: string, windowMs: number): Promise<number>;
	Get(key: string): Promise<number>;
	Reset(key: string): Promise<void>;
	Cleanup(): Promise<void>;
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
	public async Increment(key: string, windowMs: number): Promise<number> {
		const Now = Date.now();
		const Entry = this.Storage.get(key);

		if (!Entry || Now > Entry.resetTime) {
			// Create new entry
			const ResetTime = Now + windowMs;
			this.Storage.set(key, { count: 1, resetTime: ResetTime });
			return 1;
		} else {
			// Increment existing entry
			Entry.count++;
			this.Storage.set(key, Entry);
			return Entry.count;
		}
	}

	// eslint-disable-next-line require-await
	public async Get(key: string): Promise<number> {
		const Entry = this.Storage.get(key);
		const Now = Date.now();

		if (!Entry || Now > Entry.resetTime) {
			return 0;
		}

		return Entry.count;
	}

	// eslint-disable-next-line require-await
	public async Reset(key: string): Promise<void> {
		this.Storage.delete(key);
	}

	// eslint-disable-next-line require-await
	public async Cleanup(): Promise<void> {
		const Now = Date.now();
		for (const [Key, Entry] of this.Storage.entries()) {
			if (Now > Entry.resetTime) {
				this.Storage.delete(Key);
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

	private get Logger(): IContextualLogger {
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
			await this.Cleanup();
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
	public async CheckLimit(clientId: string, operation?: string): Promise<IRateLimitResult> {
		const Config = operation ? this.GetConfigForOperation(operation) : this.DefaultConfig;

		// Use storage backend if available, otherwise fall back to in-memory
		const { Storage } = this;
		if (Storage) {
			return this.CheckLimitWithStorage(clientId, Config, Storage);
		} else {
			return this.CheckLimitInMemory(clientId, Config);
		}
	}

	/**
	 * Check rate limit using storage backend
	 */
	private async CheckLimitWithStorage(clientId: string, config: IRateLimitConfig, storage: IRateLimitStorage): Promise<IRateLimitResult> {
		try {
			const Current = await storage.Increment(clientId, config.windowMs);
			const Remaining = Math.max(0, config.maxRequests - Current);
			const Allowed = Current <= config.maxRequests;

			return {
				allowed: Allowed,
				remaining: Remaining,
				limit: config.maxRequests,
				resetTime: Date.now() + config.windowMs,
				current: Current,
			};
		} catch (error) {
			this.Logger.error(`Storage rate limit check failed for ${clientId}:`, getErrorMessage(error));
			// Fall back to in-memory on storage error
			return this.CheckLimitInMemory(clientId, config);
		}
	}

	/**
	 * Check rate limit using in-memory storage (legacy implementation)
	 */
	private CheckLimitInMemory(clientId: string, config: IRateLimitConfig): IRateLimitResult {
		const Now = Date.now();

		let Entry = this.Store.get(clientId);

		if (!Entry || Now > Entry.resetTime) {
			// Create new entry or reset expired entry
			Entry = {
				count: 0,
				resetTime: Now + config.windowMs,
			};
		}

		const Allowed = Entry.count < config.maxRequests;

		if (Allowed) {
			Entry.count++;
			this.Store.set(clientId, Entry);
		}

		const Remaining = Math.max(0, config.maxRequests - Entry.count);

		return {
			allowed: Allowed,
			remaining: Remaining,
			limit: config.maxRequests,
			resetTime: Entry.resetTime,
			current: Entry.count,
		};
	}

	/**
	 * Sets custom rate limit configuration for a specific operation
	 *
	 * @param operation - Operation name (e.g., 'query', 'mutation')
	 * @param config - Rate limit configuration
	 */
	public SetOperationConfig(operation: string, config: IRateLimitConfig): void {
		this.OperationConfigs.set(operation, config);
		this.Logger.info(`Set custom rate limit for operation '${operation}': ${config.maxRequests} requests per ${config.windowMs}ms`);
	}

	/**
	 * Gets rate limit configuration for an operation
	 *
	 * @param operation - Operation name
	 * @returns IRateLimitConfig - Configuration for the operation
	 */
	private GetConfigForOperation(operation: string): IRateLimitConfig {
		return this.OperationConfigs.get(operation) ?? this.DefaultConfig;
	}

	/**
	 * Manually resets rate limit for a client
	 *
	 * @param clientId - Client identifier to reset
	 */
	public async ResetLimit(clientId: string): Promise<void> {
		this.Store.delete(clientId);
		// Also reset in storage backend if available
		if (this.Storage) {
			try {
				await this.Storage.Reset(clientId);
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
	public async GetStatus(clientId: string, operation?: string): Promise<IRateLimitResult | null> {
		const Config = operation ? this.GetConfigForOperation(operation) : this.DefaultConfig;

		// Check storage backend first if available
		if (this.Storage) {
			try {
				const Count = await this.Storage.Get(clientId);
				if (Count > 0) {
					const Remaining = Math.max(0, Config.maxRequests - Count);
					return {
						allowed: Count < Config.maxRequests,
						remaining: Remaining,
						limit: Config.maxRequests,
						resetTime: Date.now() + Config.windowMs,
						current: Count,
					};
				}
			} catch (error) {
				this.Logger.error(`Storage status check failed for ${clientId}:`, getErrorMessage(error));
				// Fall back to in-memory
			}
		}

		// Fall back to in-memory store
		const Entry = this.Store.get(clientId);

		if (!Entry) {
			return null;
		}

		const Now = Date.now();
		const Remaining = Math.max(0, Config.maxRequests - Entry.count);

		return {
			allowed: Entry.count < Config.maxRequests && Now <= Entry.resetTime,
			remaining: Remaining,
			limit: Config.maxRequests,
			resetTime: Entry.resetTime,
		};
	}

	/**
	 * Cleans up expired rate limit entries
	 */
	private async Cleanup(): Promise<void> {
		// Clean up storage backend if available
		const { Storage } = this;
		if (Storage) {
			try {
				await Storage.Cleanup();
			} catch (error) {
				this.Logger.error('Storage cleanup failed:', getErrorMessage(error));
			}
		}

		// Clean up in-memory store
		const Now = Date.now();
		let Cleaned = 0;

		for (const [ClientId, Entry] of this.Store.entries()) {
			if (Now > Entry.resetTime) {
				this.Store.delete(ClientId);
				Cleaned++;
			}
		}

		if (Cleaned > 0) {
			this.Logger.debug(`Cleaned up ${Cleaned} expired rate limit entries`);
		}
	}

	/**
	 * Gets statistics about the rate limit store
	 *
	 * @returns Object with store statistics
	 */
	public GetStats(): { totalEntries: number; operationConfigs: number } {
		return {
			totalEntries: this.Store.size,
			operationConfigs: this.OperationConfigs.size,
		};
	}
}
