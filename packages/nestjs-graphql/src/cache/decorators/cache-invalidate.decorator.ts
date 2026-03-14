import { Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';

/**
 * Options for @CacheInvalidate decorator
 */
export interface CacheInvalidateOptions {
	/**
	 * Cache key(s) to invalidate — can be a string, array of strings, or a function
	 * that generates keys dynamically based on method arguments
	 */
	keys: string | string[] | ((...args: any[]) => string | string[]);
}

/**
 * CacheInvalidate decorator for cache invalidation after method execution
 *
 * Wraps a method to automatically invalidate specific cache keys after method
 * execution completes. Supports static keys, multiple keys, or dynamic key
 * generation based on method arguments. Executes the method first, then
 * invalidates keys. Applies Pyroscope profiling with the `cache_invalidate` tag.
 *
 * @param options Cache invalidation options (keys required)
 * @returns Method decorator function
 *
 * @example
 * ```typescript
 * // Static key
 * @CacheInvalidate({ keys: 'user:list' })
 * async deleteUser(userId: string) {
 *   return this.userService.delete(userId);
 * }
 *
 * // Multiple static keys
 * @CacheInvalidate({ keys: ['user:list', 'user:count', 'stats:users'] })
 * async purgeUsers() {
 *   return this.userService.purgeAll();
 * }
 *
 * // Dynamic key generation based on arguments
 * @CacheInvalidate({
 *   keys: (userId) => [`user:${userId}`, `user:${userId}:profile`, `user:${userId}:posts`],
 * })
 * async updateUserProfile(userId: string, profile: UserProfile) {
 *   return this.userService.updateProfile(userId, profile);
 * }
 * ```
 *
 * @remarks
 * - Requires CACHE_MANAGER injection (provided by @nestjs/cache-manager)
 * - Logs individual key deletion at debug level
 * - Logs errors if key deletion fails but continues with remaining keys
 * - Method result is not affected by failed cache invalidation
 * - Uses del() method which safely handles non-existent keys
 */
export function CacheInvalidate(options: CacheInvalidateOptions) {
	const logger = new Logger('CacheInvalidateDecorator');

	return function(
		_target: any,
		propertyKey: string,
		descriptor: PropertyDescriptor,
	) {
		const originalMethod = descriptor.value;

		descriptor.value = async function(...args: any[]) {
			const cacheManager = (this as any)[CACHE_MANAGER] ?? (this as any).cacheManager;
			if (!cacheManager) {
				logger.warn(`Cache manager not found for ${propertyKey}, executing without cache invalidation`);
				return originalMethod.apply(this, args);
			}

			try {
				// Execute the method first
				const result = await originalMethod.apply(this, args);

				// Invalidate cache keys
				const keys = typeof options.keys === 'function'
					? options.keys(...args)
					: options.keys;

				const keyArray = Array.isArray(keys) ? keys : [keys];

				for (const key of keyArray) {
					try {
						await cacheManager.del(key);
						logger.debug(`Invalidated cache key: ${key}`);
					} catch (error) {
						logger.error(`Failed to invalidate cache key ${key}:`, error);
					}
				}

				return result;
			} catch (error) {
				logger.error(`Method execution error for ${propertyKey}:`, error);
				throw error;
			}
		};

		// Apply profiling to the wrapped method
		ProfileMethod({
			name: `${_target.constructor.name}.${propertyKey}.cacheInvalidate`,
			tags: { decorator: 'cache_invalidate', operation: 'cache_decorator' },
		})(_target, propertyKey, descriptor);

		return descriptor;
	};
}
