import { Injectable, ExecutionContext, CallHandler } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector, ModuleRef } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { getErrorMessage } from '@pawells/nestjs-shared/common';
import { BaseCacheInterceptor, ICacheKeyGenerator, ICacheMetadataExtractor, ICacheContextHandler } from '../../cache/interceptors/base-cache.interceptor.js';
import { GraphQLCacheService } from '../services/cache.service.js';
import { CACHEABLE_METADATA, ICacheableOptions } from '../decorators/cacheable.decorator.js';
import { CACHE_INVALIDATE_METADATA, ICacheInvalidateOptions } from '../decorators/cache-invalidate.decorator.js';

/**
 * GraphQL-specific cache key generator
 */
@Injectable()
export class GraphQLCacheKeyGenerator implements ICacheKeyGenerator {
	private readonly CacheService: GraphQLCacheService;

	constructor(cacheService: GraphQLCacheService) {
		this.CacheService = cacheService;
	}

	public generate(_context: ExecutionContext, options?: ICacheableOptions): string {
		const gqlContext = GqlExecutionContext.create(_context);
		const args = gqlContext.getArgs();
		const info = gqlContext.getInfo();

		if (options?.keyGenerator) {
			return options.keyGenerator(Object.values(args), gqlContext.getContext());
		}

		return this.CacheService.generateKey(info.fieldName, args, {
			userId: gqlContext.getContext().user?.id ?? gqlContext.getContext().user?.sub,
		});
	}
}

/**
 * GraphQL-specific cache metadata extractor
 */
@Injectable()
export class GraphQLCacheMetadataExtractor implements ICacheMetadataExtractor {
	private readonly Reflector: Reflector;

	constructor(reflector: Reflector) {
		this.Reflector = reflector;
	}

	public getCacheDisabled(_context: ExecutionContext): boolean {
		// GraphQL doesn't have a direct equivalent to "cache-disabled"
		// Could be implemented via custom directive or metadata
		return false;
	}

	public getCacheTtl(_context: ExecutionContext): number | undefined {
		const cacheableOptions = this.Reflector.getAllAndOverride<ICacheableOptions>(
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
export class GraphQLCacheContextHandler implements ICacheContextHandler {
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

	constructor(moduleRef: ModuleRef) {
		super(moduleRef);
	}

	protected getCacheKeyGenerator(): ICacheKeyGenerator {
		return new GraphQLCacheKeyGenerator(this.GraphQLCacheService);
	}

	protected getCacheMetadataExtractor(): ICacheMetadataExtractor {
		return new GraphQLCacheMetadataExtractor(this.Reflector);
	}

	protected getCacheContextHandler(): ICacheContextHandler {
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
		const invalidateOptions = this.Reflector.getAllAndOverride<ICacheInvalidateOptions>(
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
		const { patterns: initialPatterns, keyGenerator } = invalidateOptions;
		let patterns: string[] | undefined = initialPatterns;
		if (keyGenerator) {
			patterns = keyGenerator(Object.values(args), gqlContext, result);
		}

		// Invalidate each pattern
		if (!patterns) {
			return;
		}

		for (const pattern of patterns) {
			try {
				await this.GraphQLCacheService?.invalidatePattern(pattern);
				this.Logger?.debug(`Invalidated GraphQL cache pattern: ${pattern}`);
			} catch (error) {
				this.Logger?.error(`Failed to invalidate GraphQL cache pattern ${pattern}: ${getErrorMessage(error)}`);
			}
		}
	}
}
