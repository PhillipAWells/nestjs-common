/**
 * Qdrant NestJS Module
 * Integrates Qdrant vector database client with NestJS dependency injection
 */

import { DynamicModule, Module } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createAsyncProviders } from '@pawells/nestjs-shared/common';
import { GetQdrantClientToken, GetQdrantModuleOptionsToken } from './qdrant.constants.js';
import type { IQdrantModuleAsyncOptions, TQdrantModuleOptions, IQdrantOptionsFactory } from './qdrant.interfaces.js';
import { QdrantService } from './qdrant.service.js';

/**
 * Qdrant NestJS Module
 * Provides DynamicModule for both synchronous and asynchronous configuration
 *
 * Integrates the Qdrant vector database client with NestJS dependency injection.
 * Supports multiple named client instances for multi-tenant scenarios.
 *
 * Security: API keys are automatically sanitized and stripped from the publicly injectable options token
 * in forRootAsync() to prevent accidental exposure. The apiKey is only available to the client factory.
 *
 * @example
 * ```typescript
 * // Synchronous usage
 * QdrantModule.forRoot({
 *   url: 'http://localhost:6333',
 *   apiKey: 'your-api-key'
 * })
 *
 * // Asynchronous usage
 * QdrantModule.forRootAsync({
 *   imports: [ConfigModule],
 *   inject: [ConfigService],
 *   useFactory: (configService: ConfigService) => ({
 *     url: configService.get('QDRANT_URL'),
 *     apiKey: configService.get('QDRANT_API_KEY')
 *   })
 * })
 * ```
 */
@Module({})
export class QdrantModule {
	/**
	 * Register the Qdrant module synchronously with configuration options.
	 * Creates and provides the Qdrant client instance and service globally.
	 *
	 * The apiKey is sanitized and not included in the publicly injectable options token
	 * to prevent accidental exposure through dependency injection.
	 *
	 * @param options - Qdrant client configuration options (extends QdrantClientParams)
	 * @param isGlobal - Whether to register module as global (default: true)
	 * @returns DynamicModule with Qdrant client and service providers
	 * @throws Error - If invalid configuration options are provided
	 *
	 * @example
	 * ```typescript
	 * @Module({
	 *   imports: [
	 *     QdrantModule.forRoot({
	 *       url: 'http://localhost:6333',
	 *       apiKey: process.env.QDRANT_API_KEY,
	 *     })
	 *   ]
	 * })
	 * export class AppModule {}
	 * ```
	 */
	public static ForRoot(
		options: TQdrantModuleOptions,
		isGlobal?: boolean,
	): DynamicModule {
		const Global = isGlobal ?? true;
		const { name, ...ClientOptions } = options;
		const ClientToken = GetQdrantClientToken(name);
		const OptionsToken = GetQdrantModuleOptionsToken(name);

		// Sanitize options by removing apiKey before storing
		const { apiKey: _ApiKey, ...SanitizedOptions } = ClientOptions;

		return {
			module: QdrantModule,
			global: Global,
			providers: [
				{ provide: OptionsToken, useValue: SanitizedOptions },
				{ provide: ClientToken, useValue: new QdrantClient(ClientOptions) },
				{
					provide: QdrantService,
					useClass: QdrantService,
				},
			],
			exports: [QdrantService, ClientToken],
		};
	}

	/**
	 * Register the Qdrant module asynchronously with deferred configuration.
	 * Supports factory functions, class-based factories, and existing service reuse.
	 * Creates and provides the Qdrant client instance and service globally.
	 *
	 * The apiKey is automatically sanitized and stored separately from the public Options token
	 * to ensure security. The client factory receives the full options including the apiKey,
	 * but the publicly injectable options token excludes it.
	 *
	 * @param options - Async configuration options (useFactory, useClass, or useExisting)
	 * @param isGlobal - Whether to register module as global (default: true)
	 * @returns DynamicModule with async providers for client creation and service
	 * @throws Error - If async factory fails or options validation fails
	 *
	 * @example
	 * ```typescript
	 * // With factory function
	 * QdrantModule.forRootAsync({
	 *   imports: [ConfigModule],
	 *   inject: [ConfigService],
	 *   useFactory: (config: ConfigService) => ({
	 *     url: config.get('QDRANT_URL'),
	 *     apiKey: config.get('QDRANT_API_KEY'),
	 *   })
	 * })
	 *
	 * // With class-based factory
	 * QdrantModule.forRootAsync({
	 *   useClass: QdrantConfigService
	 * })
	 * ```
	 */
	public static ForRootAsync(
		options: IQdrantModuleAsyncOptions,
		isGlobal?: boolean,
	): DynamicModule {
		const Global = isGlobal ?? true;
		const ClientToken = GetQdrantClientToken(options.name);
		const OptionsToken = GetQdrantModuleOptionsToken(options.name);
		// Internal token for raw (unsanitized) options — includes apiKey for client creation
		const RawOptionsToken = Symbol('QDRANT_RAW_OPTIONS');

		const RawProviders = createAsyncProviders(
			options,
			RawOptionsToken,
			(factory: IQdrantOptionsFactory): TQdrantModuleOptions | Promise<TQdrantModuleOptions> => {
				return factory.createQdrantOptions();
			},
		);

		return {
			module: QdrantModule,
			global: Global,
			imports: options.imports ?? [],
			providers: [
				...RawProviders,
				// Store sanitized options (without apiKey) under the public token
				{
					provide: OptionsToken,
					useFactory: (opts: TQdrantModuleOptions) => {
						const { apiKey: _ApiKey, name: _Name, ...Sanitized } = opts;
						return Sanitized;
					},
					inject: [RawOptionsToken],
				},
				// Create client with full options (including apiKey)
				{
					provide: ClientToken,
					useFactory: (opts: TQdrantModuleOptions) => {
						const { name: _Name, ...ClientOptions } = opts;
						return new QdrantClient(ClientOptions);
					},
					inject: [RawOptionsToken],
				},
				{
					provide: QdrantService,
					useClass: QdrantService,
				},
			],
			exports: [QdrantService, ClientToken],
		};
	}
}
