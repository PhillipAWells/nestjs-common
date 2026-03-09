import { SetMetadata } from '@nestjs/common';

/**
 * Shared cache metadata keys
 * @internal
 */
const CACHE_METADATA_KEYS = {
	CACHEABLE: 'cacheable',
	CACHE_INVALIDATE: 'cache-invalidate',
	CACHE_EVICT: 'cache-evict',
} as const;

/**
 * Base cacheable options interface
 * @internal
 */
interface BaseCacheableOptions {
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
 * GraphQL-specific cacheable decorator options
 *
 * Extends base cacheable options with GraphQL-specific features
 */
export interface CacheableOptions extends BaseCacheableOptions {
	/**
	 * Custom cache key generator function with GraphQL context
	 */
	keyGenerator?: (args: any[], context: any) => string;

	/**
	 * Cache condition function with GraphQL context
	 */
	condition?: (result: any, args: any[], context: any) => boolean;

	/**
	 * Whether to cache null/undefined results
	 * @default false
	 */
	cacheNulls?: boolean;
}

/**
 * Cacheable decorator for GraphQL resolvers
 *
 * Caches the result of a resolver based on its arguments and context.
 * Uses the GraphqlCacheInterceptor to handle caching logic.
 *
 * @param options - Caching options
 *
 * @example
 * ```typescript
 * @Cacheable({ ttl: 300000 }) // 5 minutes
 * @Query(() => User)
 * async getUser(@Args('id') id: string): Promise<User> {
 *   return this.userService.findById(id);
 * }
 *
 * @Cacheable({
 *   ttl: 60000, // 1 minute
 *   condition: (result) => result !== null // Don't cache null results
 * })
 * @Query(() => [Post])
 * async getPosts(@Args('userId') userId: string): Promise<Post[]> {
 *   return this.postService.findByUser(userId);
 * }
 * ```
 */
export const Cacheable = (options: CacheableOptions = {}) => SetMetadata(CACHE_METADATA_KEYS.CACHEABLE, options);

/**
 * Metadata key for cacheable configuration
 * @deprecated Use CACHE_METADATA_KEYS.CACHEABLE from @pawells/nestjs-cache instead
 */
export const CACHEABLE_METADATA = CACHE_METADATA_KEYS.CACHEABLE;
