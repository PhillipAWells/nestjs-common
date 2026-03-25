import { ModuleMetadata } from '@nestjs/common';
import type { InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
import type { KeycloakAdminConfig } from './config/keycloak.config.js';

/**
 * Async options for KeycloakAdminModule configuration
 */
export interface KeycloakAdminModuleAsyncOptions {
	imports?: ModuleMetadata['imports'];
	useFactory: (...args: unknown[]) => Promise<KeycloakAdminConfig> | KeycloakAdminConfig;
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}
