import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { KeycloakAdminService } from '../services/keycloak-admin.service.js';
import { getErrorMessage } from '@pawells/nestjs-shared/common';
import { KEYCLOAK_ADMIN_CONFIG_TOKEN } from '../keycloak.constants.js';
import type { IKeycloakAdminConfig } from '../config/keycloak.config.js';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';

@Injectable()
export class KeycloakHealthIndicator extends HealthIndicator implements ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get KeycloakAdminService(): KeycloakAdminService {
		return this.Module.get(KeycloakAdminService);
	}

	public get Config(): IKeycloakAdminConfig {
		return this.Module.get(KEYCLOAK_ADMIN_CONFIG_TOKEN, { strict: false });
	}

	constructor(module: ModuleRef) {
		super();
		this.Module = module;
	}

	public Check(key: string): HealthIndicatorResult {
		if (!this.Config.enabled) {
			return this.getStatus(key, true, { enabled: false });
		}

		try {
			const IsAuthenticated = this.KeycloakAdminService.IsAuthenticated();
			const Client = this.KeycloakAdminService.GetClient();

			return this.getStatus(key, IsAuthenticated, {
				authenticated: IsAuthenticated,
				baseUrl: this.Config.baseUrl,
				realm: this.Config.realmName,
				initialized: Client !== null,
			});
		} catch (error) {
			return this.getStatus(key, false, {
				error: getErrorMessage(error),
			});
		}
	}
}
