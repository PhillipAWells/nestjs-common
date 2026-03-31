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

	public Generate(_context: ExecutionContext, options?: ICacheableOptions): string {
		const GqlContext = GqlExecutionContext.create(_context);
		const Args = GqlContext.getArgs();
		const Info = GqlContext.getInfo();

		if (options?.keyGenerator) {
			return options.keyGenerator(Object.values(Args), GqlContext.getContext());
		}

		return this.CacheService.GenerateKey(Info.fieldName, Args, {
			userId: GqlContext.getContext().user?.id ?? GqlContext.getContext().user?.sub,
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

	public GetCacheDisabled(_context: ExecutionContext): boolean {
		// GraphQL doesn't have a direct equivalent to "cache-disabled"
		// Could be implemented via custom directive or metadata
		return false;
	}

	public GetCacheTtl(_context: ExecutionContext): number | undefined {
		const CacheableOptions = this.Reflector.getAllAndOverride<ICacheableOptions>(
			CACHEABLE_METADATA,
			[_context.getHandler(), _context.getClass()],
		);
		return CacheableOptions?.ttl;
	}
}

/**
 * GraphQL-specific cache context handler
 */
@Injectable()
export class GraphQLCacheContextHandler implements ICacheContextHandler {
	public SetCacheHeaders(_context: ExecutionContext, _hit: boolean, _ttl?: number): void {
		// GraphQL doesn't use HTTP headers for caching
		// Could potentially add to extensions if needed
	}

	public ShouldCacheRequest(_context: ExecutionContext): boolean {
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

	protected GetCacheKeyGenerator(): ICacheKeyGenerator {
		return new GraphQLCacheKeyGenerator(this.GraphQLCacheService);
	}

	protected GetCacheMetadataExtractor(): ICacheMetadataExtractor {
		return new GraphQLCacheMetadataExtractor(this.Reflector);
	}

	protected GetCacheContextHandler(): ICacheContextHandler {
		return new GraphQLCacheContextHandler();
	}

	/**
	 * Override intercept to add GraphQL-specific cache invalidation
	 */
	public override intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const GqlContext = GqlExecutionContext.create(context);
		const Args = GqlContext.getArgs();
		const GqlContextData = GqlContext.getContext();

		// Use base class caching logic, but first handle pre-execution invalidation
		// Note: pre-execution invalidation is intentionally non-blocking (fire-and-forget)
		// to avoid delaying the response; errors are logged internally.
		void this.HandleCacheInvalidation(context, Args, GqlContextData, null, 'before');

		// Use base class caching logic
		const Result = super.intercept(context, next);

		// Handle cache invalidation (after execution)
		return Result.pipe(
			tap(async (data) => {
				await this.HandleCacheInvalidation(context, Args, GqlContextData, data, 'after');
			}),
		);
	}

	/**
	 * Handle GraphQL-specific cache invalidation
	 */
	private async HandleCacheInvalidation(
		context: ExecutionContext,
		args: Record<string, any>,
		gqlContext: any,
		result: any,
		when: 'before' | 'after',
	): Promise<void> {
		const InvalidateOptions = this.Reflector.getAllAndOverride<ICacheInvalidateOptions>(
			CACHE_INVALIDATE_METADATA,
			[context.getHandler(), context.getClass()],
		);

		if (InvalidateOptions?.when !== when) {
			return;
		}

		// Check condition
		if (InvalidateOptions.condition && !InvalidateOptions.condition(result, Object.values(args), gqlContext)) {
			return;
		}

		// Generate invalidation keys
		const { patterns: InitialPatterns, keyGenerator } = InvalidateOptions;
		let Patterns: string[] | undefined = InitialPatterns;
		if (keyGenerator) {
			Patterns = keyGenerator(Object.values(args), gqlContext, result);
		}

		// Invalidate each pattern
		if (!Patterns) {
			return;
		}

		for (const Pattern of Patterns) {
			try {
				await this.GraphQLCacheService?.InvalidatePattern(Pattern);
				this.Logger?.debug(`Invalidated GraphQL cache pattern: ${Pattern}`);
			} catch (error) {
				this.Logger?.error(`Failed to invalidate GraphQL cache pattern ${Pattern}: ${getErrorMessage(error)}`);
			}
		}
	}
}
