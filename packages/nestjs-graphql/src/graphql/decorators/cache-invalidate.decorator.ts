import { SetMetadata } from '@nestjs/common';
import { CACHE_METADATA_KEYS } from './cacheable.decorator.js';

/**
 * Base cache invalidate options interface
 * @internal
 */
interface IBaseCacheInvalidateOptions {
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
 * GraphQL-specific cache invalidate decorator options
 *
 * Extends base cache invalidate options with GraphQL-specific features
 */
export interface ICacheInvalidateOptions extends IBaseCacheInvalidateOptions {
	/**
	 * Cache key patterns to invalidate
	 * Supports wildcards and dynamic key generation
	 */
	patterns?: string[];

	/**
	 * Custom key generator function for dynamic patterns
	 */
	keyGenerator?: (args: any[], context: any, result: any) => string[];

	/**
	 * Whether to invalidate before or after execution
	 * @default 'after'
	 */
	when?: 'before' | 'after';

	/**
	 * Condition function - return false to skip invalidation
	 */
	condition?: (result: any, args: any[], context: any) => boolean;
}

/**
 * Cache Invalidate decorator for GraphQL resolvers
 *
 * Invalidates cache entries matching specified patterns when a resolver executes.
 * Uses the GraphqlCacheInterceptor to handle invalidation logic.
 *
 * @param options - Invalidation options
 *
 * @example
 * ```typescript
 * @CacheInvalidate({
 *   patterns: ['graphql:user|id:*'], // Invalidate all user queries by ID
 *   when: 'after' // Invalidate after successful execution
 * })
 * @Mutation(() => IUser, { name: 'UpdateUser' })
 * async updateUser(@Args('input') input: UpdateUserInput): Promise<IUser> {
 *   return this.userService.update(input.id, input);
 * }
 *
 * @CacheInvalidate({
 *   patterns: ['graphql:posts', 'graphql:userPosts|userId:*'],
 *   condition: (result) => result !== null // Only invalidate if successful
 * })
 * @Mutation(() => Boolean, { name: 'DeletePost' })
 * async deletePost(@Args('id') id: string): Promise<boolean> {
 *   return this.postService.delete(id);
 * }
 * ```
 */
export const CacheInvalidate = (options: ICacheInvalidateOptions): ReturnType<typeof SetMetadata> => SetMetadata(CACHE_METADATA_KEYS.CACHE_INVALIDATE, options);

/**
 * Metadata key for cache invalidation configuration
 * @deprecated Use CACHE_METADATA_KEYS.CACHE_INVALIDATE from @pawells/nestjs-cache instead
 */
export const CACHE_INVALIDATE_METADATA = CACHE_METADATA_KEYS.CACHE_INVALIDATE;
