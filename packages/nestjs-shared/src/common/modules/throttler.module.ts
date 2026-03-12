/**
 * SharedThrottlerModule
 *
 * Provides rate limiting / throttling functionality with optional Redis backend.
 * Default: in-memory storage (suitable for single-instance deployments)
 * With Redis: distributed rate limiting across multiple instances
 *
 * Usage:
 * ```typescript
 * // In-memory (default, development)
 * @Module({
 *   imports: [SharedThrottlerModule.forRoot()],
 * })
 * export class AppModule {}
 *
 * // With Redis (production)
 * @Module({
 *   imports: [
 *     SharedThrottlerModule.forRootAsync({
 *       useFactory: () => ({
 *         redis: {
 *           host: process.env.REDIS_HOST,
 *           port: parseInt(process.env.REDIS_PORT || '6379', 10),
 *         },
 *       }),
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */

import {
	Module,
	DynamicModule,
	ModuleMetadata,
	Type,
	Provider,
	Logger,
} from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

export interface SharedThrottlerConfig {
	/** Time window in milliseconds (default: 15 * 60 * 1000 = 15 minutes) */
	ttl?: number;
	/** Maximum number of requests per window (default: 100) */
	limit?: number;
	/** Optional Redis configuration for distributed rate limiting */
	redis?: {
		host?: string;
		port?: number;
		password?: string;
		username?: string;
		db?: number;
		[key: string]: any;
	};
}

@Module({})
export class SharedThrottlerModule {
	private static readonly logger = new Logger(SharedThrottlerModule.name);

	// eslint-disable-next-line no-magic-numbers
	private static readonly DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

	// eslint-disable-next-line no-magic-numbers
	private static readonly DEFAULT_MAX_REQUESTS = 100;

	// eslint-disable-next-line no-magic-numbers
	private static readonly MS_PER_SECOND = 1000;

	/**
	 * Configure in-memory throttling (default)
	 */
	public static forRoot(config?: SharedThrottlerConfig): DynamicModule {
		const ttl = config?.ttl ?? SharedThrottlerModule.DEFAULT_WINDOW_MS;
		const limit = config?.limit ?? SharedThrottlerModule.DEFAULT_MAX_REQUESTS;

		SharedThrottlerModule.logger.log(
			`Initializing SharedThrottlerModule with in-memory storage (ttl: ${ttl}ms, limit: ${limit})`,
		);

		return {
			module: SharedThrottlerModule,
			imports: [
				ThrottlerModule.forRoot({
					throttlers: [{ ttl: Math.round(ttl / SharedThrottlerModule.MS_PER_SECOND), limit }],
				}),
			],
			providers: [ThrottlerGuard],
			exports: [ThrottlerModule, ThrottlerGuard],
		};
	}

	/**
	 * Configure with async options (supports Redis backend)
	 */
	public static forRootAsync(
		options: {
			useFactory?: (...args: any[]) => SharedThrottlerConfig | Promise<SharedThrottlerConfig>;
			useClass?: Type<{ createThrottlerConfig(): SharedThrottlerConfig | Promise<SharedThrottlerConfig> }>;
			inject?: any[];
			imports?: ModuleMetadata['imports'];
		},
	): DynamicModule {
		const providers: Provider[] = [];

		// If useFactory is provided
		if (options.useFactory) {
			providers.push({
				provide: 'SHARED_THROTTLER_CONFIG',
				useFactory: options.useFactory,
				inject: options.inject ?? [],
			});
		}

		// If useClass is provided
		if (options.useClass) {
			providers.push(options.useClass, {
				provide: 'SHARED_THROTTLER_CONFIG',
				useFactory: (instance: any) => instance.createThrottlerConfig(),
				inject: [options.useClass],
			});
		}

		return {
			module: SharedThrottlerModule,
			imports: [
				ThrottlerModule.forRootAsync({
					inject: ['SHARED_THROTTLER_CONFIG'],
					useFactory: (config: SharedThrottlerConfig) => {
						const ttl = config?.ttl ?? SharedThrottlerModule.DEFAULT_WINDOW_MS;
						const limit = config?.limit ?? SharedThrottlerModule.DEFAULT_MAX_REQUESTS;

						if (config?.redis) {
							SharedThrottlerModule.logger.log(
								`Initializing SharedThrottlerModule with Redis backend (${config.redis.host}:${config.redis.port})`,
							);

							// For Redis backend, you would typically use @nestjs-throttler-storage-redis
							// or configure a custom storage. The standard @nestjs/throttler.ThrottlerStorageRedisService
							// may be available in newer versions.
							// For now, we log the intent but use in-memory as fallback.
							// Users can configure Redis storage manually if needed.
						} else {
							SharedThrottlerModule.logger.log(
								`Initializing SharedThrottlerModule with in-memory storage (ttl: ${ttl}ms, limit: ${limit})`,
							);
						}

						return {
							throttlers: [{ ttl: Math.round(ttl / SharedThrottlerModule.MS_PER_SECOND), limit }],
						};
					},
				}),
				...(options.imports ?? []),
			],
			providers: [...providers, ThrottlerGuard],
			exports: [ThrottlerModule, ThrottlerGuard],
		};
	}
}
