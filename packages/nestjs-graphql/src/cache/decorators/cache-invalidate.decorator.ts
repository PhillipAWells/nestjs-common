import { Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';

/**
 * Options for @CacheInvalidate decorator
 */
export interface CacheInvalidateOptions {
	keys: string | string[] | ((...args: any[]) => string | string[]);
}

/**
 * CacheInvalidate decorator for cache invalidation after method execution
 * @param options Cache invalidation options
 * @returns Method decorator
 */
export function CacheInvalidate(options: CacheInvalidateOptions) {
	const logger = new Logger('CacheInvalidateDecorator');

	return function(
		_target: any,
		propertyKey: string,
		descriptor: PropertyDescriptor
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
					}
					catch (error) {
						logger.error(`Failed to invalidate cache key ${key}:`, error);
					}
				}

				return result;
			}
			catch (error) {
				logger.error(`Method execution error for ${propertyKey}:`, error);
				throw error;
			}
		};

		// Apply profiling to the wrapped method
		ProfileMethod({
			name: `${_target.constructor.name}.${propertyKey}.cacheInvalidate`,
			tags: { decorator: 'cache_invalidate', operation: 'cache_decorator' }
		})(_target, propertyKey, descriptor);

		return descriptor;
	};
}
