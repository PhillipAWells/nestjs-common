import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import type { NodeConnectionOptions } from '@nats-io/transport-node';

/** Options for configuring the NATS client connection. Extends the native nats NodeConnectionOptions. */
export type TNatsModuleOptions = NodeConnectionOptions;

/** Factory interface for creating NATS module options asynchronously. */
export interface INatsOptionsFactory {
	createNatsOptions(): Promise<TNatsModuleOptions> | TNatsModuleOptions;
}

/** Async configuration options for NatsModule.forRootAsync(). */
export interface INatsModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	useExisting?: Type<INatsOptionsFactory>;
	useClass?: Type<INatsOptionsFactory>;
	useFactory?: (...args: unknown[]) => Promise<TNatsModuleOptions> | TNatsModuleOptions;
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}
