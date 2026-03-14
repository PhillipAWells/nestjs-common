/**
 * Cache provider interface for token blacklisting and caching
 * Decouples auth module from specific cache implementations (Redis, memory, etc)
 *
 * This interface allows auth module to work with any cache backend
 * without creating circular dependencies with GraphQL module
 */
export interface ICacheProvider {
	/**
	 * Set a cache value with optional TTL
	 * @param key Cache key
	 * @param value Value to cache
	 * @param ttlSeconds Time-to-live in seconds (optional)
	 */
	set(key: string, value: any, ttlSeconds?: number): Promise<void>;

	/**
	 * Get a cache value
	 * @param key Cache key
	 * @returns Cached value or null if not found
	 */
	get(key: string): Promise<any>;

	/**
	 * Check if a key exists in cache
	 * @param key Cache key
	 * @returns True if key exists
	 */
	exists(key: string): Promise<boolean>;

	/**
	 * Delete a cache value
	 * @param key Cache key
	 */
	del(key: string): Promise<void>;

	/**
	 * Clear all cache values
	 */
	clear(): Promise<void>;

	/**
	 * Execute an atomic script/command (e.g. Redis Lua script) on the cache backend.
	 * This is optional — implementations backed by Redis should provide it;
	 * in-memory or other backends may leave it undefined.
	 *
	 * @param script The script to execute (Lua for Redis)
	 * @param keys Array of cache keys the script operates on
	 * @param args Array of string arguments passed to the script
	 * @returns The result from the script execution
	 */
	executeScript?(script: string, keys: readonly string[], args: readonly string[]): Promise<unknown>;
}

/**
 * Token for injecting cache provider
 * Used in AuthModule and services that need caching
 */
export const CACHE_PROVIDER = Symbol('CACHE_PROVIDER');
