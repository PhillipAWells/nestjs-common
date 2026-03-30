import { Injectable, ExecutionContext } from '@nestjs/common';
import { Response } from 'express';
import {
	BaseCacheInterceptor,
	ICacheKeyGenerator,
	ICacheMetadataExtractor,
	ICacheContextHandler,
} from './interceptors/base-cache.interceptor.js';

/**
 * HTTP-specific cache key generator
 *
 * Generates deterministic cache keys for HTTP GET requests based on method, URL, query,
 * params, and user ID. Keys are encoded in base64 to ensure they're safe for use with Redis.
 * Only supports GET requests.
 *
 * @internal Implementation detail of {@link CacheInterceptor}. Use via
 * {@link CacheInterceptor} or {@link BaseCacheInterceptor} rather than directly.
 *
 * @example
 * ```typescript
 * // Cache key includes user context
 * // Key format: http:<base64(JSON)>
 * ```
 */
@Injectable()
export class HttpCacheKeyGenerator implements ICacheKeyGenerator {
	/**
	 * Generates a cache key for an HTTP request
	 * @param context Execution context from the request
	 * @returns Base64-encoded cache key
	 * @throws Error if the request is not a GET request
	 */
	public generate(context: ExecutionContext): string {
		const request = context.switchToHttp().getRequest();
		const { method, url, query, params, user } = request;

		// Only cache GET requests
		if (method !== 'GET') {
			throw new Error('HTTP cache key generation only supports GET requests');
		}

		// Include user ID in key for user-specific caching
		const userId = user?.id ?? 'anonymous';

		// Create a deterministic key from request data
		const keyData = {
			method,
			url,
			query: this.sortObject(query),
			params: this.sortObject(params),
			userId,
		};

		return `http:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
	}

	/**
	 * Sorts object keys recursively for consistent cache key generation
	 * @param obj Object to sort (can be nested)
	 * @returns Object with sorted keys
	 */
	private sortObject(obj: any): any {
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

/**
 * HTTP-specific cache metadata extractor
 *
 * Extracts caching metadata from route handlers and controllers using Reflect metadata.
 * Inspects handlers for 'cache-disabled' and 'cache-ttl' metadata to determine
 * whether caching should be applied and the appropriate TTL for cached responses.
 *
 * @internal Implementation detail of {@link CacheInterceptor}. Use via
 * {@link CacheInterceptor} or {@link BaseCacheInterceptor} rather than directly.
 */
@Injectable()
export class HttpCacheMetadataExtractor implements ICacheMetadataExtractor {
	/**
	 * Gets whether caching is disabled for the route
	 * @param context Execution context from the request
	 * @returns True if cache-disabled metadata is present
	 */
	public getCacheDisabled(context: ExecutionContext): boolean {
		const handler = context.getHandler();
		const metadata = Reflect.getMetadata('cache-disabled', handler);
		return !!metadata;
	}

	/**
	 * Gets the TTL for the cached response
	 * @param context Execution context from the request
	 * @returns TTL in milliseconds or undefined if not configured
	 */
	public getCacheTtl(context: ExecutionContext): number | undefined {
		const handler = context.getHandler();
		const metadata = Reflect.getMetadata('cache-ttl', handler);
		return metadata;
	}
}

/**
 * HTTP-specific cache context handler
 *
 * Manages HTTP response headers for cache hits/misses and controls caching behavior
 * at the HTTP level. Sets X-Cache and Cache-Control headers appropriately based on
 * cache hit/miss status and configured TTL. Only applies to GET requests.
 *
 * @internal Implementation detail of {@link CacheInterceptor}. Use via
 * {@link CacheInterceptor} or {@link BaseCacheInterceptor} rather than directly.
 */
@Injectable()
export class HttpCacheContextHandler implements ICacheContextHandler {
	/**
	 * Sets cache-related HTTP response headers
	 * @param context Execution context from the request
	 * @param hit Whether the response was a cache hit
	 * @param ttl Time-to-live in seconds for the cached response
	 */
	public setCacheHeaders(context: ExecutionContext, hit: boolean, ttl?: number): void {
		const response = context.switchToHttp().getResponse<Response>();

		if (hit) {
			response.setHeader('X-Cache', 'HIT');
			response.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
		} else {
			response.setHeader('X-Cache', 'MISS');
			if (ttl) {
				response.setHeader('Cache-Control', `public, max-age=${ttl}`);
			}
		}
	}

	/**
	 * Determines if a request should be cached
	 * @param context Execution context from the request
	 * @returns True if the request method is GET
	 */
	public shouldCacheRequest(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		return request.method === 'GET';
	}
}

/**
 * HTTP Cache Interceptor
 *
 * Provides automatic HTTP response caching for GET requests using the cache-aside pattern.
 * Generates deterministic cache keys based on request context, extracts cache metadata from
 * route handlers, and applies HTTP cache headers (X-Cache, Cache-Control) to responses.
 *
 * Internally uses {@link HttpCacheKeyGenerator}, {@link HttpCacheMetadataExtractor},
 * and {@link HttpCacheContextHandler} to manage HTTP-specific caching behavior.
 * Only caches GET requests; sets X-Cache: HIT/MISS headers on responses.
 *
 * @example
 * ```typescript
 * import { UseInterceptors } from '@nestjs/common';
 * import { CacheInterceptor } from '@pawells/nestjs-graphql';
 *
 * @UseInterceptors(CacheInterceptor)
 * @Get('users/:id')
 * async getUser(@Param('id') id: string) {
 *   return this.userService.findById(id);
 * }
 * ```
 *
 * @see {@link BaseCacheInterceptor} for base caching logic
 * @see {@link CacheService} for manual cache operations
 */
@Injectable()
export class CacheInterceptor extends BaseCacheInterceptor {
	/**
	 * Provides the cache key generator for HTTP requests
	 * @returns HttpCacheKeyGenerator instance
	 */
	protected getCacheKeyGenerator(): ICacheKeyGenerator {
		return new HttpCacheKeyGenerator();
	}

	/**
	 * Provides the cache metadata extractor for HTTP routes
	 * @returns HttpCacheMetadataExtractor instance
	 */
	protected getCacheMetadataExtractor(): ICacheMetadataExtractor {
		return new HttpCacheMetadataExtractor();
	}

	/**
	 * Provides the cache context handler for HTTP responses
	 * @returns HttpCacheContextHandler instance
	 */
	protected getCacheContextHandler(): ICacheContextHandler {
		return new HttpCacheContextHandler();
	}
}
