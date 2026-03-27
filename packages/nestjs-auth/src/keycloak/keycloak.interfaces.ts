import { ModuleMetadata } from '@nestjs/common';
import type { InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
import type { KeycloakModuleOptions } from './keycloak.types.js';

/**
 * Async options for KeycloakModule configuration
 */
export interface KeycloakModuleAsyncOptions {
	imports?: ModuleMetadata['imports'];
	useFactory: (...args: unknown[]) => Promise<KeycloakModuleOptions> | KeycloakModuleOptions;
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}
