declare global {
	namespace NodeJS {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		interface Timeout {}
	}
}

import { Injectable, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ModuleRef } from '@nestjs/core';
import type { Cache } from 'cache-manager';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { Traced } from '@pawells/nestjs-open-telemetry';
import { PyroscopeService, ProfileMethod } from '@pawells/nestjs-pyroscope';
import {
	CACHE_MAX_OPERATION_TIMINGS,
	CACHE_OPERATION_TIMING_MAX_AGE_MS,
	CACHE_CLEANUP_INTERVAL_MS,
	CACHE_MAX_KEY_LENGTH,
	CACHE_STATS_LOG_INTERVAL_MS,
	CACHE_PERCENTILE_P50,
	CACHE_PERCENTILE_P95,
	CACHE_PERCENTILE_P99,
	CACHE_MEMORY_SNAPSHOT_MAX,
	CACHE_MEMORY_TREND_WINDOW,
	CACHE_MEMORY_TREND_THRESHOLD_BYTES_PER_SEC,
	BYTES_PER_KILOBYTE,
	BYTES_PER_MEGABYTE,
	MS_PER_SECOND,
	PERCENTAGE_FACTOR,
	CACHE_MAX_TIMINGS_PER_OPERATION,
	CACHE_TIMING_CLEANUP_TRIGGER_SIZE,
} from '../constants/cache-config.constants.js';

/**
 * Cache statistics interface
 */
export interface ICacheStats {
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
export abstract class BaseCacheService implements ILazyModuleRefService, OnModuleDestroy {
	protected Logger: IContextualLogger | undefined;

	protected Stats: ICacheStats = {
		hits: 0,
		misses: 0,
		sets: 0,
		deletes: 0,
		clears: 0,
		errors: 0,
		hitRate: 0,
		memoryUsage: 0,
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
	protected OperationTimings: Map<string, number[]> = new Map();

	protected MemorySnapshots: Array<{ timestamp: Date; usage: number }> = [];

	protected KeyDistribution: Map<string, number> = new Map();

	protected LastStatsLog: Date = new Date();

	protected readonly STATS_LOG_INTERVAL = CACHE_STATS_LOG_INTERVAL_MS;

	// Memory leak prevention constants
	private static readonly MAX_OPERATION_TIMINGS = CACHE_MAX_OPERATION_TIMINGS;

	private static readonly OPERATION_TIMING_MAX_AGE_MS = CACHE_OPERATION_TIMING_MAX_AGE_MS;

	private static readonly CLEANUP_INTERVAL_MS = CACHE_CLEANUP_INTERVAL_MS;

	// Cleanup interval reference for cleanup on destroy
	// eslint-disable-next-line no-undef
	private CleanupIntervalRef: NodeJS.Timeout | undefined;

	// Cache manager - memoized for frequent access
	private _CacheManager: Cache | undefined;

	public readonly Module: ModuleRef;

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	public get CacheManager(): Cache {
		if (!this._CacheManager) {
			const CacheManagerInstance = this.Module.get<Cache>(CACHE_MANAGER);
			if (!CacheManagerInstance) {
				throw new Error('CacheManager not found in module');
			}
			this._CacheManager = CacheManagerInstance;
		}
		return this._CacheManager;
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	public get Pyroscope(): PyroscopeService {
		return this.Module.get(PyroscopeService);
	}

	// Initialize contextual logger after getting AppLogger
	protected InitializeContextualLogger(): void {
		this.Logger = this.AppLogger.createContextualLogger(BaseCacheService.name);
		this.StartPeriodicCleanup();
	}

	/**
	 * Start periodic cleanup of operation timings to prevent memory leaks
	 */
	private StartPeriodicCleanup(): void {
		this.CleanupIntervalRef ??= setInterval(
			() => this.CleanupTimings(),
			BaseCacheService.CLEANUP_INTERVAL_MS,
		);
	}

	/**
	 * Clean up old timing entries to prevent unbounded map growth
	 */
	private CleanupTimings(): void {
		if (this.OperationTimings.size > BaseCacheService.MAX_OPERATION_TIMINGS) {
			const Now = Date.now();
			let RemovedCount = 0;

			// First, try to remove expired entries (older than 1 hour)
			for (const [Key, Timings] of this.OperationTimings.entries()) {
				const OldestTiming = Math.min(...Timings);
				if (Now - OldestTiming > BaseCacheService.OPERATION_TIMING_MAX_AGE_MS) {
					this.OperationTimings.delete(Key);
					RemovedCount++;
				}
			}

			// If still too large, remove oldest entries using FIFO strategy
			if (this.OperationTimings.size > BaseCacheService.MAX_OPERATION_TIMINGS) {
				const ToRemove = this.OperationTimings.size - BaseCacheService.MAX_OPERATION_TIMINGS;
				const Entries = Array.from(this.OperationTimings.entries());

				// Sort by oldest first timing
				Entries.sort((a, b) => {
					const MinA = Math.min(...a[1]);
					const MinB = Math.min(...b[1]);
					return MinA - MinB;
				});

				// Remove oldest entries
				for (let I = 0; I < ToRemove && I < Entries.length; I++) {
					this.OperationTimings.delete(Entries[I]?.[0] ?? '');
					RemovedCount++;
				}
			}

			if (RemovedCount > 0) {
				this.Logger?.debug(`Operation timings cleanup: removed ${RemovedCount} entries`, JSON.stringify({
					remainingSize: this.OperationTimings.size,
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
	protected abstract GenerateCacheKey(args: any): string;

	/**
	 * Validate cache key before operations
	 * @param key Cache key to validate
	 * @throws BadRequestException if key is invalid
	 */
	private ValidateCacheKey(key: string): void {
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
	public async Get<T>(key: string): Promise<T | undefined> {
		this.ValidateCacheKey(key);
		const StartTime = Date.now();
		this.Logger?.debug('Cache get operation', JSON.stringify({ key }));

		try {
			const Value = await this.CacheManager.get<T>(key);
			const Duration = Date.now() - StartTime;

			// Track operation timing
			this.TrackOperationTiming('get', Duration);

			if (Value !== null && Value !== undefined) {
				this.Stats.hits++;
				this.UpdateHitRate();
				this.Logger?.debug('Cache hit', JSON.stringify({
					key,
					durationMs: Duration,
					size: JSON.stringify(Value).length,
				}));
				// Log enhanced stats periodically
				this.LogEnhancedStats();
				return Value;
			} else {
				this.Stats.misses++;
				this.UpdateHitRate();
				this.Logger?.debug('Cache miss', JSON.stringify({
					key,
					durationMs: Duration,
				}));
				// Log enhanced stats periodically
				this.LogEnhancedStats();
				return undefined;
			}
		} catch (error) {
			this.Stats.errors++;
			const Duration = Date.now() - StartTime;
			this.TrackOperationTiming('get', Duration);
			this.Logger?.error('Cache get error', JSON.stringify({
				key,
				error: (error as Error).message,
				durationMs: Duration,
			}));
			return undefined;
		}
	}

	/**
	 * Set a value in cache
	 * @param key Cache key
	 * @param value Value to cache
	 * @param ttl Time to live in milliseconds (optional)
	 */
	@Traced({ name: 'cache.set' })
	@ProfileMethod({
		name: 'BaseCacheService.set',
		tags: { operation: 'cache_set', cacheType: 'redis' },
	})
	public async Set<T>(key: string, value: T, ttl?: number): Promise<void> {
		this.ValidateCacheKey(key);
		const StartTime = Date.now();
		const Size = JSON.stringify(value).length;
		this.Logger?.debug('Cache set operation', JSON.stringify({
			key,
			ttl,
			Size,
		}));

		try {
			await this.CacheManager.set(key, value, ttl);
			this.Stats.sets++;
			const Duration = Date.now() - StartTime;
			this.TrackOperationTiming('set', Duration);
			this.Logger?.debug('Cache set successful', JSON.stringify({
				key,
				durationMs: Duration,
				Size,
			}));
		} catch (error) {
			this.Stats.errors++;
			const Duration = Date.now() - StartTime;
			this.TrackOperationTiming('set', Duration);
			this.Logger?.error('Cache set error', JSON.stringify({
				key,
				error: (error as Error).message,
				durationMs: Duration,
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
	public async Del(key: string | string[]): Promise<void> {
		const Keys = Array.isArray(key) ? key : [key];
		// Validate all keys before deletion
		for (const K of Keys) {
			this.ValidateCacheKey(K);
		}
		const StartTime = Date.now();
		this.Logger?.debug(`Cache delete: ${Keys.join(', ')}`);
		try {
			for (const K of Keys) {
				await this.CacheManager.del(K);
			}
			this.Stats.deletes++;
			const Duration = Date.now() - StartTime;
			this.TrackOperationTiming('del', Duration);
			this.Logger?.debug(`Cache deleted: ${Keys.length} key(s)`, JSON.stringify({
				durationMs: Duration,
				keysCount: Keys.length,
			}));
		} catch (error) {
			this.Stats.errors++;
			const Duration2 = Date.now() - StartTime;
			this.TrackOperationTiming('del', Duration2);
			this.Logger?.error(`Cache delete error for keys ${key}:`, JSON.stringify({
				error: (error as Error).message,
				durationMs: Duration2,
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
	public async Clear(): Promise<void> {
		this.Logger?.info('Clearing all cache entries');
		try {
			// cache-manager v7 uses clear() method exclusively
			await (this.CacheManager as any).clear();
			this.Stats.clears++;
			this.Logger?.info('Cache cleared successfully');
		} catch (error) {
			this.Stats.errors++;
			this.Logger?.error('Cache clear error', getErrorMessage(error));
			throw error;
		}
	}

	/**
	 * Check if a key exists in cache
	 * @param key Cache key
	 * @returns True if key exists
	 */
	@Traced({ name: 'cache.exists' })
	public async Exists(key: string): Promise<boolean> {
		this.ValidateCacheKey(key);
		try {
			const Value = await this.CacheManager.get(key);
			return Value !== null && Value !== undefined;
		} catch (error) {
			this.Stats.errors++;
			this.Logger?.error(`Cache exists error for key ${key}`, getErrorMessage(error));
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
	public async GetOrSet<T>(
		key: string,
		factory: () => Promise<T>,
		ttl?: number,
	): Promise<T> {
		this.ValidateCacheKey(key);
		this.Logger?.debug(`Cache getOrSet: ${key}`);
		const Cached = await this.Get<T>(key);
		if (Cached !== undefined) {
			return Cached;
		}

		this.Logger?.debug(`Executing factory function for key: ${key}`);
		try {
			const Value = await factory();
			await this.Set(key, Value, ttl);
			this.Logger?.debug(`Factory result cached for key: ${key}`);
			return Value;
		} catch (error) {
			this.Logger?.error(`Factory function error for key ${key}`, getErrorMessage(error));
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
	public async InvalidatePattern(pattern: string): Promise<number> {
		this.ValidateCacheKey(pattern);
		this.Logger?.info(`Invalidating cache pattern: ${pattern}`);
		try {
			// For Redis store, we need to access the underlying client
			const { store } = (this.CacheManager as any);
			if (store && typeof store.keys === 'function') {
				const Keys = await store.keys(pattern);
				if (Keys && Keys.length > 0) {
					await this.Del(Keys);
					// Track invalidation pattern
					this.Stats.invalidationPatterns[pattern] = (this.Stats.invalidationPatterns[pattern] ?? 0) + Keys.length;
					this.Logger?.info(`Invalidated ${Keys.length} cache keys matching pattern: ${pattern}`, JSON.stringify({
						pattern,
						keysRemoved: Keys.length,
						totalForPattern: this.Stats.invalidationPatterns[pattern],
					}));
					return Keys.length;
				} else {
					this.Logger?.debug(`No cache keys found matching pattern: ${pattern}`);
				}
			} else {
				this.Logger?.warn(`Store does not support pattern-based eviction for pattern: ${pattern}`);
			}
			return 0;
		} catch (error) {
			this.Stats.errors++;
			this.Logger?.error(`Pattern invalidation error for pattern ${pattern}:`, JSON.stringify({
				pattern,
				error: (error as Error).message,
			}));
			return 0;
		}
	}

	/**
	 * Get cache statistics
	 * @returns ICacheStats object
	 */
	public GetStats(): ICacheStats {
		return { ...this.Stats };
	}

	/**
	 * Reset cache statistics
	 */
	public ResetStats(): void {
		this.Stats = {
			hits: 0,
			misses: 0,
			sets: 0,
			deletes: 0,
			clears: 0,
			errors: 0,
			hitRate: 0,
			memoryUsage: 0,
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
		this.OperationTimings.clear();
		this.MemorySnapshots = [];
		this.KeyDistribution.clear();
		this.LastStatsLog = new Date();

		// Restart periodic cleanup
		this.StartPeriodicCleanup();
	}

	/**
	 * Update hit rate calculation
	 */
	private UpdateHitRate(): void {
		const Total = this.Stats.hits + this.Stats.misses;
		this.Stats.hitRate = Total > 0 ? this.Stats.hits / Total : 0;
	}

	/**
	 * Track operation timing for percentiles calculation
	 */
	private TrackOperationTiming(operation: string, duration: number): void {
		if (!this.OperationTimings.has(operation)) {
			this.OperationTimings.set(operation, []);
		}

		const Timings = this.OperationTimings.get(operation);
		if (!Timings) return;
		Timings.push(duration);

		// Keep only last CACHE_MAX_TIMINGS_PER_OPERATION timings to prevent memory growth per operation type
		if (Timings.length > CACHE_MAX_TIMINGS_PER_OPERATION) {
			Timings.shift();
		}

		// Update stats operation timings
		this.Stats.operationTimings[operation as keyof typeof this.Stats.operationTimings] = [...Timings];

		// Trigger cleanup if approaching size limit (every CACHE_TIMING_CLEANUP_TRIGGER_SIZE operations)
		if (this.OperationTimings.size % CACHE_TIMING_CLEANUP_TRIGGER_SIZE === 0 && this.OperationTimings.size > 0) {
			this.CleanupTimings();
		}
	}

	/**
	 * Calculate percentile from timing array
	 */
	private CalculatePercentile(timings: number[], percentile: number): number {
		if (timings.length === 0) return 0;
		const Sorted = [...timings].sort((a, b) => a - b);
		const Index = Math.ceil((percentile / PERCENTAGE_FACTOR) * Sorted.length) - 1;
		return Sorted[Math.min(Sorted.length - 1, Math.max(0, Index))] ?? 0;
	}

	/**
	 * Log enhanced cache statistics periodically
	 */
	private LogEnhancedStats(): void {
		const Now = new Date();
		if (Now.getTime() - this.LastStatsLog.getTime() < this.STATS_LOG_INTERVAL) {
			return;
		}
		this.LastStatsLog = Now;

		const Stats = this.GetStats();
		const TotalOps = Stats.hits + Stats.misses + Stats.sets + Stats.deletes + Stats.clears;

		// Calculate percentiles

		const GetP50 = this.CalculatePercentile(this.Stats.operationTimings.get, CACHE_PERCENTILE_P50);

		const GetP95 = this.CalculatePercentile(this.Stats.operationTimings.get, CACHE_PERCENTILE_P95);

		const GetP99 = this.CalculatePercentile(this.Stats.operationTimings.get, CACHE_PERCENTILE_P99);

		const SetP50 = this.CalculatePercentile(this.Stats.operationTimings.set, CACHE_PERCENTILE_P50);

		const SetP95 = this.CalculatePercentile(this.Stats.operationTimings.set, CACHE_PERCENTILE_P95);

		const SetP99 = this.CalculatePercentile(this.Stats.operationTimings.set, CACHE_PERCENTILE_P99);

		// Log comprehensive statistics

		this.Logger?.info('Cache statistics', JSON.stringify({
			totalKeys: Stats.totalKeys ?? 0,

			memoryUsage: Stats.memoryUsage ? `${(Stats.memoryUsage / BYTES_PER_MEGABYTE).toFixed(2)}MB` : 'unknown',

			hitRate: `${(Stats.hitRate * PERCENTAGE_FACTOR).toFixed(1)}%`,

			missRate: `${((Stats.misses / (Stats.hits + Stats.misses || 1)) * PERCENTAGE_FACTOR).toFixed(1)}%`,
			totalOperations: TotalOps,
			evictions: Stats.evictions,
			errors: Stats.errors,
		}));

		// Log operation timing percentiles
		this.Logger?.info('Cache operation timing percentiles', JSON.stringify({
			get: {
				p50: `${GetP50}ms`,
				p95: `${GetP95}ms`,
				p99: `${GetP99}ms`,
				count: this.Stats.operationTimings.get.length,
			},
			set: {
				p50: `${SetP50}ms`,
				p95: `${SetP95}ms`,
				p99: `${SetP99}ms`,
				count: this.Stats.operationTimings.set.length,
			},
		}));

		// Log eviction reasons if any
		if (Stats.evictions > 0) {
			this.Logger?.info('Cache eviction summary', JSON.stringify({
				totalEvictions: Stats.evictions,
				reasons: Stats.evictionReasons,
			}));
		}

		// Log invalidation patterns if any
		const PatternCount = Object.keys(Stats.invalidationPatterns).length;
		if (PatternCount > 0) {
			this.Logger?.info('Cache invalidation patterns', JSON.stringify({
				patterns: Stats.invalidationPatterns,
				totalPatterns: PatternCount,
			}));
		}
	}

	/**
	 * Record cache eviction event
	 */
	protected RecordEviction(reason: 'TTL' | 'LRU' | 'manual' | 'memory_limit', keysRemoved: number, memoryFreed?: number): void {
		this.Stats.evictions += keysRemoved;
		this.Stats.evictionReasons[reason] = (this.Stats.evictionReasons[reason] ?? 0) + keysRemoved;

		this.Logger?.info('Cache eviction', JSON.stringify({
			reason,
			keysRemoved,
			memoryFreed: memoryFreed ? `${(memoryFreed / BYTES_PER_KILOBYTE).toFixed(0)}KB` : 'unknown',
			totalEvictions: this.Stats.evictions,
		}));
	}

	/**
	 * Record cache warming event
	 */
	protected RecordCacheWarming(keysLoaded: number, durationMs: number): void {
		this.Logger?.info('Cache warming completed', JSON.stringify({
			keysLoaded,
			duration: `${(durationMs / MS_PER_SECOND).toFixed(2)}s`,
			rate: `${(keysLoaded / (durationMs / MS_PER_SECOND)).toFixed(0)} keys/s`,
		}));
	}

	/**
	 * Record cache synchronization event
	 */
	protected RecordCacheSync(source: string, keysSynced: number, durationMs: number): void {
		this.Logger?.info('Cache synchronization completed', JSON.stringify({
			source,
			keysSynced,
			duration: `${(durationMs / MS_PER_SECOND).toFixed(2)}s`,
			rate: `${(keysSynced / (durationMs / MS_PER_SECOND)).toFixed(0)} keys/s`,
		}));
	}

	/**
	 * Update memory usage tracking
	 */
	protected UpdateMemoryUsage(usage: number): void {
		this.Stats.memoryUsage = usage;
		this.MemorySnapshots.push({
			timestamp: new Date(),
			usage,
		});

		// Keep only last CACHE_MEMORY_SNAPSHOT_MAX snapshots
		if (this.MemorySnapshots.length > CACHE_MEMORY_SNAPSHOT_MAX) {
			this.MemorySnapshots.shift();
		}
	}

	/**
	 * Get memory usage trend
	 */
	protected GetMemoryTrend(): { trend: 'increasing' | 'decreasing' | 'stable'; rate: number } {
		if (this.MemorySnapshots.length < 2) {
			return { trend: 'stable', rate: 0 };
		}

		const Recent = this.MemorySnapshots.slice(-CACHE_MEMORY_TREND_WINDOW);
		const [First] = Recent;
		const Last = Recent[Recent.length - 1];

		if (!First || !Last) {
			return { trend: 'stable', rate: 0 };
		}

		const TimeDiff = Last.timestamp.getTime() - First.timestamp.getTime();

		const Rate = (Last.usage - First.usage) / (TimeDiff / MS_PER_SECOND); // bytes per second

		let Trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
		if (Rate > CACHE_MEMORY_TREND_THRESHOLD_BYTES_PER_SEC) { // > 1KB/s increase
			Trend = 'increasing';
		} else if (Rate < -CACHE_MEMORY_TREND_THRESHOLD_BYTES_PER_SEC) { // > 1KB/s decrease
			Trend = 'decreasing';
		}

		return { trend: Trend, rate: Rate };
	}

	/**
	 * Cleanup on module destroy
	 */
	public async onModuleDestroy(): Promise<void> {
		try {
			// Clear periodic cleanup interval
			if (this.CleanupIntervalRef) {
				clearInterval(this.CleanupIntervalRef);
				this.CleanupIntervalRef = undefined;
			}

			// Log final statistics unconditionally on destroy
			const Stats = this.GetStats();
			this.Logger?.info('Cache statistics', JSON.stringify({
				hitRate: `${(Stats.hitRate * PERCENTAGE_FACTOR).toFixed(1)}%`,
				hits: Stats.hits,
				misses: Stats.misses,
				sets: Stats.sets,
				deletes: Stats.deletes,
				clears: Stats.clears,
				errors: Stats.errors,
			}));
			this.Logger?.info('Cache service shutdown', JSON.stringify({
				finalStats: Stats,
				totalOperations: Stats.hits + Stats.misses + Stats.sets + Stats.deletes + Stats.clears,
				hitRatePercent: (Stats.hitRate * PERCENTAGE_FACTOR).toFixed(2),
				operationTimingsSize: this.OperationTimings.size,
			}));

			// Log memory trend
			const MemoryTrend = this.GetMemoryTrend();
			if (MemoryTrend.trend !== 'stable') {
				this.Logger?.info('Final memory trend', JSON.stringify({
					trend: MemoryTrend.trend,
					rate: `${(MemoryTrend.rate / BYTES_PER_KILOBYTE).toFixed(2)} KB/s`,
				}));
			}

			// Log cache size information if available
			try {
				const { store } = (this.CacheManager as any);
				if (store && typeof store.client?.dbsize === 'function') {
					const DbSize = await store.client.dbsize();
					this.Stats.totalKeys = DbSize;
					this.Logger?.info('Redis database size', JSON.stringify({
						keys: DbSize,
					}));
				}
			} catch (error) {
				this.Logger?.debug('Could not retrieve cache size information', JSON.stringify({
					error: (error as Error).message,
				}));
			}

			// Clear memory tracking structures
			this.OperationTimings.clear();
			this.MemorySnapshots = [];
			this.KeyDistribution.clear();
		} catch (error) {
			this.Logger?.error('Error during cache service cleanup', JSON.stringify({
				error: (error as Error).message,
			}));
		}
	}
}
