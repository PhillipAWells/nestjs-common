import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { KeycloakAdminService } from '../services/keycloak-admin.service.js';
import { KEYCLOAK_ADMIN_CONFIG_TOKEN } from '../keycloak.constants.js';
import type { KeycloakAdminConfig } from '../config/keycloak.config.js';

@Injectable()
export class KeycloakHealthIndicator extends HealthIndicator {
	constructor(
		@Inject(KeycloakAdminService) private readonly keycloakService: KeycloakAdminService,
		@Inject(KEYCLOAK_ADMIN_CONFIG_TOKEN) private readonly config: KeycloakAdminConfig,
	) {
		super();
	}

	public check(key: string): HealthIndicatorResult {
		if (!this.config.enabled) {
			return this.getStatus(key, true, { enabled: false });
		}

		try {
			const isAuthenticated = this.keycloakService.isAuthenticated();
			const client = this.keycloakService.getClient();

			return this.getStatus(key, isAuthenticated, {
				authenticated: isAuthenticated,
				baseUrl: this.config.baseUrl,
				realm: this.config.realmName,
				initialized: client !== null,
			});
		} catch (error) {
			return this.getStatus(key, false, {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
