import { Global, Module, DynamicModule, Provider } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import Keyv from 'keyv';
import RedisStore from '@keyv/redis';
import { CacheService } from './cache.service.js';
import { getRedisConnectionOptions } from './redis.config.js';
import { CommonModule, CACHE_PROVIDER, AppLogger } from '@pawells/nestjs-shared/common';
import type { ICacheModuleAsyncOptions } from './cache.interfaces.js';

// Default TTL for cache entries (1 hour in milliseconds)
// cache-manager v7 and @keyv/redis require TTL in milliseconds
const CACHE_DEFAULT_TTL_MS = 3_600_000;

/**
 * Cache module providing Redis-based caching functionality
 *
 * Provides Redis-backed HTTP and GraphQL response caching with automatic
 * storage management, TTL support, and metrics tracking. Requires Redis
 * connection configuration via environment variables (REDIS_HOST, REDIS_PORT, etc.).
 *
 * Use {@link CacheModule.forRoot} for standard configuration or
 * {@link CacheModule.forRootAsync} for dynamic configuration via factories.
 *
 * @example
 * ```typescript
 * import { CacheModule } from '@pawells/nestjs-graphql';
 *
 * @Module({
 *   imports: [CacheModule.forRoot()],
 * })
 * export class AppModule {}
 * ```
 *
 * @see {@link CacheService} for cache operations API
 * @see {@link CacheInterceptor} for HTTP response caching
 * @see {@link Cacheable}, {@link CacheInvalidate}, {@link CacheEvict} decorators
 */
@Global()
@Module({})
export class CacheModule {
	public static forRoot(): DynamicModule {
		return {
			module: CacheModule,
			imports: [
				CommonModule,
				NestCacheModule.registerAsync({
					useFactory: (appLogger: AppLogger) => {
						const logger = appLogger.createContextualLogger('CacheModuleFactory');
						try {
							const redisOptions = getRedisConnectionOptions();
							logger.info('Redis connection initialized', JSON.stringify({
								host: redisOptions.host,
								port: redisOptions.port,
								database: redisOptions.db,
								keyPrefix: redisOptions.keyPrefix,
							}));

							// Create Keyv with RedisStore for cache-manager v7 compatibility
							// RedisStore accepts connection URI or options
							const store = new Keyv({
								store: new RedisStore(`redis://${redisOptions.host}:${redisOptions.port}/${redisOptions.db ?? 0}`),
								namespace: redisOptions.keyPrefix,
							});

							return {
								store,
								ttl: redisOptions.ttl ?? CACHE_DEFAULT_TTL_MS,
							} as any;
						} catch (error) {
							logger.error('Failed to initialize Redis cache store', JSON.stringify({
								error: (error as Error).message,
							}));
							throw error; // Fail fast instead of falling back to memory
						}
					},
					inject: [AppLogger],
					isGlobal: true,
				}),
			],
			providers: [
				CacheService,
				// Provide CacheService as CACHE_PROVIDER for auth module
				// This breaks the circular dependency by allowing auth to inject without importing CacheModule
				{
					provide: CACHE_PROVIDER,
					useExisting: CacheService,
				},
			],
			exports: [CacheService, NestCacheModule, CACHE_PROVIDER],
		};
	}

	/**
	 * Configure the Cache module asynchronously
	 * @param options Async configuration options
	 * @returns Dynamic module configuration
	 */
	public static forRootAsync(options: ICacheModuleAsyncOptions): DynamicModule {
		const providers: Provider[] = [
			CacheService,
			{
				provide: CACHE_PROVIDER,
				useExisting: CacheService,
			},
		];

		return {
			module: CacheModule,
			imports: [
				CommonModule,
				NestCacheModule.registerAsync({
					useFactory: options.useFactory,
					...(options.inject ? { inject: options.inject } : {}),
					isGlobal: true,
				}),
				...(options.imports ?? []),
			],
			providers,
			exports: [CacheService, NestCacheModule, CACHE_PROVIDER],
		};
	}
}
