/**
 * Qdrant Module Interfaces
 * Defines types and interfaces for module configuration
 */

import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import type { QdrantClientParams } from '@qdrant/js-client-rest';

/**
 * Qdrant module options, extends QdrantClient constructor parameters
 */
export type QdrantModuleOptions = QdrantClientParams & {
	/**
	 * Optional name for the Qdrant client instance
	 * Used when registering multiple named clients
	 */
	name?: string;
};

/**
 * Factory interface for creating Qdrant module options
 */
export interface QdrantOptionsFactory {
	/**
	 * Create and return Qdrant module options
	 * @returns Promise or synchronous Qdrant module options
	 */
	createQdrantOptions(): Promise<QdrantModuleOptions> | QdrantModuleOptions;
}

/**
 * Async configuration options for Qdrant module
 */
export interface QdrantModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	/**
	 * Reuse an existing Qdrant options factory
	 */
	useExisting?: Type<QdrantOptionsFactory>;

	/**
	 * Use a class to create Qdrant options
	 */
	useClass?: Type<QdrantOptionsFactory>;

	/**
	 * Use a factory function to create Qdrant options
	 */
	useFactory?: (...args: unknown[]) => Promise<QdrantModuleOptions> | QdrantModuleOptions;

	/**
	 * Dependencies to inject into the factory function
	 */
	inject?: Array<InjectionToken | OptionalFactoryDependency>;

	/**
	 * Optional name for the Qdrant client instance
	 * Used when registering multiple named clients
	 */
	name?: string;
}
