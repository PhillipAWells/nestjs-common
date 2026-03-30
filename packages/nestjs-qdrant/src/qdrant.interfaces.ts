/**
 * Qdrant Module Interfaces
 * Defines types and interfaces for module configuration
 */

import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import type { QdrantClientParams } from '@qdrant/js-client-rest';

/**
 * Qdrant module configuration options.
 * Extends the Qdrant JS client constructor parameters with optional naming support.
 *
 * Uses plain typed interfaces (no Joi validation). All configuration comes from
 * QdrantClientParams and the optional name field.
 *
 * @example
 * ```typescript
 * interface MyQdrantOptions extends TQdrantModuleOptions {
 *   url: string;           // e.g., 'http://localhost:6333'
 *   apiKey?: string;       // Optional API key for authentication
 *   timeout?: number;      // Optional request timeout in ms
 *   retryAttempts?: number; // Optional retry configuration
 * }
 * ```
 */
export type TQdrantModuleOptions = QdrantClientParams & {
	/**
	 * Optional name for the Qdrant client instance.
	 * Used when registering multiple named Qdrant client instances in the same application.
	 * If not provided, the default client token is used.
	 */
	name?: string;
};

/**
 * Factory interface for creating Qdrant module options.
 * Implement this interface to create a custom options factory class for async configuration.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class QdrantConfigService implements IQdrantOptionsFactory {
 *   constructor(private ConfigService: ConfigService) {}
 *
 *   async createQdrantOptions(): Promise<TQdrantModuleOptions> {
 *     return {
 *       url: await this.ConfigService.get('QDRANT_URL'),
 *       apiKey: this.ConfigService.get('QDRANT_API_KEY'),
 *     };
 *   }
 * }
 * ```
 */
export interface IQdrantOptionsFactory {
	/**
	 * Create and return Qdrant module options.
	 * Can be synchronous or asynchronous.
	 *
	 * @returns Qdrant module options (or a Promise that resolves to options)
	 * @throws Error - If configuration cannot be resolved
	 */
	createQdrantOptions(): Promise<TQdrantModuleOptions> | TQdrantModuleOptions;
}

/**
 * Async configuration options for Qdrant module.
 * Supports three configuration strategies: useFactory, useClass, or useExisting.
 * Extends NestJS ModuleMetadata for imports support.
 *
 * @example
 * ```typescript
 * // Factory function strategy
 * QdrantModule.forRootAsync({
 *   imports: [ConfigModule],
 *   inject: [ConfigService],
 *   useFactory: async (config: ConfigService) => ({
 *     url: config.get('QDRANT_URL'),
 *     apiKey: config.get('QDRANT_API_KEY'),
 *   })
 * })
 *
 * // Class-based factory strategy
 * QdrantModule.forRootAsync({
 *   useClass: QdrantConfigService
 * })
 *
 * // Reuse existing factory strategy
 * QdrantModule.forRootAsync({
 *   useExisting: QdrantConfigService
 * })
 * ```
 */
export interface IQdrantModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	/**
	 * Reuse an existing Qdrant options factory instance.
	 * The factory will be retrieved from the dependency injection container.
	 * Useful for reusing a factory defined in another module.
	 */
	useExisting?: Type<IQdrantOptionsFactory>;

	/**
	 * Use a class to create Qdrant options.
	 * The class must implement IQdrantOptionsFactory.
	 * The class will be instantiated by NestJS and its createQdrantOptions() method called.
	 */
	useClass?: Type<IQdrantOptionsFactory>;

	/**
	 * Use a factory function to create Qdrant options.
	 * The function receives dependencies from the inject array as parameters.
	 * Can be synchronous or async (must return Promise if async).
	 */
	useFactory?: (...args: unknown[]) => Promise<TQdrantModuleOptions> | TQdrantModuleOptions;

	/**
	 * Dependencies to inject into the factory function.
	 * Each item will be resolved from the dependency injection container and passed as an argument.
	 * Only applies when useFactory is specified.
	 */
	inject?: Array<InjectionToken | OptionalFactoryDependency>;

	/**
	 * Optional name for the Qdrant client instance.
	 * Used when registering multiple named Qdrant client instances.
	 * If not provided, the default client token is used.
	 */
	name?: string;
}
