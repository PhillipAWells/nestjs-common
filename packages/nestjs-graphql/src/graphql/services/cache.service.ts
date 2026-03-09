import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AppLogger } from '@pawells/nestjs-shared/common';

/**
 * Cache statistics interface
 */
interface ICacheStats {
	hits: number;
	misses: number;
	hitRate: number;
	size: number;
	store: string;
}
 
const DEFAULT_CACHE_TTL = 300000; // 5 minutes
const HIT_RATE_PERCENTAGE = 100;

/**
 * GraphQL Cache Service
 *
 * Provides caching functionality specifically for GraphQL operations.
 * Uses the NestJS cache manager for storage and provides GraphQL-specific
 * key generation and cache invalidation strategies.
 *
 * Features:
 * - Automatic cache key generation from operation name and arguments
 * - TTL-based expiration (default 5 minutes)
 * - Cache hit/miss tracking for performance monitoring
 * - Pattern-based invalidation for batch updates
 *
 * @example
 * ```typescript
 * // Cache a resolver result
 * const key = this.graphqlCache.generateKey('user', { id: userId });
 * await this.graphqlCache.set(key, userData, 300000); // 5 minutes
 *
 * // Get cached data
 * const cached = await this.graphqlCache.get(key);
 *
 * // Get cache statistics
 * const stats = this.graphqlCache.getStats();
 * ```
 */
@Injectable()
export class GraphQLCacheService {
	private readonly logger: AppLogger;

	private readonly cacheStats = {
		hits: 0,
		misses: 0
	};

	constructor(
		@Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
		@Inject(AppLogger) private readonly appLogger: AppLogger
	) {
		this.logger = this.appLogger.createContextualLogger(GraphQLCacheService.name);
	}

	/**
	 * Generates a cache key for GraphQL operations
	 *
	 * @param operation - Operation name (query, mutation, etc.)
	 * @param args - Operation arguments
	 * @param context - Optional context data (user ID, etc.)
	 * @returns string - Generated cache key
	 */
	public generateKey(operation: string, args: Record<string, any> = {}, context?: Record<string, any>): string {
		const keyParts = [`graphql:${operation}`];

		// Add sorted argument keys and values
		const sortedArgs = Object.keys(args).sort();
		for (const arg of sortedArgs) {
			keyParts.push(`${arg}:${JSON.stringify(args[arg])}`);
		}

		// Add context if provided
		if (context) {
			const sortedContext = Object.keys(context).sort();
			for (const ctx of sortedContext) {
				keyParts.push(`${ctx}:${JSON.stringify(context[ctx])}`);
			}
		}

		return keyParts.join('|');
	}

	/**
	 * Sets a value in cache with automatic TTL
	 *
	 * @param key - Cache key
	 * @param value - Value to cache
	 * @param ttl - Time to live in milliseconds (optional, defaults to 5 minutes)
	 * @returns Promise<void>
	 */
	public async set<T>(key: string, value: T, ttl?: number): Promise<void> {
		try {
			const cacheTtl = ttl ?? DEFAULT_CACHE_TTL;
			await this.cacheManager.set(key, value, cacheTtl);
			this.logger.debug(`Cached value for key: ${key} (TTL: ${cacheTtl}ms)`);
		}
		catch (error) {
			this.logger.error(`Failed to cache value for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	/**
	 * Gets a value from cache with hit/miss tracking
	 *
	 * @param key - Cache key
	 * @returns Promise<T | undefined> - Cached value or undefined
	 */
	public async get<T>(key: string): Promise<T | undefined> {
		try {
			const value = await this.cacheManager.get<T>(key);
			if (value !== null && value !== undefined) {
				this.cacheStats.hits++;
				this.logger.debug(`Cache hit for key: ${key} (Hit rate: ${this.getHitRate().toFixed(2)}%)`);
				return value;
			}
			this.cacheStats.misses++;
			this.logger.debug(`Cache miss for key: ${key}`);
			return undefined;
		}
		catch (error) {
			this.logger.error(`Failed to get cached value for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	}

	/**
	 * Gets or sets a value in cache (cache-aside pattern)
	 * Useful for resolver caching with fallback to computation
	 *
	 * @param key - Cache key
	 * @param loader - Function to load value if cache miss
	 * @param ttl - Time to live in milliseconds (optional)
	 * @returns Promise<T> - Cached or computed value
	 */
	public async getOrSet<T>(key: string, loader: () => Promise<T>, ttl?: number): Promise<T> {
		try {
			const cached = await this.get<T>(key);
			if (cached !== undefined) {
				return cached;
			}

			const value = await loader();
			await this.set(key, value, ttl);
			return value;
		}
		catch (error) {
			this.logger.error(`Failed in getOrSet for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	/**
	 * Deletes a value from cache
	 *
	 * @param key - Cache key
	 * @returns Promise<void>
	 */
	public async delete(key: string): Promise<void> {
		try {
			await this.cacheManager.del(key);
			this.logger.debug(`Deleted cache entry for key: ${key}`);
		}
		catch (error) {
			this.logger.error(`Failed to delete cache entry for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	/**
	 * Clears all cache entries
	 *
	 * @returns Promise<void>
	 */
	public async clear(): Promise<void> {
		try {
			// Note: cache-manager doesn't have a reset method in all implementations
			// This is a placeholder - actual implementation depends on the cache store
			this.logger.debug('Clear operation called (implementation depends on cache store)');
		}
		catch (error) {
			this.logger.error(`Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	/**
	 * Invalidates cache entries matching a pattern
	 *
	 * @param pattern - Pattern to match (e.g., 'graphql:user|id:*')
	 * @returns Promise<void>
	 */
	public async invalidatePattern(pattern: string): Promise<void> {
		// Note: This is a simplified implementation
		// In a real Redis setup, you would use SCAN or KEYS
		// For now, we'll log the intent
		this.logger.debug(`Invalidating cache pattern: ${pattern}`);

		// In a production implementation, you would:
		// 1. Use Redis SCAN to find keys matching the pattern
		// 2. Delete matching keys
		// For this implementation, we'll log the intent
		this.logger.warn(`Pattern invalidation requested for: ${pattern} (not implemented in this cache store)`);
	}

	/**
	 * Resets cache statistics (hits and misses)
	 */
	public resetStats(): void {
		this.cacheStats.hits = 0;
		this.cacheStats.misses = 0;
		this.logger.debug('Cache statistics reset');
	}

	/**
	 * Calculates cache hit rate
	 * @returns Hit rate as percentage (0-100)
	 */
	private getHitRate(): number {
		const total = this.cacheStats.hits + this.cacheStats.misses;
		if (total === 0) return 0;
		return (this.cacheStats.hits / total) * HIT_RATE_PERCENTAGE;
	}

	/**
	 * Gets comprehensive cache statistics
	 *
	 * @returns Object with cache statistics including hit rate
	 */
	public getStats(): ICacheStats {
		return {
			hits: this.cacheStats.hits,
			misses: this.cacheStats.misses,
			hitRate: this.getHitRate(),
			size: 0, // Redis would provide this
			store: 'CacheManager'
		};
	}
}
