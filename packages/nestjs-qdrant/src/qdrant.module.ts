/**
 * Qdrant NestJS Module
 * Integrates Qdrant vector database client with NestJS dependency injection
 */

import { DynamicModule, Module } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createAsyncProviders } from '@pawells/nestjs-shared/common';
import { getQdrantClientToken, getQdrantModuleOptionsToken } from './qdrant.constants.js';
import type { QdrantModuleAsyncOptions, QdrantModuleOptions, QdrantOptionsFactory } from './qdrant.interfaces.js';
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
	public static forRoot(
		options: QdrantModuleOptions,
		isGlobal?: boolean,
	): DynamicModule {
		const global = isGlobal ?? true;
		const { name, ...clientOptions } = options;
		const clientToken = getQdrantClientToken(name);
		const optionsToken = getQdrantModuleOptionsToken(name);

		// Sanitize options by removing apiKey before storing
		const { apiKey: _apiKey, ...sanitizedOptions } = clientOptions;

		return {
			module: QdrantModule,
			global,
			providers: [
				{ provide: optionsToken, useValue: sanitizedOptions },
				{ provide: clientToken, useValue: new QdrantClient(clientOptions) },
				{
					provide: QdrantService,
					useClass: QdrantService,
				},
			],
			exports: [QdrantService, clientToken],
		};
	}

	/**
	 * Register the Qdrant module asynchronously with deferred configuration.
	 * Supports factory functions, class-based factories, and existing service reuse.
	 * Creates and provides the Qdrant client instance and service globally.
	 *
	 * The apiKey is automatically sanitized and stored separately from the public options token
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
	public static forRootAsync(
		options: QdrantModuleAsyncOptions,
		isGlobal?: boolean,
	): DynamicModule {
		const global = isGlobal ?? true;
		const clientToken = getQdrantClientToken(options.name);
		const optionsToken = getQdrantModuleOptionsToken(options.name);
		// Internal token for raw (unsanitized) options — includes apiKey for client creation
		const rawOptionsToken = Symbol('QDRANT_RAW_OPTIONS');

		const rawProviders = createAsyncProviders(
			options,
			rawOptionsToken,
			(factory: QdrantOptionsFactory): QdrantModuleOptions | Promise<QdrantModuleOptions> => {
				return factory.createQdrantOptions();
			},
		);

		return {
			module: QdrantModule,
			global,
			imports: options.imports ?? [],
			providers: [
				...rawProviders,
				// Store sanitized options (without apiKey) under the public token
				{
					provide: optionsToken,
					useFactory: (opts: QdrantModuleOptions) => {
						const { apiKey: _apiKey, name: _name, ...sanitized } = opts;
						return sanitized;
					},
					inject: [rawOptionsToken],
				},
				// Create client with full options (including apiKey)
				{
					provide: clientToken,
					useFactory: (opts: QdrantModuleOptions) => {
						const { name: _name, ...clientOptions } = opts;
						return new QdrantClient(clientOptions);
					},
					inject: [rawOptionsToken],
				},
				{
					provide: QdrantService,
					useClass: QdrantService,
				},
			],
			exports: [QdrantService, clientToken],
		};
	}
}
