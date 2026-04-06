import { ModuleMetadata } from '@nestjs/common';
import type { InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
import type { IKeycloakModuleOptions } from './keycloak.types.js';

/**
 * Async configuration options for `KeycloakModule.forRootAsync()`.
 *
 * Allows module configuration to be deferred until runtime, typically to read
 * values from environment variables via `ConfigService` or another async source.
 */
export interface IKeycloakModuleAsyncOptions {
	/** NestJS modules to import into the async factory's DI context */
	imports?: ModuleMetadata['imports'];
	/** Factory function returning `IKeycloakModuleOptions` (or a Promise of it) */
	useFactory: (...args: unknown[]) => Promise<IKeycloakModuleOptions> | IKeycloakModuleOptions;
	/** Providers to inject as arguments into `useFactory` */
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}
