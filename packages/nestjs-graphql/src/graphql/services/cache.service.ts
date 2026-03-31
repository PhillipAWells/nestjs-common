import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';

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
export class GraphQLCacheService implements ILazyModuleRefService {
	public readonly Module: ModuleRef;
	private readonly CacheStats = {
		hits: 0,
		misses: 0,
	};

	private readonly Logger: IContextualLogger;

	public get CacheManager(): Cache {
		return this.Module.get<Cache>(CACHE_MANAGER, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
		this.Logger = this.AppLogger.createContextualLogger(GraphQLCacheService.name);
	}

	/**
	 * Generates a cache key for GraphQL operations
	 *
	 * @param operation - Operation name (query, mutation, etc.)
	 * @param args - Operation arguments
	 * @param context - Optional context data (user ID, etc.)
	 * @returns string - Generated cache key
	 */
	public GenerateKey(operation: string, args: Record<string, any> = {}, context?: Record<string, any>): string {
		const KeyParts = [`graphql:${operation}`];

		// Add sorted argument keys and values
		const SortedArgs = Object.keys(args).sort();
		for (const Arg of SortedArgs) {
			KeyParts.push(`${Arg}:${JSON.stringify(args[Arg])}`);
		}

		// Add context if provided
		if (context) {
			const SortedContext = Object.keys(context).sort();
			for (const Ctx of SortedContext) {
				KeyParts.push(`${Ctx}:${JSON.stringify(context[Ctx])}`);
			}
		}

		return KeyParts.join('|');
	}

	/**
	 * Sets a value in cache with automatic TTL
	 *
	 * @param key - Cache key
	 * @param value - Value to cache
	 * @param ttl - Time to live in milliseconds (optional, defaults to 5 minutes)
	 * @returns Promise<void>
	 */
	public async Set<T>(key: string, value: T, ttl?: number): Promise<void> {
		try {
			const CacheTtl = ttl ?? DEFAULT_CACHE_TTL;
			await this.CacheManager.set(key, value, CacheTtl);
			this.Logger.debug(`Cached value for key: ${key} (TTL: ${CacheTtl}ms)`);
		} catch (error) {
			this.Logger.error(`Failed to cache value for key ${key}: ${getErrorMessage(error)}`);
			throw error;
		}
	}

	/**
	 * Gets a value from cache with hit/miss tracking
	 *
	 * @param key - Cache key
	 * @returns Promise<T | undefined> - Cached value or undefined
	 */
	public async Get<T>(key: string): Promise<T | undefined> {
		try {
			const Value = await this.CacheManager.get<T>(key);
			if (Value !== null && Value !== undefined) {
				this.CacheStats.hits++;
				this.Logger.debug(`Cache hit for key: ${key} (Hit rate: ${this.GetHitRate().toFixed(2)}%)`);
				return Value;
			}
			this.CacheStats.misses++;
			this.Logger.debug(`Cache miss for key: ${key}`);
			return undefined;
		} catch (error) {
			this.Logger.error(`Failed to get cached value for key ${key}: ${getErrorMessage(error)}`);
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
	public async GetOrSet<T>(key: string, loader: () => Promise<T>, ttl?: number): Promise<T> {
		try {
			const Cached = await this.Get<T>(key);
			if (Cached !== undefined) {
				return Cached;
			}

			const Value = await loader();
			await this.Set(key, Value, ttl);
			return Value;
		} catch (error) {
			this.Logger.error(`Failed in getOrSet for key ${key}: ${getErrorMessage(error)}`);
			throw error;
		}
	}

	/**
	 * Deletes a value from cache
	 *
	 * @param key - Cache key
	 * @returns Promise<void>
	 */
	public async Delete(key: string): Promise<void> {
		try {
			await this.CacheManager.del(key);
			this.Logger.debug(`Deleted cache entry for key: ${key}`);
		} catch (error) {
			this.Logger.error(`Failed to delete cache entry for key ${key}: ${getErrorMessage(error)}`);
			throw error;
		}
	}

	/**
	 * Clears all cache entries
	 *
	 * @returns Promise<void>
	 */
	public async Clear(): Promise<void> {
		try {
			if (typeof (this.CacheManager as any).clear === 'function') {
				await (this.CacheManager as any).clear();
				this.Logger.debug('Cache cleared successfully');
			} else if (typeof (this.CacheManager as any).reset === 'function') {
				await (this.CacheManager as any).reset();
				this.Logger.debug('Cache cleared successfully');
			} else {
				this.Logger.warn('Cache clear not supported by current store, skipping');
			}
		} catch (error) {
			this.Logger.error(`Failed to clear cache: ${getErrorMessage(error)}`);
			throw error;
		}
	}

	/**
	 * Invalidates cache entries matching a pattern
	 *
	 * @param pattern - Pattern to match (e.g., 'graphql:user|id:*')
	 * @returns Promise<void>
	 */
	public async InvalidatePattern(pattern: string): Promise<void> {
		try {
			const CacheManager = this.CacheManager as any;
			// Check if store is Redis-like with scan capabilities
			if (CacheManager?.store?.getClient && typeof CacheManager.store.getClient === 'function') {
				const Client = CacheManager.store.getClient();
				if (Client && typeof Client.scan === 'function') {
					// Use Redis SCAN to find and delete matching keys
					const REDIS_SCAN_COUNT = 100;
					let Cursor = '0';
					let TotalDeleted = 0;
					do {
						const [NextCursor, Keys] = await Client.scan(Cursor, 'MATCH', pattern, 'COUNT', REDIS_SCAN_COUNT) as [string, string[]];
						Cursor = NextCursor;
						if (Keys.length > 0) {
							await Client.del(...Keys);
							TotalDeleted += Keys.length;
						}
					} while (Cursor !== '0');
					this.Logger.debug(`Invalidated ${TotalDeleted} cache entries matching pattern: ${pattern}`);
					return;
				}
			}
			// Fallback: try store-specific methods
			if (typeof (CacheManager as any).reset === 'function') {
				await (CacheManager as any).reset();
				this.Logger.warn(`Pattern invalidation for '${pattern}' fell back to clearing entire cache`);
				return;
			}
			this.Logger.warn(`Pattern invalidation not supported for this cache store. Pattern: ${pattern}`);
		} catch (error) {
			this.Logger.error(`Failed to invalidate pattern ${pattern}: ${getErrorMessage(error)}`);
		}
	}

	/**
	 * Resets cache statistics (hits and misses)
	 */
	public ResetStats(): void {
		this.CacheStats.hits = 0;
		this.CacheStats.misses = 0;
		this.Logger.debug('Cache statistics reset');
	}

	/**
	 * Calculates cache hit rate
	 * @returns Hit rate as percentage (0-100)
	 */
	private GetHitRate(): number {
		const Total = this.CacheStats.hits + this.CacheStats.misses;
		if (Total === 0) return 0;
		return (this.CacheStats.hits / Total) * HIT_RATE_PERCENTAGE;
	}

	/**
	 * Gets comprehensive cache statistics
	 *
	 * @returns Object with cache statistics including hit rate
	 */
	public GetStats(): ICacheStats {
		return {
			hits: this.CacheStats.hits,
			misses: this.CacheStats.misses,
			hitRate: this.GetHitRate(),
			size: 0, // Redis would provide this
			store: 'CacheManager',
		};
	}
}
