import { Injectable, ExecutionContext } from '@nestjs/common';
import { Response } from 'express';
import {
	BaseCacheInterceptor,
	CacheKeyGenerator,
	CacheMetadataExtractor,
	CacheContextHandler,
} from './interceptors/base-cache.interceptor.js';

/**
 * HTTP-specific cache key generator
 *
 * Generates deterministic cache keys for HTTP GET requests based on method, URL, query,
 * params, and user ID. Keys are encoded in base64 to ensure they're safe for use with Redis.
 * Only supports GET requests.
 *
 * @example
 * ```typescript
 * // Cache key includes user context
 * // Key format: http:<base64(JSON)>
 * ```
 */
@Injectable()
export class HttpCacheKeyGenerator implements CacheKeyGenerator {
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
 * Extracts caching metadata from route handlers and controllers using reflection.
 * Looks for cache-disabled and cache-ttl metadata attached to handler methods.
 */
@Injectable()
export class HttpCacheMetadataExtractor implements CacheMetadataExtractor {
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
 * at the HTTP level. Sets X-Cache and Cache-Control headers appropriately.
 */
@Injectable()
export class HttpCacheContextHandler implements CacheContextHandler {
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
 * HTTP Cache Interceptor extending the base cache interceptor
 *
 * Provides automatic HTTP response caching for GET requests. Uses HttpCacheKeyGenerator,
 * HttpCacheMetadataExtractor, and HttpCacheContextHandler to implement HTTP-specific
 * caching logic. Sets X-Cache and Cache-Control headers for client-side caching.
 *
 * @example
 * ```typescript
 * @UseInterceptors(CacheInterceptor)
 * @Get('data')
 * async getData() {
 *   return { data: 'cached' };
 * }
 * ```
 */
@Injectable()
export class CacheInterceptor extends BaseCacheInterceptor {
	/**
	 * Provides the cache key generator for HTTP requests
	 * @returns HttpCacheKeyGenerator instance
	 */
	protected getCacheKeyGenerator(): CacheKeyGenerator {
		return new HttpCacheKeyGenerator();
	}

	/**
	 * Provides the cache metadata extractor for HTTP routes
	 * @returns HttpCacheMetadataExtractor instance
	 */
	protected getCacheMetadataExtractor(): CacheMetadataExtractor {
		return new HttpCacheMetadataExtractor();
	}

	/**
	 * Provides the cache context handler for HTTP responses
	 * @returns HttpCacheContextHandler instance
	 */
	protected getCacheContextHandler(): CacheContextHandler {
		return new HttpCacheContextHandler();
	}
}
