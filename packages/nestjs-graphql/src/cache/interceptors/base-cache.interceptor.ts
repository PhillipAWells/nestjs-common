import {
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Observable, of, from } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { ModuleRef } from '@nestjs/core';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';
import { CACHE_INTERCEPTOR_DEFAULT_TTL, CACHE_ETAG_BASE64_SUBSTRING_LENGTH } from '../constants/cache-config.constants.js';

/**
 * Interface for cache key generation strategies
 */
export interface CacheKeyGenerator {
	generate(context: ExecutionContext, options?: any): string;
}

/**
 * Interface for cache metadata extraction
 */
export interface CacheMetadataExtractor {
	getCacheDisabled(context: ExecutionContext): boolean;
	getCacheTtl(context: ExecutionContext): number | undefined;
}

/**
 * Interface for context-specific cache operations
 */
export interface CacheContextHandler {
	setCacheHeaders(context: ExecutionContext, hit: boolean, ttl?: number): void;
	shouldCacheRequest(context: ExecutionContext): boolean;
}

/**
 * Base caching interceptor providing shared caching functionality
 *
 * This abstract class implements the core caching logic while allowing
 * subclasses to provide context-specific behavior through strategy interfaces.
 */
@Injectable()
export abstract class BaseCacheInterceptor implements NestInterceptor, LazyModuleRefService {
	public readonly Module: ModuleRef;
	protected logger: AppLogger | null = null;

	public get CacheManager(): Cache {
		return this.Module.get<Cache>(CACHE_MANAGER, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	protected getLogger(): AppLogger {
		this.logger ??= this.AppLogger.createContextualLogger(BaseCacheInterceptor.name);
		return this.logger;
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
	 * Abstract method to get cache key generator
	 */
	protected abstract getCacheKeyGenerator(): CacheKeyGenerator;

	/**
	 * Abstract method to get cache metadata extractor
	 */
	protected abstract getCacheMetadataExtractor(): CacheMetadataExtractor;

	/**
	 * Abstract method to get context handler
	 */
	protected abstract getCacheContextHandler(): CacheContextHandler;

	/**
	 * Main interception logic
	 */
	@ProfileMethod({
		name: 'BaseCacheInterceptor.intercept',
		tags: { interceptor: 'cache', operation: 'http_cache' },
	})
	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const contextHandler = this.getCacheContextHandler();

		// Check if this request should be cached
		if (!contextHandler.shouldCacheRequest(context)) {
			return next.handle();
		}

		const metadataExtractor = this.getCacheMetadataExtractor();

		// Check if caching is disabled for this route/resolver
		if (metadataExtractor.getCacheDisabled(context)) {
			return next.handle();
		}

		// Generate cache key
		const keyGenerator = this.getCacheKeyGenerator();
		const cacheKey = keyGenerator.generate(context);

		// Get TTL from metadata or use default
		const ttl = metadataExtractor.getCacheTtl(context) ?? CACHE_INTERCEPTOR_DEFAULT_TTL; // 5 minutes default

		// Check cache
		return from(this.CacheManager.get(cacheKey)).pipe(
			switchMap((cachedResponse) => {
				if (cachedResponse !== null && cachedResponse !== undefined) {
					this.getLogger().debug(`Cache hit for ${cacheKey}`);
					contextHandler.setCacheHeaders(context, true, ttl);
					return of(cachedResponse);
				}

				this.getLogger().debug(`Cache miss for ${cacheKey}`);
				contextHandler.setCacheHeaders(context, false);

				// Execute handler and cache response
				return next.handle().pipe(
					tap(async (data) => {
						try {
							await this.CacheManager.set(cacheKey, data, ttl);
							this.getLogger().debug(`Cached response for ${cacheKey} (TTL: ${ttl}s)`);
						} catch (error) {
							this.getLogger().error(`Failed to cache response for ${cacheKey}:`, error as string);
						}
					}),
				);
			}),
		);
	}

	/**
	 * Generate ETag from response data
	 */
	protected generateETag(data: any): string {
		const content = JSON.stringify(data);
		return `"${Buffer.from(content).toString('base64').substring(0, CACHE_ETAG_BASE64_SUBSTRING_LENGTH)}"`;
	}

	/**
	 * Sort object keys for consistent cache keys
	 */
	protected sortObject(obj: any): any {
		if (!obj || typeof obj !== 'object') return obj;
		if (Array.isArray(obj)) return obj.map(this.sortObject.bind(this));

		const sorted: any = {};
		Object.keys(obj)
			.sort()
			.forEach((key) => {
				sorted[key] = this.sortObject(obj[key]);
			});

		return sorted;
	}
}
