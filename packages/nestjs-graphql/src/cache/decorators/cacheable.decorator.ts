import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';
import { AppLogger, getErrorStack } from '@pawells/nestjs-shared/common';

/**
 * Options for @Cacheable decorator
 */
export interface ICacheableOptions {
	/**
	 * Cache key — either a constant string or a function to generate keys dynamically
	 * Default: `${ClassName}:${methodName}`
	 */
	key?: string | ((...args: any[]) => string);

	/**
	 * Time-to-live for the cached value in milliseconds
	 */
	ttl?: number;

	/**
	 * Optional condition function to determine if caching should occur
	 * Called with method arguments; caching skipped if returns false
	 */
	condition?: (...args: any[]) => boolean;
}

/**
 * Cacheable decorator for automatic method result caching
 *
 * Wraps a method to automatically cache its return value using the injected cache manager.
 * On cache hit, returns the cached value. On cache miss, executes the method, caches
 * the result, and returns it. Falls back to executing the method if cache manager is
 * unavailable. Applies Pyroscope profiling with the `cacheable` tag.
 *
 * @param options Cache options (key, ttl, condition)
 * @returns Method decorator function
 *
 * @example
 * ```typescript
 * @Cacheable({ key: 'user:profile', ttl: 300000 })
 * async getUserProfile(userId: string) {
 *   return this.userService.getProfile(userId);
 * }
 *
 * // Dynamic key based on arguments
 * @Cacheable({
 *   key: (userId) => `user:${userId}:profile`,
 *   ttl: 600000,
 *   condition: (userId) => userId !== 'admin',
 * })
 * async getUserProfile(userId: string) {
 *   return this.userService.getProfile(userId);
 * }
 * ```
 *
 * @remarks
 * - Requires CACHE_MANAGER injection (provided by @nestjs/cache-manager)
 * - Falls back gracefully if cache is unavailable
 * - Async-safe; works with async/await methods
 */
export function Cacheable(options: ICacheableOptions = {}) {
	const Logger = new AppLogger(undefined, 'CacheableDecorator');

	return function(
		target: any,
		propertyKey: string,
		descriptor: PropertyDescriptor,
	) {
		const OriginalMethod = descriptor.value;
		const CacheKeyFn = typeof options.key === 'function' ? options.key : () => options.key ?? `${target.constructor.name}:${propertyKey}`;

		descriptor.value = async function(...args: any[]) {
			// Check condition if provided
			if (options.condition && !options.condition(...args)) {
				return OriginalMethod.apply(this, args);
			}

			const CacheManager = (this as any)[CACHE_MANAGER] ?? (this as any).cacheManager;
			if (!CacheManager) {
				Logger.warn(`Cache manager not found for ${propertyKey}, executing without cache`);
				return OriginalMethod.apply(this, args);
			}

			const CacheKey = CacheKeyFn(...args);

			try {
				// Try to get from cache
				const Cached = await CacheManager.get(CacheKey);
				if (Cached !== null && Cached !== undefined) {
					Logger.debug(`Cache hit for ${CacheKey}`);
					return Cached;
				}

				// Execute method and cache result
				const Result = await OriginalMethod.apply(this, args);
				await CacheManager.set(CacheKey, Result, options.ttl);
				Logger.debug(`Cache miss for ${CacheKey}, stored result`);

				return Result;
			} catch (error) {
				Logger.error(`Cache error for ${CacheKey}:`, getErrorStack(error));
				// Fallback to original method
				return OriginalMethod.apply(this, args);
			}
		};

		// Apply profiling to the wrapped method
		ProfileMethod({
			name: `${target.constructor.name}.${propertyKey}.cacheable`,
			tags: { decorator: 'cacheable', operation: 'cache_decorator' },
		})(target, propertyKey, descriptor);

		return descriptor;
	};
}
