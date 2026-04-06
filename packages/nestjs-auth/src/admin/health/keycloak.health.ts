import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { KeycloakAdminService } from '../services/keycloak-admin.service.js';
import { getErrorMessage } from '@pawells/nestjs-shared/common';
import { KEYCLOAK_ADMIN_CONFIG_TOKEN } from '../keycloak.constants.js';
import type { IKeycloakAdminConfig } from '../config/keycloak.config.js';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';

/**
 * `@nestjs/terminus` health indicator for the Keycloak Admin API connection.
 *
 * Reports whether the admin client is initialized and currently authenticated.
 * When the module is disabled (`enabled: false`), the indicator reports healthy with
 * `{ enabled: false }` metadata — a disabled client is not considered an error.
 *
 * @example
 * ```typescript
 * @Controller('health')
 * export class HealthController {
 *   constructor(
 *     private readonly health: HealthCheckService,
 *     private readonly keycloak: KeycloakHealthIndicator,
 *   ) {}
 *
 *   @Get()
 *   check() {
 *     return this.health.check([
 *       () => this.keycloak.Check('keycloak'),
 *     ]);
 *   }
 * }
 * ```
 */
@Injectable()
export class KeycloakHealthIndicator extends HealthIndicator implements ILazyModuleRefService {
	/** NestJS module reference used for lazy dependency resolution */
	public readonly Module: ModuleRef;

	/** Resolved `KeycloakAdminService` from the DI container */
	public get KeycloakAdminService(): KeycloakAdminService {
		return this.Module.get(KeycloakAdminService);
	}

	/** Resolved admin configuration from the DI container */
	public get Config(): IKeycloakAdminConfig {
		return this.Module.get(KEYCLOAK_ADMIN_CONFIG_TOKEN, { strict: false });
	}

	constructor(module: ModuleRef) {
		super();
		this.Module = module;
	}

	/**
	 * Run the health check and return a `HealthIndicatorResult`.
	 *
	 * The indicator is healthy when the admin client is initialized and authenticated.
	 * When the module is disabled, the result is always healthy with `{ enabled: false }`.
	 *
	 * @param key - Identifier for this health indicator in the health check response
	 * @returns Health indicator result with authentication state and connection metadata
	 */
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
