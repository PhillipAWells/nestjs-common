import { Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';

/**
 * Options for @Cacheable decorator
 */
export interface CacheableOptions {
	key?: string | ((...args: any[]) => string);
	ttl?: number;
	condition?: (...args: any[]) => boolean;
}

/**
 * Cacheable decorator for automatic method result caching
 * @param options Cache options
 * @returns Method decorator
 */
export function Cacheable(options: CacheableOptions = {}) {
	const logger = new Logger('CacheableDecorator');

	return function(
		target: any,
		propertyKey: string,
		descriptor: PropertyDescriptor
	) {
		const originalMethod = descriptor.value;
		const cacheKeyFn = typeof options.key === 'function' ? options.key : () => options.key ?? `${target.constructor.name}:${propertyKey}`;

		descriptor.value = async function(...args: any[]) {
			// Check condition if provided
			if (options.condition && !options.condition(...args)) {
				return originalMethod.apply(this, args);
			}

			const cacheManager = (this as any)[CACHE_MANAGER] ?? (this as any).cacheManager;
			if (!cacheManager) {
				logger.warn(`Cache manager not found for ${propertyKey}, executing without cache`);
				return originalMethod.apply(this, args);
			}

			const cacheKey = cacheKeyFn(...args);

			try {
				// Try to get from cache
				const cached = await cacheManager.get(cacheKey);
				if (cached !== null && cached !== undefined) {
					logger.debug(`Cache hit for ${cacheKey}`);
					return cached;
				}

				// Execute method and cache result
				const result = await originalMethod.apply(this, args);
				await cacheManager.set(cacheKey, result, options.ttl);
				logger.debug(`Cache miss for ${cacheKey}, stored result`);

				return result;
			}
			catch (error) {
				logger.error(`Cache error for ${cacheKey}:`, error);
				// Fallback to original method
				return originalMethod.apply(this, args);
			}
		};

		// Apply profiling to the wrapped method
		ProfileMethod({
			name: `${target.constructor.name}.${propertyKey}.cacheable`,
			tags: { decorator: 'cacheable', operation: 'cache_decorator' }
		})(target, propertyKey, descriptor);

		return descriptor;
	};
}
