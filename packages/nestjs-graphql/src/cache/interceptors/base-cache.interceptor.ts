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
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';
import { CACHE_INTERCEPTOR_DEFAULT_TTL, CACHE_ETAG_BASE64_SUBSTRING_LENGTH } from '../constants/cache-config.constants.js';

/**
 * Interface for cache key generation strategies
 */
export interface ICacheKeyGenerator {
	Generate(context: ExecutionContext, options?: any): string;
}

/**
 * Interface for cache metadata extraction
 */
export interface ICacheMetadataExtractor {
	GetCacheDisabled(context: ExecutionContext): boolean;
	GetCacheTtl(context: ExecutionContext): number | undefined;
}

/**
 * Interface for context-specific cache operations
 */
export interface ICacheContextHandler {
	SetCacheHeaders(context: ExecutionContext, hit: boolean, ttl?: number): void;
	ShouldCacheRequest(context: ExecutionContext): boolean;
}

/**
 * Base caching interceptor providing shared caching functionality
 *
 * This abstract class implements the core caching logic while allowing
 * subclasses to provide context-specific behavior through strategy interfaces.
 */
@Injectable()
export abstract class BaseCacheInterceptor implements NestInterceptor, ILazyModuleRefService {
	public readonly Module: ModuleRef;
	protected Logger: IContextualLogger | null = null;

	public get CacheManager(): Cache {
		return this.Module.get<Cache>(CACHE_MANAGER, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	protected GetLogger(): IContextualLogger {
		this.Logger ??= this.AppLogger.createContextualLogger(BaseCacheInterceptor.name);
		return this.Logger;
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
	 * Abstract method to get cache key generator
	 */
	protected abstract GetCacheKeyGenerator(): ICacheKeyGenerator;

	/**
	 * Abstract method to get cache metadata extractor
	 */
	protected abstract GetCacheMetadataExtractor(): ICacheMetadataExtractor;

	/**
	 * Abstract method to get context handler
	 */
	protected abstract GetCacheContextHandler(): ICacheContextHandler;

	/**
	 * Main interception logic
	 */
	@ProfileMethod({
		name: 'BaseCacheInterceptor.intercept',
		tags: { interceptor: 'cache', operation: 'http_cache' },
	})
	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const ContextHandler = this.GetCacheContextHandler();

		// Check if this request should be cached
		if (!ContextHandler.ShouldCacheRequest(context)) {
			return next.handle();
		}

		const MetadataExtractor = this.GetCacheMetadataExtractor();

		// Check if caching is disabled for this route/resolver
		if (MetadataExtractor.GetCacheDisabled(context)) {
			return next.handle();
		}

		// Generate cache key
		const KeyGenerator = this.GetCacheKeyGenerator();
		const CacheKey = KeyGenerator.Generate(context);

		// Get TTL from metadata or use default
		const Ttl = MetadataExtractor.GetCacheTtl(context) ?? CACHE_INTERCEPTOR_DEFAULT_TTL; // 5 minutes default

		// Check cache
		return from(this.CacheManager.get(CacheKey)).pipe(
			switchMap((cachedResponse) => {
				if (cachedResponse !== null && cachedResponse !== undefined) {
					this.GetLogger().debug(`Cache hit for ${CacheKey}`);
					ContextHandler.SetCacheHeaders(context, true, Ttl);
					return of(cachedResponse);
				}

				this.GetLogger().debug(`Cache miss for ${CacheKey}`);
				ContextHandler.SetCacheHeaders(context, false);

				// Execute handler and cache response
				return next.handle().pipe(
					tap(async (data) => {
						try {
							await this.CacheManager.set(CacheKey, data, Ttl);
							this.GetLogger().debug(`Cached response for ${CacheKey} (TTL: ${Ttl}s)`);
						} catch (error) {
							this.GetLogger().error(`Failed to cache response for ${CacheKey}:`, error as string);
						}
					}),
				);
			}),
		);
	}

	/**
	 * Generate ETag from response data
	 */
	protected GenerateETag(data: any): string {
		const Content = JSON.stringify(data);
		return `"${Buffer.from(Content).toString('base64').substring(0, CACHE_ETAG_BASE64_SUBSTRING_LENGTH)}"`;
	}

	/**
	 * Sort object keys for consistent cache keys
	 */
	protected SortObject(obj: any): any {
		if (!obj || typeof obj !== 'object') return obj;
		if (Array.isArray(obj)) return obj.map(this.SortObject.bind(this));

		const Sorted: any = {};
		Object.keys(obj)
			.sort()
			.forEach((key) => {
				Sorted[key] = this.SortObject(obj[key]);
			});

		return Sorted;
	}
}
