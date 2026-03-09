import { Injectable, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { ModuleRef } from '@nestjs/core';
import type { Cache } from 'cache-manager';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { Traced } from '@pawells/nestjs-open-telemetry';
import { PyroscopeService , ProfileMethod } from '@pawells/nestjs-pyroscope';
import {
	CACHE_MAX_OPERATION_TIMINGS,
	CACHE_OPERATION_TIMING_MAX_AGE_MS,
	CACHE_CLEANUP_INTERVAL_MS,
	CACHE_MAX_KEY_LENGTH,
} from '../constants/cache-config.constants.js';

/**
 * Cache statistics interface
 */
export interface CacheStats {
	hits: number;
	misses: number;
	sets: number;
	deletes: number;
	clears: number;
	errors: number;
	hitRate: number;
	// Enhanced metrics for Phase 3
	totalKeys?: number;
	memoryUsage?: number; // in bytes
	evictions: number;
	evictionReasons: { [reason: string]: number };
	invalidationPatterns: { [pattern: string]: number };
	operationTimings: {
		get: number[];
		set: number[];
		del: number[];
	};
	lastSnapshot?: Date;
}

/**
 * Abstract base cache service providing shared caching functionality
 */
@Injectable()
export abstract class BaseCacheService implements LazyModuleRefService, OnModuleDestroy {
	protected logger!: AppLogger;

	protected stats: CacheStats = {
		hits: 0,
		misses: 0,
		sets: 0,
		deletes: 0,
		clears: 0,
		errors: 0,
		hitRate: 0,
		// Enhanced metrics for Phase 3
		evictions: 0,
		evictionReasons: {},
		invalidationPatterns: {},
		operationTimings: {
			get: [],
			set: [],
			del: [],
		},
	};

	// Enhanced tracking for Phase 3
	protected operationTimings: Map<string, number[]> = new Map();

	protected memorySnapshots: Array<{ timestamp: Date; usage: number }> = [];

	protected keyDistribution: Map<string, number> = new Map();

	protected lastStatsLog: Date = new Date();

	protected readonly STATS_LOG_INTERVAL = 5 * 60 * 1_000; // 5 minutes

	// Memory leak prevention constants
	private static readonly MAX_OPERATION_TIMINGS = CACHE_MAX_OPERATION_TIMINGS;

	private static readonly OPERATION_TIMING_MAX_AGE_MS = CACHE_OPERATION_TIMING_MAX_AGE_MS;

	private static readonly CLEANUP_INTERVAL_MS = CACHE_CLEANUP_INTERVAL_MS;

	// Cleanup interval reference for cleanup on destroy
	private cleanupIntervalRef: NodeJS.Timeout | undefined;

	// Cache manager - memoized for frequent access
	private _cacheManager: Cache | undefined;

	// Base logger - memoized and contextualized
	private _appLogger: AppLogger | undefined;

	constructor(public readonly moduleRef: ModuleRef) {}

	public get CacheManager(): Cache {
		if (!this._cacheManager) {
			const cacheManager = this.moduleRef.get<Cache>(CACHE_MANAGER);
			if (!cacheManager) {
				throw new Error('CacheManager not found in module');
			}
			this._cacheManager = cacheManager;
		}
		return this._cacheManager;
	}

	public get AppLogger(): AppLogger {
		if (!this._appLogger) {
			const logger = this.moduleRef.get<AppLogger>(AppLogger);
			if (!logger) {
				throw new Error('AppLogger not found in module');
			}
			this._appLogger = logger;
		}
		return this._appLogger;
	}

	public get Pyroscope(): PyroscopeService {
		return this.moduleRef.get(PyroscopeService);
	}

	// Initialize contextual logger after getting AppLogger
	protected initializeContextualLogger(): void {
		this.logger = this.AppLogger.createContextualLogger(BaseCacheService.name);
		this.startPeriodicCleanup();
	}

	/**
	 * Start periodic cleanup of operation timings to prevent memory leaks
	 */
	private startPeriodicCleanup(): void {
		this.cleanupIntervalRef ??= setInterval(
			() => this.cleanupTimings(),
			BaseCacheService.CLEANUP_INTERVAL_MS,
		);
	}

	/**
	 * Clean up old timing entries to prevent unbounded map growth
	 */
	private cleanupTimings(): void {
		if (this.operationTimings.size > BaseCacheService.MAX_OPERATION_TIMINGS) {
			const now = Date.now();
			let removedCount = 0;

			// First, try to remove expired entries (older than 1 hour)

			for (const [key, timings] of this.operationTimings.entries()) {
				const oldestTiming = Math.min(...timings);
				if (now - oldestTiming > BaseCacheService.OPERATION_TIMING_MAX_AGE_MS) {
					this.operationTimings.delete(key);
					removedCount++;
				}
			}

			// If still too large, remove oldest entries using FIFO strategy
			if (this.operationTimings.size > BaseCacheService.MAX_OPERATION_TIMINGS) {
				const toRemove = this.operationTimings.size - BaseCacheService.MAX_OPERATION_TIMINGS;
				const entries = Array.from(this.operationTimings.entries());

				// Sort by oldest first timing
				entries.sort((a, b) => {
					const minA = Math.min(...a[1]);
					const minB = Math.min(...b[1]);
					return minA - minB;
				});

				// Remove oldest entries

				for (let i = 0; i < toRemove && i < entries.length; i++) {
					this.operationTimings.delete(entries[i]![0]);
					removedCount++;
				}
			}

			if (removedCount > 0) {
				this.logger.debug(`Operation timings cleanup: removed ${removedCount} entries`, JSON.stringify({
					remainingSize: this.operationTimings.size,
					maxSize: BaseCacheService.MAX_OPERATION_TIMINGS,
				}));
			}
		}
	}

	/**
	 * Abstract method for generating cache keys
	 * @param args - Arguments for key generation
	 * @returns string - Generated cache key
	 */
	protected abstract generateCacheKey(args: any): string;

	/**
	 * Validate cache key before operations
	 * @param key Cache key to validate
	 * @throws BadRequestException if key is invalid
	 */
	private validateCacheKey(key: string): void {
		if (typeof key !== 'string') {
			throw new BadRequestException('Cache key must be a string');
		}

		if (!key || key.length === 0) {
			throw new BadRequestException('Cache key cannot be empty');
		}

		if (key.length > CACHE_MAX_KEY_LENGTH) {
			throw new BadRequestException(`Cache key exceeds maximum length (${CACHE_MAX_KEY_LENGTH} characters)`);
		}

		// Check for null bytes
		if (key.includes('\0')) {
			throw new BadRequestException('Cache key contains invalid characters (null bytes)');
		}

		// Check for control characters (0x00-0x1F, 0x7F)
		// eslint-disable-next-line no-control-regex
		if (/[\x00-\x1f\x7f]/.test(key)) {
			throw new BadRequestException('Cache key contains invalid control characters');
		}
	}

	/**
	 * Get a value from cache
	 * @param key Cache key
	 * @returns Cached value or undefined
	 */
	@Traced({ name: 'cache.get' })
	@ProfileMethod({
		name: 'BaseCacheService.get',
		tags: { operation: 'cache_get', cacheType: 'redis' },
	})
	public async get<T>(key: string): Promise<T | undefined> {
		this.validateCacheKey(key);
		const startTime = Date.now();
		this.logger.debug('Cache get operation', JSON.stringify({ key }));

		try {
			const value = await this.CacheManager.get<T>(key);
			const duration = Date.now() - startTime;

			// Track operation timing
			this.trackOperationTiming('get', duration);

			if (value !== null && value !== undefined) {
				this.stats.hits++;
				this.updateHitRate();
				this.logger.debug('Cache hit', JSON.stringify({
					key,
					durationMs: duration,
					size: JSON.stringify(value).length,
				}));
				// Log enhanced stats periodically
				this.logEnhancedStats();
				return value;
			} else {
				this.stats.misses++;
				this.updateHitRate();
				this.logger.debug('Cache miss', JSON.stringify({
					key,
					durationMs: duration,
				}));
				// Log enhanced stats periodically
				this.logEnhancedStats();
				return undefined;
			}
		} catch (error) {
			this.stats.errors++;
			const duration = Date.now() - startTime;
			this.trackOperationTiming('get', duration);
			this.logger.error('Cache get error', JSON.stringify({
				key,
				error: (error as Error).message,
				durationMs: duration,
			}));
			return undefined;
		}
	}

	/**
	 * Set a value in cache
	 * @param key Cache key
	 * @param value Value to cache
	 * @param ttl Time to live in seconds (optional)
	 */
	@Traced({ name: 'cache.set' })
	@ProfileMethod({
		name: 'BaseCacheService.set',
		tags: { operation: 'cache_set', cacheType: 'redis' },
	})
	public async set<T>(key: string, value: T, ttl?: number): Promise<void> {
		this.validateCacheKey(key);
		const startTime = Date.now();
		const size = JSON.stringify(value).length;
		this.logger.debug('Cache set operation', JSON.stringify({
			key,
			ttl,
			size,
		}));

		try {
			await this.CacheManager.set(key, value, ttl);
			this.stats.sets++;
			const duration = Date.now() - startTime;
			this.trackOperationTiming('set', duration);
			this.logger.debug('Cache set successful', JSON.stringify({
				key,
				durationMs: duration,
				size,
			}));
		} catch (error) {
			this.stats.errors++;
			const duration = Date.now() - startTime;
			this.trackOperationTiming('set', duration);
			this.logger.error('Cache set error', JSON.stringify({
				key,
				error: (error as Error).message,
				durationMs: duration,
			}));
			throw error;
		}
	}

	/**
	 * Delete one or more keys from cache
	 * @param key Key(s) to delete
	 */
	@Traced({ name: 'cache.del' })
	@ProfileMethod({
		name: 'BaseCacheService.del',
		tags: { operation: 'cache_del', cacheType: 'redis' },
	})
	public async del(key: string | string[]): Promise<void> {
		const keys = Array.isArray(key) ? key : [key];
		// Validate all keys before deletion
		for (const k of keys) {
			this.validateCacheKey(k);
		}
		const startTime = Date.now();
		this.logger.debug(`Cache delete: ${keys.join(', ')}`);
		try {
			for (const k of keys) {
				await this.CacheManager.del(k);
			}
			this.stats.deletes++;
			const duration = Date.now() - startTime;
			this.trackOperationTiming('del', duration);
			this.logger.debug(`Cache deleted: ${keys.length} key(s)`, JSON.stringify({
				durationMs: duration,
				keysCount: keys.length,
			}));
		} catch (error) {
			this.stats.errors++;
			const duration = Date.now() - startTime;
			this.trackOperationTiming('del', duration);
			this.logger.error(`Cache delete error for keys ${key}:`, JSON.stringify({
				error: (error as Error).message,
				durationMs: duration,
			}));
			throw error;
		}
	}

	/**
	 * Clear all cache entries
	 */
	@Traced({ name: 'cache.clear' })
	@ProfileMethod({
		name: 'BaseCacheService.clear',
		tags: { operation: 'cache_clear', cacheType: 'redis' },
	})
	public async clear(): Promise<void> {
		this.logger.info('Clearing all cache entries');
		try {
			await this.CacheManager.reset();
			this.stats.clears++;
			this.logger.info('Cache cleared successfully');
		} catch (error) {
			this.stats.errors++;
			this.logger.error('Cache clear error:', error as string);
			throw error;
		}
	}

	/**
	 * Check if a key exists in cache
	 * @param key Cache key
	 * @returns True if key exists
	 */
	@Traced({ name: 'cache.exists' })
	public async exists(key: string): Promise<boolean> {
		this.validateCacheKey(key);
		try {
			const value = await this.CacheManager.get(key);
			return value !== null && value !== undefined;
		} catch (error) {
			this.stats.errors++;
			this.logger.error(`Cache exists error for key ${key}:`, error as string);
			return false;
		}
	}

	/**
	 * Get or set a value using cache-aside pattern
	 * @param key Cache key
	 * @param factory Function to generate value if not cached
	 * @param ttl Time to live in seconds (optional)
	 * @returns Cached or newly generated value
	 */
	@Traced({ name: 'cache.getOrSet' })
	@ProfileMethod({
		name: 'BaseCacheService.getOrSet',
		tags: { operation: 'cache_getOrSet', cacheType: 'redis' },
	})
	public async getOrSet<T>(
		key: string,
		factory: () => Promise<T>,
		ttl?: number,
	): Promise<T> {
		this.validateCacheKey(key);
		this.logger.debug(`Cache getOrSet: ${key}`);
		const cached = await this.get<T>(key);
		if (cached !== undefined) {
			return cached;
		}

		this.logger.debug(`Executing factory function for key: ${key}`);
		try {
			const value = await factory();
			await this.set(key, value, ttl);
			this.logger.debug(`Factory result cached for key: ${key}`);
			return value;
		} catch (error) {
			this.logger.error(`Factory function error for key ${key}:`, error as string);
			throw error;
		}
	}

	/**
	 * Invalidate cache keys matching a pattern
	 * @param pattern Pattern to match (uses Redis SCAN)
	 * @returns Number of keys deleted
	 */
	@ProfileMethod({
		name: 'BaseCacheService.invalidatePattern',
		tags: { operation: 'cache_invalidatePattern', cacheType: 'redis' },
	})
	public async invalidatePattern(pattern: string): Promise<number> {
		this.validateCacheKey(pattern);
		this.logger.info(`Invalidating cache pattern: ${pattern}`);
		try {
			// For Redis store, we need to access the underlying client
			const { store } = (this.CacheManager as any);
			if (store && typeof store.keys === 'function') {
				const keys = await store.keys(pattern);
				if (keys && keys.length > 0) {
					await this.del(keys);
					// Track invalidation pattern
					this.stats.invalidationPatterns[pattern] = (this.stats.invalidationPatterns[pattern] ?? 0) + keys.length;
					this.logger.info(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`, JSON.stringify({
						pattern,
						keysRemoved: keys.length,
						totalForPattern: this.stats.invalidationPatterns[pattern],
					}));
					return keys.length;
				} else {
					this.logger.debug(`No cache keys found matching pattern: ${pattern}`);
				}
			} else {
				this.logger.warn(`Store does not support pattern-based eviction for pattern: ${pattern}`);
			}
			return 0;
		} catch (error) {
			this.stats.errors++;
			this.logger.error(`Pattern invalidation error for pattern ${pattern}:`, JSON.stringify({
				pattern,
				error: (error as Error).message,
			}));
			return 0;
		}
	}

	/**
	 * Get cache statistics
	 * @returns CacheStats object
	 */
	public getStats(): CacheStats {
		return { ...this.stats };
	}

	/**
	 * Reset cache statistics
	 */
	public resetStats(): void {
		this.stats = {
			hits: 0,
			misses: 0,
			sets: 0,
			deletes: 0,
			clears: 0,
			errors: 0,
			hitRate: 0,
			// Enhanced metrics for Phase 3
			evictions: 0,
			evictionReasons: {},
			invalidationPatterns: {},
			operationTimings: {
				get: [],
				set: [],
				del: [],
			},
		};
		this.operationTimings.clear();
		this.memorySnapshots = [];
		this.keyDistribution.clear();
		this.lastStatsLog = new Date();

		// Restart periodic cleanup
		this.startPeriodicCleanup();
	}

	/**
	 * Update hit rate calculation
	 */
	private updateHitRate(): void {
		const total = this.stats.hits + this.stats.misses;
		this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
	}

	/**
	 * Track operation timing for percentiles calculation
	 */
	private trackOperationTiming(operation: string, duration: number): void {
		if (!this.operationTimings.has(operation)) {
			this.operationTimings.set(operation, []);
		}

		const timings = this.operationTimings.get(operation)!;
		timings.push(duration);

		// Keep only last 1000 timings to prevent memory growth per operation type
		if (timings.length > 1_000) {
			timings.shift();
		}

		// Update stats operation timings
		this.stats.operationTimings[operation as keyof typeof this.stats.operationTimings] = [...timings];

		// Trigger cleanup if approaching size limit (every 5000 operations)
		if (this.operationTimings.size % 5_000 === 0 && this.operationTimings.size > 0) {
			this.cleanupTimings();
		}
	}

	/**
	 * Calculate percentile from timing array
	 */
	private calculatePercentile(timings: number[], percentile: number): number {
		if (timings.length === 0) return 0;
		const sorted = [...timings].sort((a, b) => a - b);
		const index = Math.ceil((percentile / 100) * sorted.length) - 1;
		return sorted[Math.min(sorted.length - 1, Math.max(0, index))]!;
	}

	/**
	 * Log enhanced cache statistics periodically
	 */
	private logEnhancedStats(): void {
		const now = new Date();
		if (now.getTime() - this.lastStatsLog.getTime() < this.STATS_LOG_INTERVAL) {
			return;
		}
		this.lastStatsLog = now;

		const stats = this.getStats();
		const totalOps = stats.hits + stats.misses + stats.sets + stats.deletes + stats.clears;

		// Calculate percentiles

		const getP50 = this.calculatePercentile(this.stats.operationTimings.get, 50);

		const getP95 = this.calculatePercentile(this.stats.operationTimings.get, 95);

		const getP99 = this.calculatePercentile(this.stats.operationTimings.get, 99);

		const setP50 = this.calculatePercentile(this.stats.operationTimings.set, 50);

		const setP95 = this.calculatePercentile(this.stats.operationTimings.set, 95);

		const setP99 = this.calculatePercentile(this.stats.operationTimings.set, 99);

		// Log comprehensive statistics

		this.logger.info('Cache statistics', JSON.stringify({
			totalKeys: stats.totalKeys ?? 0,

			memoryUsage: stats.memoryUsage ? `${(stats.memoryUsage / 1_024 / 1_024).toFixed(2)}MB` : 'unknown',

			hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,

			missRate: `${((stats.misses / (stats.hits + stats.misses || 1)) * 100).toFixed(1)}%`,
			totalOperations: totalOps,
			evictions: stats.evictions,
			errors: stats.errors,
		}));

		// Log operation timing percentiles
		this.logger.info('Cache operation timing percentiles', JSON.stringify({
			get: {
				p50: `${getP50}ms`,
				p95: `${getP95}ms`,
				p99: `${getP99}ms`,
				count: this.stats.operationTimings.get.length,
			},
			set: {
				p50: `${setP50}ms`,
				p95: `${setP95}ms`,
				p99: `${setP99}ms`,
				count: this.stats.operationTimings.set.length,
			},
		}));

		// Log eviction reasons if any
		if (stats.evictions > 0) {
			this.logger.info('Cache eviction summary', JSON.stringify({
				totalEvictions: stats.evictions,
				reasons: stats.evictionReasons,
			}));
		}

		// Log invalidation patterns if any
		const patternCount = Object.keys(stats.invalidationPatterns).length;
		if (patternCount > 0) {
			this.logger.info('Cache invalidation patterns', JSON.stringify({
				patterns: stats.invalidationPatterns,
				totalPatterns: patternCount,
			}));
		}
	}

	/**
	 * Record cache eviction event
	 */
	protected recordEviction(reason: 'TTL' | 'LRU' | 'manual' | 'memory_limit', keysRemoved: number, memoryFreed?: number): void {
		this.stats.evictions += keysRemoved;
		this.stats.evictionReasons[reason] = (this.stats.evictionReasons[reason] ?? 0) + keysRemoved;

		this.logger.info('Cache eviction', JSON.stringify({
			reason,
			keysRemoved,
			memoryFreed: memoryFreed ? `${(memoryFreed / 1024).toFixed(0)}KB` : 'unknown',
			totalEvictions: this.stats.evictions,
		}));
	}

	/**
	 * Record cache warming event
	 */
	protected recordCacheWarming(keysLoaded: number, durationMs: number): void {
		this.logger.info('Cache warming completed', JSON.stringify({
			keysLoaded,
			duration: `${(durationMs / 1000).toFixed(2)}s`,
			rate: `${(keysLoaded / (durationMs / 1000)).toFixed(0)} keys/s`,
		}));
	}

	/**
	 * Record cache synchronization event
	 */
	protected recordCacheSync(source: string, keysSynced: number, durationMs: number): void {
		this.logger.info('Cache synchronization completed', JSON.stringify({
			source,
			keysSynced,
			duration: `${(durationMs / 1000).toFixed(2)}s`,
			rate: `${(keysSynced / (durationMs / 1000)).toFixed(0)} keys/s`,
		}));
	}

	/**
	 * Update memory usage tracking
	 */
	protected updateMemoryUsage(usage: number): void {
		this.stats.memoryUsage = usage;
		this.memorySnapshots.push({
			timestamp: new Date(),
			usage,
		});

		// Keep only last 100 snapshots
		if (this.memorySnapshots.length > 100) {
			this.memorySnapshots.shift();
		}
	}

	/**
	 * Get memory usage trend
	 */
	protected getMemoryTrend(): { trend: 'increasing' | 'decreasing' | 'stable'; rate: number } {
		if (this.memorySnapshots.length < 2) {
			return { trend: 'stable', rate: 0 };
		}

		const recent = this.memorySnapshots.slice(-10);
		const first = recent[0]!.usage;
		const last = recent[recent.length - 1]!.usage;
		const timeDiff = recent[recent.length - 1]!.timestamp.getTime() - recent[0]!.timestamp.getTime();

		const rate = (last - first) / (timeDiff / 1_000); // bytes per second

		let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
		if (rate > 1_024) { // > 1KB/s increase
			trend = 'increasing';
		} else if (rate < -1_024) { // > 1KB/s decrease
			trend = 'decreasing';
		}

		return { trend, rate };
	}

	/**
	 * Cleanup on module destroy
	 */
	public async onModuleDestroy(): Promise<void> {
		try {
			// Clear periodic cleanup interval
			if (this.cleanupIntervalRef) {
				clearInterval(this.cleanupIntervalRef);
				this.cleanupIntervalRef = undefined;
			}

			// Log final enhanced statistics
			this.logEnhancedStats();

			const stats = this.getStats();
			this.logger.info('Cache service shutdown', JSON.stringify({
				finalStats: stats,
				totalOperations: stats.hits + stats.misses + stats.sets + stats.deletes + stats.clears,
				hitRatePercent: (stats.hitRate * 100).toFixed(2),
				operationTimingsSize: this.operationTimings.size,
			}));

			// Log memory trend
			const memoryTrend = this.getMemoryTrend();
			if (memoryTrend.trend !== 'stable') {
				this.logger.info('Final memory trend', JSON.stringify({
					trend: memoryTrend.trend,
					rate: `${(memoryTrend.rate / 1024).toFixed(2)} KB/s`,
				}));
			}

			// Log cache size information if available
			try {
				const { store } = (this.CacheManager as any);
				if (store && typeof store.client?.dbsize === 'function') {
					const dbSize = await store.client.dbsize();
					this.stats.totalKeys = dbSize;
					this.logger.info('Redis database size', JSON.stringify({
						keys: dbSize,
					}));
				}
			} catch (error) {
				this.logger.debug('Could not retrieve cache size information', JSON.stringify({
					error: (error as Error).message,
				}));
			}

			// Clear memory tracking structures
			this.operationTimings.clear();
			this.memorySnapshots = [];
			this.keyDistribution.clear();
		} catch (error) {
			this.logger.error('Error during cache service cleanup', JSON.stringify({
				error: (error as Error).message,
			}));
		}
	}
}
