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
 */
@Injectable()
export class HttpCacheKeyGenerator implements CacheKeyGenerator {
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
	 * Sort object keys for consistent cache keys
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
 */
@Injectable()
export class HttpCacheMetadataExtractor implements CacheMetadataExtractor {
	public getCacheDisabled(context: ExecutionContext): boolean {
		const handler = context.getHandler();
		const metadata = Reflect.getMetadata('cache-disabled', handler);
		return !!metadata;
	}

	public getCacheTtl(context: ExecutionContext): number | undefined {
		const handler = context.getHandler();
		const metadata = Reflect.getMetadata('cache-ttl', handler);
		return metadata;
	}
}

/**
 * HTTP-specific cache context handler
 */
@Injectable()
export class HttpCacheContextHandler implements CacheContextHandler {
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

	public shouldCacheRequest(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		return request.method === 'GET';
	}
}

/**
 * HTTP Cache Interceptor extending the base cache interceptor
 */
@Injectable()
export class CacheInterceptor extends BaseCacheInterceptor {
	protected getCacheKeyGenerator(): CacheKeyGenerator {
		return new HttpCacheKeyGenerator();
	}

	protected getCacheMetadataExtractor(): CacheMetadataExtractor {
		return new HttpCacheMetadataExtractor();
	}

	protected getCacheContextHandler(): CacheContextHandler {
		return new HttpCacheContextHandler();
	}
}
