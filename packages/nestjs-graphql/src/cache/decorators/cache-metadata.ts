/**
 * Base cache decorator interfaces and metadata keys
 *
 * These provide the foundation for cache decorators across different packages.
 * GraphQL-specific decorators can extend these interfaces and use the same metadata keys.
 */

/**
 * Base options for cacheable operations
 */
export interface BaseCacheableOptions {
	/**
	 * Cache TTL in milliseconds
	 * @default 300000 (5 minutes)
	 */
	ttl?: number;

	/**
	 * Custom cache key generator function
	 */
	keyGenerator?: (...args: any[]) => string;

	/**
	 * Cache condition function - return false to skip caching
	 */
	condition?: (...args: any[]) => boolean;
}

/**
 * Base options for cache invalidation operations
 */
export interface BaseCacheInvalidateOptions {
	/**
	 * Cache keys or patterns to invalidate
	 */
	keys?: string | string[];

	/**
	 * Custom key generator function
	 */
	keyGenerator?: (...args: any[]) => string | string[];
}

/**
 * Metadata keys for cache decorators
 */
export const CACHE_METADATA_KEYS = {
	CACHEABLE: 'cacheable',
	CACHE_INVALIDATE: 'cache-invalidate',
	CACHE_EVICT: 'cache-evict'
} as const;

/**
 * Type for cache metadata keys
 */
export type CacheMetadataKey = typeof CACHE_METADATA_KEYS[keyof typeof CACHE_METADATA_KEYS];
