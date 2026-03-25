import { Global, Module, DynamicModule, Provider } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { CacheService } from './cache.service.js';
import { getRedisConnectionOptions } from './redis.config.js';
import { CommonModule, CACHE_PROVIDER, AppLogger } from '@pawells/nestjs-shared/common';
import type { CacheModuleAsyncOptions } from './cache.interfaces.js';

// Default TTL for cache entries (1 hour in seconds)
const CACHE_DEFAULT_TTL_SECONDS = 3_600;

/**
 * Cache module providing Redis-based caching functionality
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

							const config = {
								store: redisStore,
								host: redisOptions.host,
								port: redisOptions.port,
								password: redisOptions.password,
								db: redisOptions.db,
								ttl: redisOptions.ttl ?? CACHE_DEFAULT_TTL_SECONDS,
								keyPrefix: redisOptions.keyPrefix,
								enableReadyCheck: redisOptions.enableReadyCheck,
								maxRetriesPerRequest: redisOptions.maxRetriesPerRequest,
								lazyConnect: redisOptions.lazyConnect,
								reconnectOnError: redisOptions.reconnectOnError,
								connectTimeout: redisOptions.connectTimeout,
								commandTimeout: redisOptions.commandTimeout,
								family: redisOptions.family,
								keepAlive: redisOptions.keepAlive,
							};

							// Event listeners will be attached lazily on first cache operation to respect lazyConnect=true

							return config as any;
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
	public static forRootAsync(options: CacheModuleAsyncOptions): DynamicModule {
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
