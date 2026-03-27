import { ModuleMetadata } from '@nestjs/common';
import type { InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
import type { KeycloakAdminConfig } from './config/keycloak.config.js';

/**
 * Async options for KeycloakAdminModule configuration.
 *
 * Used to defer KeycloakAdminModule setup until runtime dependencies are available.
 * Supports factory functions that return configuration synchronously or asynchronously.
 *
 * @example
 * ```typescript
 * KeycloakAdminModule.forRootAsync({
 *   imports: [ConfigModule],
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     enabled: config.get('KEYCLOAK_ADMIN_ENABLED') === 'true',
 *     baseUrl: config.get('KEYCLOAK_BASE_URL'),
 *     realmName: config.get('KEYCLOAK_REALM'),
 *     credentials: {
 *       type: 'clientCredentials',
 *       clientId: config.get('KEYCLOAK_ADMIN_CLIENT_ID'),
 *       clientSecret: config.get('KEYCLOAK_ADMIN_CLIENT_SECRET'),
 *     },
 *   }),
 * })
 * ```
 */
export interface KeycloakAdminModuleAsyncOptions {
	/**
	 * Modules to import for dependency resolution.
	 * Typically includes {@link ConfigModule} if reading from environment.
	 */
	imports?: ModuleMetadata['imports'];

	/**
	 * Factory function that returns KeycloakAdminConfig (sync or async).
	 * Receives injected dependencies as arguments.
	 */
	useFactory: (...args: unknown[]) => Promise<KeycloakAdminConfig> | KeycloakAdminConfig;

	/**
	 * Array of providers to inject into the factory function.
	 * Common values: {@link ConfigService}, custom services, etc.
	 */
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}
