/**
 * Qdrant NestJS Module
 * Integrates Qdrant vector database client with NestJS dependency injection
 */

import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { getQdrantClientToken, getQdrantModuleOptionsToken } from './qdrant.constants.js';
import type { QdrantModuleAsyncOptions, QdrantModuleOptions, QdrantOptionsFactory } from './qdrant.interfaces.js';
import { QdrantService } from './qdrant.service.js';

/**
 * Qdrant NestJS Module
 * Provides DynamicModule for both synchronous and asynchronous configuration
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
	 * Register the Qdrant module synchronously
	 * @param options Qdrant client configuration options
	 * @param isGlobal Whether to register module as global (default: true)
	 * @returns DynamicModule with Qdrant client and service
	 */
	public static forRoot(options: QdrantModuleOptions, isGlobal = true): DynamicModule {
		const { name, ...clientOptions } = options;
		const clientToken = getQdrantClientToken(name);
		const optionsToken = getQdrantModuleOptionsToken(name);

		// Sanitize options by removing apiKey before storing
		const { apiKey: _apiKey, ...sanitizedOptions } = clientOptions;

		return {
			module: QdrantModule,
			global: isGlobal,
			providers: [
				{ provide: optionsToken, useValue: sanitizedOptions },
				{ provide: clientToken, useValue: new QdrantClient(clientOptions) },
				{
					provide: QdrantService,
					useFactory: (client: QdrantClient) => new QdrantService(client),
					inject: [clientToken],
				},
			],
			exports: [QdrantService, clientToken],
		};
	}

	/**
	 * Register the Qdrant module asynchronously
	 * @param options Async configuration options
	 * @param isGlobal Whether to register module as global (default: true)
	 * @returns DynamicModule with Qdrant client and service
	 */
	public static forRootAsync(options: QdrantModuleAsyncOptions, isGlobal = true): DynamicModule {
		const asyncProviders = QdrantModule.createAsyncProviders(options);
		const clientToken = getQdrantClientToken(options.name);
		const optionsToken = getQdrantModuleOptionsToken(options.name);

		return {
			module: QdrantModule,
			global: isGlobal,
			imports: options.imports ?? [],
			providers: [
				...asyncProviders,
				{
					provide: clientToken,
					useFactory: (opts: QdrantModuleOptions) => {
						const { name: _name, ...clientOptions } = opts;
						return new QdrantClient(clientOptions);
					},
					inject: [optionsToken],
				},
				{
					provide: QdrantService,
					useFactory: (client: QdrantClient) => new QdrantService(client),
					inject: [clientToken],
				},
			],
			exports: [QdrantService, clientToken],
		};
	}

	/**
	 * Create providers for async configuration
	 * @param options Async configuration options
	 * @returns Array of providers for async setup
	 * @private
	 */
	private static createAsyncProviders(options: QdrantModuleAsyncOptions): Provider[] {
		if (options.useExisting || options.useFactory) {
			return [QdrantModule.createAsyncOptionsProvider(options)];
		}
		if (options.useClass) {
			return [
				QdrantModule.createAsyncOptionsProvider(options),
				{ provide: options.useClass, useClass: options.useClass },
			];
		}
		throw new Error('Invalid QdrantModuleAsyncOptions: must provide useFactory, useClass, or useExisting');
	}

	/**
	 * Create the async options provider
	 * @param options Async configuration options
	 * @returns Provider for module options
	 * @private
	 */
	private static createAsyncOptionsProvider(options: QdrantModuleAsyncOptions): Provider {
		const optionsToken = getQdrantModuleOptionsToken(options.name);

		if (options.useFactory) {
			return {
				provide: optionsToken,
				useFactory: async (...args: unknown[]) => {
					try {
						const result = options.useFactory?.(...args);
						// Handle both sync and async results
						if (result instanceof Promise) {
							const opts = await result;
							const { name: _name, apiKey: _apiKey, ...cleanOptions } = opts;
							return cleanOptions;
						}
						const { name: _name, apiKey: _apiKey, ...cleanOptions } = result as QdrantModuleOptions;
						return cleanOptions;
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						throw new Error(`QdrantModule async factory failed: ${errorMessage}`);
					}
				},
				inject: (options.inject ?? []) as Array<InjectionToken | OptionalFactoryDependency>,
			};
		}
		return {
			provide: optionsToken,
			// The factory receives a QdrantOptionsFactory instance which may be async
			useFactory: async (factory: QdrantOptionsFactory) => {
				try {
					const opts = await factory.createQdrantOptions();
					const { name: _name, apiKey: _apiKey, ...cleanOptions } = opts;
					return cleanOptions;
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					throw new Error(`QdrantModule async factory failed: ${errorMessage}`);
				}
			},
			inject: [options.useExisting ?? options.useClass] as InjectionToken[],
		};
	}
}
