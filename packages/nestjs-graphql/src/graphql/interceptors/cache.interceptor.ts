import { Injectable, ExecutionContext, CallHandler } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';
import type { ModuleRef } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { BaseCacheInterceptor, CacheKeyGenerator, CacheMetadataExtractor, CacheContextHandler } from '../../cache/interceptors/base-cache.interceptor.js';
import { GraphQLCacheService } from '../services/cache.service.js';
import { CACHEABLE_METADATA, CacheableOptions } from '../decorators/cacheable.decorator.js';
import { CACHE_INVALIDATE_METADATA, CacheInvalidateOptions } from '../decorators/cache-invalidate.decorator.js';

/**
 * GraphQL-specific cache key generator
 */
@Injectable()
export class GraphQLCacheKeyGenerator implements CacheKeyGenerator {
	constructor(private readonly cacheService: GraphQLCacheService) {}

	public generate(_context: ExecutionContext, options?: CacheableOptions): string {
		const gqlContext = GqlExecutionContext.create(_context);
		const args = gqlContext.getArgs();
		const info = gqlContext.getInfo();

		if (options?.keyGenerator) {
			return options.keyGenerator(Object.values(args), gqlContext.getContext());
		}

		return this.cacheService.generateKey(info.fieldName, args, {
			userId: gqlContext.getContext().user?.id ?? gqlContext.getContext().user?.sub,
		});
	}
}

/**
 * GraphQL-specific cache metadata extractor
 */
@Injectable()
export class GraphQLCacheMetadataExtractor implements CacheMetadataExtractor {
	constructor(private readonly reflector: Reflector) {}

	public getCacheDisabled(_context: ExecutionContext): boolean {
		// GraphQL doesn't have a direct equivalent to "cache-disabled"
		// Could be implemented via custom directive or metadata
		return false;
	}

	public getCacheTtl(_context: ExecutionContext): number | undefined {
		const cacheableOptions = this.reflector.getAllAndOverride<CacheableOptions>(
			CACHEABLE_METADATA,
			[_context.getHandler(), _context.getClass()],
		);
		return cacheableOptions?.ttl;
	}
}

/**
 * GraphQL-specific cache context handler
 */
@Injectable()
export class GraphQLCacheContextHandler implements CacheContextHandler {
	public setCacheHeaders(_context: ExecutionContext, _hit: boolean, _ttl?: number): void {
		// GraphQL doesn't use HTTP headers for caching
		// Could potentially add to extensions if needed
	}

	public shouldCacheRequest(_context: ExecutionContext): boolean {
		// GraphQL requests are typically POST, but we can cache resolvers
		return true;
	}
}

/**
 * GraphQL Cache Interceptor extending the base cache interceptor
 * with GraphQL-specific cache invalidation support
 */
@Injectable()
export class GraphQLCacheInterceptor extends BaseCacheInterceptor {
	public get Reflector(): Reflector {
		return this.Module.get(Reflector, { strict: false });
	}

	public get GraphQLCacheService(): GraphQLCacheService {
		return this.Module.get(GraphQLCacheService, { strict: false });
	}

	constructor(Module: ModuleRef) {
		super(Module);
	}

	protected getCacheKeyGenerator(): CacheKeyGenerator {
		return new GraphQLCacheKeyGenerator(this.GraphQLCacheService);
	}

	protected getCacheMetadataExtractor(): CacheMetadataExtractor {
		return new GraphQLCacheMetadataExtractor(this.Reflector);
	}

	protected getCacheContextHandler(): CacheContextHandler {
		return new GraphQLCacheContextHandler();
	}

	/**
	 * Override intercept to add GraphQL-specific cache invalidation
	 */
	public override intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const gqlContext = GqlExecutionContext.create(context);
		const args = gqlContext.getArgs();
		const gqlContextData = gqlContext.getContext();

		// Use base class caching logic, but first handle pre-execution invalidation
		// Note: pre-execution invalidation is intentionally non-blocking (fire-and-forget)
		// to avoid delaying the response; errors are logged internally.
		void this.handleCacheInvalidation(context, args, gqlContextData, null, 'before');

		// Use base class caching logic
		const result = super.intercept(context, next);

		// Handle cache invalidation (after execution)
		return result.pipe(
			tap(async (data) => {
				await this.handleCacheInvalidation(context, args, gqlContextData, data, 'after');
			}),
		);
	}

	/**
	 * Handle GraphQL-specific cache invalidation
	 */
	private async handleCacheInvalidation(
		context: ExecutionContext,
		args: Record<string, any>,
		gqlContext: any,
		result: any,
		when: 'before' | 'after',
	): Promise<void> {
		const invalidateOptions = this.Reflector.getAllAndOverride<CacheInvalidateOptions>(
			CACHE_INVALIDATE_METADATA,
			[context.getHandler(), context.getClass()],
		);

		if (invalidateOptions?.when !== when) {
			return;
		}

		// Check condition
		if (invalidateOptions.condition && !invalidateOptions.condition(result, Object.values(args), gqlContext)) {
			return;
		}

		// Generate invalidation keys
		let { patterns } = invalidateOptions;
		if (invalidateOptions.keyGenerator) {
			patterns = invalidateOptions.keyGenerator(Object.values(args), gqlContext, result);
		}

		// Invalidate each pattern
		for (const pattern of patterns) {
			try {
				await this.GraphQLCacheService.invalidatePattern(pattern);
				this.logger.debug(`Invalidated GraphQL cache pattern: ${pattern}`);
			} catch (error) {
				this.logger.error(`Failed to invalidate GraphQL cache pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}
}
