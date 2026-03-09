import { Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

/**
 * Options for @CacheEvict decorator
 */
export interface CacheEvictOptions {
	pattern: string;
}

/**
 * CacheEvict decorator for pattern-based cache eviction after method execution
 * @param options Cache eviction options
 * @returns Method decorator
 */
export function CacheEvict(options: CacheEvictOptions) {
	const logger = new Logger('CacheEvictDecorator');

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
					logger.error(`Failed to evict cache pattern ${options.pattern}:`, error);
				}

				return result;
			} catch (error) {
				logger.error(`Method execution error for ${propertyKey}:`, error);
				throw error;
			}
		};

		return descriptor;
	};
}
