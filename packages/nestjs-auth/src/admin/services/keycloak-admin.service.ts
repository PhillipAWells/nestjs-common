import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { KeycloakClient } from '../client/client.js';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
import { KEYCLOAK_ADMIN_CONFIG_TOKEN } from '../keycloak.constants.js';
import type { IKeycloakAdminConfig } from '../config/keycloak.config.js';
import { KEYCLOAK_DEFAULT_SCOPES } from '../permissions/keycloak-admin.permissions.js';
import type { TKeycloakAdminScope } from '../permissions/keycloak-admin.permissions.js';
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
export class KeycloakAdminService implements OnModuleInit, ILazyModuleRefService {
	private readonly Logger: AppLogger;

	private Client: KeycloakClient | null = null;

	private GrantedScopes: ReadonlySet<TKeycloakAdminScope> = new Set(KEYCLOAK_DEFAULT_SCOPES) as ReadonlySet<TKeycloakAdminScope>;

	public readonly Module: ModuleRef;

	public get Config(): IKeycloakAdminConfig {
		return this.Module.get(KEYCLOAK_ADMIN_CONFIG_TOKEN, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	constructor(module: ModuleRef) {
		this.Module = module;
		this.Logger = new AppLogger(undefined, KeycloakAdminService.name);
	}

	public async onModuleInit(): Promise<void> {
		if (!this.Config.enabled) {
			this.Logger.info('Keycloak admin client is disabled, skipping initialization');
			return;
		}

		try {
			this.Logger.info('Initializing Keycloak admin client...');

			// Build and validate permission scopes
			const scopes = this.Config.permissions ?? [...KEYCLOAK_DEFAULT_SCOPES];
			this.GrantedScopes = new Set(scopes) as ReadonlySet<TKeycloakAdminScope>;

			if (!this.Config.permissions) {
				this.Logger.warn(
					'KeycloakAdminModule: no permissions configured — defaulting to read-only scopes. ' +
						'To grant write access, set the permissions array in KeycloakAdminModule.forRoot() config.',
				);
			}

			const { type: _type, ...credentialsWithoutType } = this.Config.credentials as { type: string; [key: string]: string };
			this.Client = new KeycloakClient(
				{
					baseUrl: this.Config.baseUrl,
					realmName: this.Config.realmName,
					credentials: credentialsWithoutType as unknown as typeof this.Config.credentials,
					timeout: this.Config.timeout,
					retry: this.Config.retry,
				},
				this.GrantedScopes,
			);

			await this.Client.authenticate();
			this.Logger.info('Keycloak admin client initialized successfully');
		} catch (error) {
			this.Logger.error(
				`Failed to initialize Keycloak admin client: ${getErrorMessage(error)}`,
			);
			// Re-throw if Keycloak is enabled, so startup fails loudly instead of silently
			if (this.Config.enabled) {
				throw error;
			}
		}
	}

	public getClient(): KeycloakClient | null {
		return this.Client;
	}

	public isEnabled(): boolean {
		return this.Config.enabled;
	}

	public isAuthenticated(): boolean {
		return this.Client?.isAuthenticated() ?? false;
	}

	// Proxy methods to client services
	public get users(): UserService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Users;
	}

	public get realms(): RealmService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Realms;
	}

	public get clients(): ClientService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Clients;
	}

	public get roles(): RoleService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Roles;
	}

	public get groups(): GroupService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Groups;
	}

	public get identityProviders(): IdentityProviderService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.IdentityProviders;
	}

	public get authentication(): AuthenticationService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Authentication;
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
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.FederatedIdentities;
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
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Events;
	}
}
