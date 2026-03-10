declare global {
	namespace NodeJS {
		interface Timeout {}
	}
}

import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { AppLogger } from '@pawells/nestjs-shared/common';

/**
 * Rate limit result interface
 */
export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	limit: number;
	resetTime: number;
	current?: number; // Added for enhanced result
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
	windowMs: number; // Time window in milliseconds
	maxRequests: number; // Maximum requests per window
}

/**
 * Storage backend interface for rate limiting
 */
export interface RateLimitStorage {
	increment(key: string, windowMs: number): Promise<number>;
	get(key: string): Promise<number>;
	reset(key: string): Promise<void>;
	cleanup(): Promise<void>;
}

/**
 * In-memory rate limit store entry
 */
interface RateLimitEntry {
	count: number;
	resetTime: number;
}

/**
 * In-memory storage implementation
 */
@Injectable()
export class MemoryRateLimitStorage implements RateLimitStorage {
	private readonly storage = new Map<string, { count: number; resetTime: number }>();

	public async increment(key: string, windowMs: number): Promise<number> {
		const now = Date.now();
		const entry = this.storage.get(key);

		if (!entry || now > entry.resetTime) {
			// Create new entry
			const resetTime = now + windowMs;
			this.storage.set(key, { count: 1, resetTime });
			return 1;
		} else {
			// Increment existing entry
			entry.count++;
			this.storage.set(key, entry);
			return entry.count;
		}
	}

	public async get(key: string): Promise<number> {
		const entry = this.storage.get(key);
		const now = Date.now();

		if (!entry || now > entry.resetTime) {
			return 0;
		}

		return entry.count;
	}

	public async reset(key: string): Promise<void> {
		this.storage.delete(key);
	}

	public async cleanup(): Promise<void> {
		const now = Date.now();
		for (const [key, entry] of this.storage.entries()) {
			if (now > entry.resetTime) {
				this.storage.delete(key);
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
export class RateLimitService implements OnModuleInit, OnModuleDestroy {
	private readonly logger: AppLogger;

	private readonly store = new Map<string, RateLimitEntry>();

	// eslint-disable-next-line no-undef
	private cleanupInterval?: NodeJS.Timeout;

	constructor(
		@Inject(AppLogger) private readonly appLogger: AppLogger,
		@Optional() @Inject('RATE_LIMIT_STORAGE') private readonly storage?: RateLimitStorage,
	) {
		this.logger = this.appLogger.createContextualLogger(RateLimitService.name);
	}

	/**
	 * Default rate limit configuration
	 * 100 requests per 15 minutes
	 */
	private readonly defaultConfig: RateLimitConfig = {
		windowMs: 15 * 60 * 1000, // 15 minutes
		maxRequests: 100,
	};

	/**
	 * Custom configurations per operation type
	 */
	private readonly operationConfigs = new Map<string, RateLimitConfig>();

	public onModuleInit(): void {
		// Start cleanup interval to remove expired entries
		this.cleanupInterval = setInterval(async () => {
			await this.cleanup();
		}, 60000); // Clean up every minute

		this.logger.info('Rate limit service initialized');
	}

	public onModuleDestroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
		this.logger.info('Rate limit service destroyed');
	}

	/**
	 * Checks if a client is within rate limits
	 *
	 * @param clientId - Unique client identifier (user ID or IP)
	 * @param operation - Optional operation name for custom limits
	 * @returns Promise<RateLimitResult> - Rate limit check result
	 */
	public async checkLimit(clientId: string, operation?: string): Promise<RateLimitResult> {
		const config = operation ? this.getConfigForOperation(operation) : this.defaultConfig;

		// Use storage backend if available, otherwise fall back to in-memory
		if (this.storage) {
			return this.checkLimitWithStorage(clientId, config);
		} else {
			return this.checkLimitInMemory(clientId, config);
		}
	}

	/**
	 * Check rate limit using storage backend
	 */
	private async checkLimitWithStorage(clientId: string, config: RateLimitConfig): Promise<RateLimitResult> {
		try {
			const current = await this.storage!.increment(clientId, config.windowMs);
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
			this.logger.error(`Storage rate limit check failed for ${clientId}:`, error instanceof Error ? error.message : String(error));
			// Fall back to in-memory on storage error
			return this.checkLimitInMemory(clientId, config);
		}
	}

	/**
	 * Check rate limit using in-memory storage (legacy implementation)
	 */
	private checkLimitInMemory(clientId: string, config: RateLimitConfig): RateLimitResult {
		const now = Date.now();

		let entry = this.store.get(clientId);

		if (!entry || now > entry.resetTime) {
			// Create new entry or reset expired entry
			entry = {
				count: 0,
				resetTime: now + config.windowMs,
			};
		}

		const remaining = Math.max(0, config.maxRequests - entry.count - 1);
		const allowed = entry.count < config.maxRequests;

		if (allowed) {
			entry.count++;
			this.store.set(clientId, entry);
		}

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
	public setOperationConfig(operation: string, config: RateLimitConfig): void {
		this.operationConfigs.set(operation, config);
		this.logger.info(`Set custom rate limit for operation '${operation}': ${config.maxRequests} requests per ${config.windowMs}ms`);
	}

	/**
	 * Gets rate limit configuration for an operation
	 *
	 * @param operation - Operation name
	 * @returns RateLimitConfig - Configuration for the operation
	 */
	private getConfigForOperation(operation: string): RateLimitConfig {
		return this.operationConfigs.get(operation) ?? this.defaultConfig;
	}

	/**
	 * Manually resets rate limit for a client
	 *
	 * @param clientId - Client identifier to reset
	 */
	public resetLimit(clientId: string): void {
		this.store.delete(clientId);
		this.logger.debug(`Reset rate limit for client: ${clientId}`);
	}

	/**
	 * Gets current rate limit status for a client
	 *
	 * @param clientId - Client identifier
	 * @param operation - Optional operation name
	 * @returns RateLimitResult | null - Current status or null if no record
	 */
	public getStatus(clientId: string, operation?: string): RateLimitResult | null {
		const config = operation ? this.getConfigForOperation(operation) : this.defaultConfig;
		const entry = this.store.get(clientId);

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
		if (this.storage) {
			try {
				await this.storage.cleanup();
			} catch (error) {
				this.logger.error('Storage cleanup failed:', error instanceof Error ? error.message : String(error));
			}
		}

		// Clean up in-memory store
		const now = Date.now();
		let cleaned = 0;

		for (const [clientId, entry] of this.store.entries()) {
			if (now > entry.resetTime) {
				this.store.delete(clientId);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
		}
	}

	/**
	 * Gets statistics about the rate limit store
	 *
	 * @returns Object with store statistics
	 */
	public getStats(): { totalEntries: number; operationConfigs: number } {
		return {
			totalEntries: this.store.size,
			operationConfigs: this.operationConfigs.size,
		};
	}
}
