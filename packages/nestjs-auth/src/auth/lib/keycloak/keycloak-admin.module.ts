import { Module, DynamicModule, Global } from '@nestjs/common';
import { CommonModule } from '@pawells/nestjs-shared/common';
import { KeycloakAdminService } from './services/keycloak-admin.service.js';
import { KeycloakHealthIndicator } from './health/keycloak.health.js';
import { KEYCLOAK_ADMIN_CONFIG_TOKEN } from './keycloak.constants.js';
import type { KeycloakAdminConfig } from './config/keycloak.config.js';
import { KeycloakAdminDefaults, validateKeycloakAdminConfig } from './config/keycloak.defaults.js';

@Global()
@Module({})
export class KeycloakAdminModule {
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
			global: true,
		};
	}

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
			global: true,
		};
	}
}
