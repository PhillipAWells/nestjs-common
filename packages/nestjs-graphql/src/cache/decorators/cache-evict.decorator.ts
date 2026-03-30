import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AppLogger, getErrorStack } from '@pawells/nestjs-shared/common';

/**
 * Options for @CacheEvict decorator
 */
export interface ICacheEvictOptions {
	/**
	 * Redis glob pattern to match cache keys for eviction
	 * Examples: `user:*`, `post:123:*`, `*:comments`
	 */
	pattern: string;
}

/**
 * CacheEvict decorator for pattern-based cache eviction after method execution
 *
 * Wraps a method to automatically evict cached values matching a pattern after
 * method execution completes. Useful for mutations that invalidate related cached data.
 * Executes the method first, then evicts matching keys. Fails gracefully if
 * pattern-based eviction is not supported by the cache store.
 *
 * @param options Cache eviction options (pattern required)
 * @returns Method decorator function
 *
 * @example
 * ```typescript
 * @CacheEvict({ pattern: 'user:*' })
 * async updateUser(userId: string, data: UpdateUserDto) {
 *   return this.userService.update(userId, data);
 * }
 *
 * // Specific post and its comments
 * @CacheEvict({ pattern: 'post:123:*' })
 * async updatePost(postId: string, data: UpdatePostDto) {
 *   return this.postService.update(postId, data);
 * }
 * ```
 *
 * @remarks
 * - Requires CACHE_MANAGER injection (provided by @nestjs/cache-manager)
 * - Pattern matching depends on cache store support (Redis supports glob patterns)
 * - Eviction happens after method execution, so the method's result is not affected
 * - Logs warnings if store doesn't support pattern-based eviction
 */
export function CacheEvict(options: ICacheEvictOptions) {
	const logger = new AppLogger(undefined, 'CacheEvictDecorator');

	return function(
		_target: any,
		propertyKey: string,
		descriptor: PropertyDescriptor,
	) {
		const originalMethod = descriptor.value;

		descriptor.value = async function(...args: any[]) {
			const cacheManager = (this as any)[CACHE_MANAGER] ?? (this as any).cacheManager;
			if (!cacheManager) {
				logger.warn(`Cache manager not found for ${propertyKey}, executing without cache eviction`);
				return originalMethod.apply(this, args);
			}

			try {
				// Execute the method first
				const result = await originalMethod.apply(this, args);

				// Evict cache keys matching pattern
				try {
					const { store } = (cacheManager as any);
					if (store && typeof store.keys === 'function') {
						const keys = await store.keys(options.pattern);
						if (keys && keys.length > 0) {
							for (const key of keys) {
								await cacheManager.del(key);
							}
							logger.debug(`Evicted ${keys.length} cache keys matching pattern: ${options.pattern}`);
						} else {
							logger.debug(`No cache keys found matching pattern: ${options.pattern}`);
						}
					} else {
						logger.warn(`Store does not support pattern-based eviction for pattern: ${options.pattern}`);
					}
				} catch (error) {
					logger.error(`Failed to evict cache pattern ${options.pattern}:`, getErrorStack(error));
				}

				return result;
			} catch (error) {
				logger.error(`Method execution error for ${propertyKey}:`, getErrorStack(error));
				throw error;
			}
		};

		return descriptor;
	};
}
