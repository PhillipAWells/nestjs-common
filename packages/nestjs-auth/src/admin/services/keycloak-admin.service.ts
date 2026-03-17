import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { KeycloakClient } from '../client/client.js';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { KEYCLOAK_ADMIN_CONFIG_TOKEN } from '../keycloak.constants.js';
import type { KeycloakAdminConfig } from '../config/keycloak.config.js';
import { KEYCLOAK_DEFAULT_SCOPES } from '../permissions/keycloak-admin.permissions.js';
import type { KeycloakAdminScope } from '../permissions/keycloak-admin.permissions.js';
import type { UserService } from '../client/services/user.service.js';
import type { RealmService } from '../client/services/realm.service.js';
import type { ClientService } from '../client/services/client.service.js';
import type { RoleService } from '../client/services/role.service.js';
import type { GroupService } from '../client/services/group.service.js';
import type { IdentityProviderService } from '../client/services/identity-provider.service.js';
import type { AuthenticationService } from '../client/services/authentication.service.js';
import type { FederatedIdentityService } from '../client/services/federated-identity.service.js';
import type { EventService } from '../client/services/event.service.js';

@Injectable()
export class KeycloakAdminService implements OnModuleInit, LazyModuleRefService {
	private readonly logger: AppLogger;

	private client: KeycloakClient | null = null;

	private grantedScopes: ReadonlySet<KeycloakAdminScope> = new Set(KEYCLOAK_DEFAULT_SCOPES) as ReadonlySet<KeycloakAdminScope>;

	public get Config(): KeycloakAdminConfig {
		return this.Module.get(KEYCLOAK_ADMIN_CONFIG_TOKEN, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	constructor(public readonly Module: ModuleRef) {
		this.logger = new AppLogger(undefined, KeycloakAdminService.name);
	}

	public async onModuleInit(): Promise<void> {
		if (!this.Config.enabled) {
			this.logger.info('Keycloak admin client is disabled, skipping initialization');
			return;
		}

		try {
			this.logger.info('Initializing Keycloak admin client...');

			// Build and validate permission scopes
			const scopes = this.Config.permissions ?? [...KEYCLOAK_DEFAULT_SCOPES];
			this.grantedScopes = new Set(scopes) as ReadonlySet<KeycloakAdminScope>;

			if (!this.Config.permissions) {
				this.logger.warn(
					'KeycloakAdminModule: no permissions configured — defaulting to read-only scopes. ' +
						'To grant write access, set the permissions array in KeycloakAdminModule.forRoot() config.',
				);
			}

			const { type: _type, ...credentialsWithoutType } = this.Config.credentials as { type: string; [key: string]: string };
			this.client = new KeycloakClient(
				{
					baseUrl: this.Config.baseUrl,
					realmName: this.Config.realmName,
					credentials: credentialsWithoutType as any,
					timeout: this.Config.timeout,
					retry: this.Config.retry,
				},
				this.grantedScopes,
			);

			await this.client.authenticate();
			this.logger.info('Keycloak admin client initialized successfully');
		} catch (error) {
			this.logger.error(
				`Failed to initialize Keycloak admin client: ${error instanceof Error ? error.message : String(error)}`,
			);
			// Re-throw if Keycloak is enabled, so startup fails loudly instead of silently
			if (this.Config.enabled) {
				throw error;
			}
		}
	}

	public getClient(): KeycloakClient | null {
		return this.client;
	}

	public isEnabled(): boolean {
		return this.Config.enabled;
	}

	public isAuthenticated(): boolean {
		return this.client?.isAuthenticated() ?? false;
	}

	// Proxy methods to client services
	public get users(): UserService {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Users;
	}

	public get realms(): RealmService {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Realms;
	}

	public get clients(): ClientService {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Clients;
	}

	public get roles(): RoleService {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Roles;
	}

	public get groups(): GroupService {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Groups;
	}

	public get identityProviders(): IdentityProviderService {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.IdentityProviders;
	}

	public get authentication(): AuthenticationService {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Authentication;
	}

	/**
	 * Get the federated identity service for managing identity provider links
	 *
	 * Provides methods to list, link, and unlink external identity providers for users.
	 *
	 * @returns FederatedIdentityService instance
	 * @throws {Error} If Keycloak client is not initialized
	 *
	 * @example
	 * ```typescript
	 * const links = await keycloakAdmin.federatedIdentity.list(userId);
	 * ```
	 */
	public get federatedIdentity(): FederatedIdentityService {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.FederatedIdentities;
	}

	/**
	 * Get the event service for querying realm events
	 *
	 * Provides methods to query administrative and access events for audit logging and monitoring.
	 *
	 * @returns EventService instance
	 * @throws {Error} If Keycloak client is not initialized
	 *
	 * @example
	 * ```typescript
	 * const events = await keycloakAdmin.events.getAdminEvents({ max: 100 });
	 * ```
	 */
	public get events(): EventService {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Events;
	}
}
