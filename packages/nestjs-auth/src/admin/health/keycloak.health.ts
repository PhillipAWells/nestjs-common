import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { KeycloakAdminService } from '../services/keycloak-admin.service.js';
import { getErrorMessage } from '@pawells/nestjs-shared/common';
import { KEYCLOAK_ADMIN_CONFIG_TOKEN } from '../keycloak.constants.js';
import type { KeycloakAdminConfig } from '../config/keycloak.config.js';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';

@Injectable()
export class KeycloakHealthIndicator extends HealthIndicator implements LazyModuleRefService {
	public get KeycloakAdminService(): KeycloakAdminService {
		return this.Module.get(KeycloakAdminService);
	}

	public get Config(): KeycloakAdminConfig {
		return this.Module.get(KEYCLOAK_ADMIN_CONFIG_TOKEN, { strict: false });
	}

	constructor(public readonly Module: ModuleRef) {
		super();
	}

	public check(key: string): HealthIndicatorResult {
		if (!this.Config.enabled) {
			return this.getStatus(key, true, { enabled: false });
		}

		try {
			const isAuthenticated = this.KeycloakAdminService.isAuthenticated();
			const client = this.KeycloakAdminService.getClient();

			return this.getStatus(key, isAuthenticated, {
				authenticated: isAuthenticated,
				baseUrl: this.Config.baseUrl,
				realm: this.Config.realmName,
				initialized: client !== null,
			});
		} catch (error) {
			return this.getStatus(key, false, {
				error: getErrorMessage(error),
			});
		}
	}
}
