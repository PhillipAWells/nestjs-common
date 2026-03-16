import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import type { ConnectionOptions } from '@nats-io/transport-node';

/** Options for configuring the NATS client connection. Extends the native nats ConnectionOptions. */
export type NatsModuleOptions = ConnectionOptions;

/** Factory interface for creating NATS module options asynchronously. */
export interface NatsOptionsFactory {
	createNatsOptions(): Promise<NatsModuleOptions> | NatsModuleOptions;
}

/** Async configuration options for NatsModule.forRootAsync(). */
export interface NatsModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	useExisting?: Type<NatsOptionsFactory>;
	useClass?: Type<NatsOptionsFactory>;
	useFactory?: (...args: unknown[]) => Promise<NatsModuleOptions> | NatsModuleOptions;
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}
