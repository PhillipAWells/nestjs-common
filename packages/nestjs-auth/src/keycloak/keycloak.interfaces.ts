import { ModuleMetadata } from '@nestjs/common';
import type { InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
import type { IKeycloakModuleOptions } from './keycloak.types.js';

/**
 * Async options for KeycloakModule configuration
 */
export interface IKeycloakModuleAsyncOptions {
	imports?: ModuleMetadata['imports'];
	useFactory: (...args: unknown[]) => Promise<IKeycloakModuleOptions> | IKeycloakModuleOptions;
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}
