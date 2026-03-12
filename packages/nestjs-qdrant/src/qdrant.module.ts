/**
 * Qdrant NestJS Module
 * Integrates Qdrant vector database client with NestJS dependency injection
 */

import { DynamicModule, Module, Provider } from '@nestjs/common';
import type { InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
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
		const clientToken = getQdrantClientToken(options.name);
		const optionsToken = getQdrantModuleOptionsToken(options.name);
		// Internal token for raw (unsanitized) options — includes apiKey for client creation
		const rawOptionsToken = Symbol('QDRANT_RAW_OPTIONS');

		const rawProviders = QdrantModule.createAsyncProviders(options, rawOptionsToken);

		return {
			module: QdrantModule,
			global: isGlobal,
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
	 * @param token Token to provide the options under
	 * @returns Array of providers for async setup
	 * @private
	 */
	private static createAsyncProviders(options: QdrantModuleAsyncOptions, token: symbol): Provider[] {
		if (options.useExisting || options.useFactory) {
			return [QdrantModule.createAsyncOptionsProvider(options, token)];
		}
		if (options.useClass) {
			return [
				QdrantModule.createAsyncOptionsProvider(options, token),
				{ provide: options.useClass, useClass: options.useClass },
			];
		}
		throw new Error('Invalid QdrantModuleAsyncOptions: must provide useFactory, useClass, or useExisting');
	}

	/**
	 * Create the async options provider
	 * @param options Async configuration options
	 * @param token Token to provide the options under
	 * @returns Provider for module options
	 * @private
	 */
	private static createAsyncOptionsProvider(options: QdrantModuleAsyncOptions, token: symbol): Provider {
		if (options.useFactory) {
			const factory = options.useFactory;
			return {
				provide: token,
				useFactory: async (...args: unknown[]) => {
					try {
						const opts = await factory(...args);
						return opts;
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						throw new Error(`QdrantModule async factory failed: ${errorMessage}`, { cause: error });
					}
				},
				inject: (options.inject ?? []) as Array<InjectionToken | OptionalFactoryDependency>,
			};
		}
		// At this point, useExisting or useClass is guaranteed to be set by createAsyncProviders
		const factoryClass = options.useExisting ?? options.useClass;
		return {
			provide: token,
			// The factory receives a QdrantOptionsFactory instance which may be async
			useFactory: async (factory: QdrantOptionsFactory) => {
				try {
					const opts = await factory.createQdrantOptions();
					return opts;
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					throw new Error(`QdrantModule async factory failed: ${errorMessage}`, { cause: error });
				}
			},
			inject: factoryClass ? [factoryClass] : [],
		};
	}
}
