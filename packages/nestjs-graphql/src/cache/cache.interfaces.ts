/**
 * Async options for {@link CacheModule} configuration
 *
 * Supports dynamic cache configuration via factory functions, useful for
 * environments where Redis connection parameters are determined at runtime
 * (e.g., from ConfigService or external sources).
 *
 * @example
 * ```typescript
 * import { Module } from '@nestjs/common';
 * import { ConfigModule, ConfigService } from '@nestjs/config';
 * import { CacheModule } from '@pawells/nestjs-graphql';
 *
 * @Module({
 *   imports: [
 *     ConfigModule.forRoot(),
 *     CacheModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (configService: ConfigService) => ({
 *         host: configService.get('REDIS_HOST'),
 *         port: configService.get('REDIS_PORT'),
 *         password: configService.get('REDIS_PASSWORD'),
 *         // ... other Redis options
 *       }),
 *       inject: [ConfigService],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
export interface ICacheModuleAsyncOptions {
	/** Optional modules to import for dependency injection */
	imports?: any[];
	/** Factory function that returns cache configuration */
	useFactory: (...args: any[]) => any | Promise<any>;
	/** Dependencies to inject into the factory function */
	inject?: any[];
}
