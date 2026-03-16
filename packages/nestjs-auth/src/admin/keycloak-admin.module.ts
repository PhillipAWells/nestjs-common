import { Module, DynamicModule, Global } from '@nestjs/common';
import { CommonModule } from '@pawells/nestjs-shared/common';
import { KeycloakAdminService } from './services/keycloak-admin.service.js';
import { KeycloakHealthIndicator } from './health/keycloak.health.js';
import { KEYCLOAK_ADMIN_CONFIG_TOKEN } from './keycloak.constants.js';
import type { KeycloakAdminConfig } from './config/keycloak.config.js';
import { KeycloakAdminDefaults, validateKeycloakAdminConfig } from './config/keycloak.defaults.js';

/**
 * Keycloak Admin module for managing users, roles, and groups.
 * Provides Admin API client with configurable authentication methods.
 */
@Global()
@Module({})
export class KeycloakAdminModule {
	/**
	 * Create Keycloak admin module with static configuration
	 * @param config Partial Keycloak admin configuration
	 * @returns Dynamic module configuration
	 * @throws Error if Keycloak is enabled but credentials are missing
	 */
	public static forRoot(config: Partial<KeycloakAdminConfig> = {}): DynamicModule {
		const mergedConfig = { ...KeycloakAdminDefaults, ...config };
		validateKeycloakAdminConfig(mergedConfig);

		// Validate that credentials are provided if Keycloak is enabled
		if (mergedConfig.enabled && mergedConfig.credentials) {
			const creds = mergedConfig.credentials;
			if (creds.type === 'password') {
				if (!creds.username || !creds.password) {
					throw new Error('Keycloak enabled but username/password credentials are empty. Set KEYCLOAK_USERNAME and KEYCLOAK_PASSWORD environment variables.');
				}
			} else if (creds.type === 'clientCredentials') {
				if (!creds.clientId || !creds.clientSecret) {
					throw new Error('Keycloak enabled but clientId/clientSecret credentials are empty. Set KEYCLOAK_CLIENT_ID and KEYCLOAK_CLIENT_SECRET environment variables.');
				}
			}
		}

		return {
			module: KeycloakAdminModule,
			imports: [CommonModule],
			providers: [
				{
					provide: KEYCLOAK_ADMIN_CONFIG_TOKEN,
					useValue: mergedConfig,
				},
				KeycloakAdminService,
				KeycloakHealthIndicator,
			],
			exports: [KeycloakAdminService, KeycloakHealthIndicator],
		};
	}

	/**
	 * Create Keycloak admin module with asynchronous configuration
	 * @param options Async factory configuration
	 * @returns Dynamic module configuration
	 */
	public static forRootAsync(options: {
		useFactory: (...args: any[]) => Promise<KeycloakAdminConfig> | KeycloakAdminConfig;
		inject?: any[];
		imports?: any[];
	}): DynamicModule {
		return {
			module: KeycloakAdminModule,
			imports: [CommonModule, ...(options.imports ?? [])],
			providers: [
				{
					provide: KEYCLOAK_ADMIN_CONFIG_TOKEN,
					useFactory: options.useFactory,
					inject: options.inject ?? [],
				},
				KeycloakAdminService,
				KeycloakHealthIndicator,
			],
			exports: [KeycloakAdminService, KeycloakHealthIndicator],
		};
	}
}
