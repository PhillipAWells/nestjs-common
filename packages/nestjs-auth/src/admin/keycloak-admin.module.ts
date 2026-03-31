import { Module, DynamicModule, Global } from '@nestjs/common';
import { CommonModule } from '@pawells/nestjs-shared/common';
import { KeycloakAdminService } from './services/keycloak-admin.service.js';
import { KeycloakHealthIndicator } from './health/keycloak.health.js';
import { KEYCLOAK_ADMIN_CONFIG_TOKEN } from './keycloak.constants.js';
import type { IKeycloakAdminConfig } from './config/keycloak.config.js';
import { KeycloakAdminDefaults, ValidateKeycloakAdminConfig } from './config/keycloak.defaults.js';
import type { IKeycloakAdminModuleAsyncOptions } from './keycloak-admin.interfaces.js';

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
	public static ForRoot(config: Partial<IKeycloakAdminConfig> = {}): DynamicModule {
		const MergedConfig = { ...KeycloakAdminDefaults, ...config };
		ValidateKeycloakAdminConfig(MergedConfig);

		// Validate that credentials are provided if Keycloak is enabled
		if (MergedConfig.enabled && MergedConfig.credentials) {
			const Creds = MergedConfig.credentials;
			if (Creds.type === 'password') {
				if (!Creds.username || !Creds.password) {
					throw new Error('Keycloak enabled but username/password credentials are empty. Set KEYCLOAK_USERNAME and KEYCLOAK_PASSWORD environment variables.');
				}
			} else if (Creds.type === 'clientCredentials') {
				if (!Creds.clientId || !Creds.clientSecret) {
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
					useValue: MergedConfig,
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
	public static ForRootAsync(options: IKeycloakAdminModuleAsyncOptions): DynamicModule {
		return {
			module: KeycloakAdminModule,
			imports: [CommonModule, ...(options.imports ?? [])],
			providers: [
				{
					provide: KEYCLOAK_ADMIN_CONFIG_TOKEN,
					useFactory: async (...args: unknown[]) => {
						const Config = await options.useFactory(...args);
						ValidateKeycloakAdminConfig(Config);

						// Validate that credentials are provided if Keycloak is enabled
						if (Config.enabled && Config.credentials) {
							const Creds = Config.credentials;
							if (Creds.type === 'password') {
								if (!Creds.username || !Creds.password) {
									throw new Error('Keycloak enabled but username/password credentials are empty. Set KEYCLOAK_USERNAME and KEYCLOAK_PASSWORD environment variables.');
								}
							} else if (Creds.type === 'clientCredentials') {
								if (!Creds.clientId || !Creds.clientSecret) {
									throw new Error('Keycloak enabled but clientId/clientSecret credentials are empty. Set KEYCLOAK_CLIENT_ID and KEYCLOAK_CLIENT_SECRET environment variables.');
								}
							}
						}

						return Config;
					},
					inject: options.inject ?? [],
				},
				KeycloakAdminService,
				KeycloakHealthIndicator,
			],
			exports: [KeycloakAdminService, KeycloakHealthIndicator],
		};
	}
}
