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

/**
 * NestJS service providing access to the Keycloak Admin REST API.
 *
 * Registered as a global singleton by `KeycloakAdminModule`. Inject it wherever
 * Keycloak user management, role/group administration, federated identity linking,
 * or event querying is required.
 *
 * Uses lazy loading via `ModuleRef` to avoid circular dependency issues at startup.
 * Call `isEnabled()` before using sub-services if the module may be disabled in the
 * current environment.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserManagementService {
 *   constructor(private readonly keycloak: KeycloakAdminService) {}
 *
 *   async createUser(realm: string, email: string): Promise<void> {
 *     if (!this.keycloak.IsEnabled()) return;
 *     await this.keycloak.Users.Create(realm, { email, enabled: true });
 *   }
 * }
 * ```
 */
@Injectable()
export class KeycloakAdminService implements OnModuleInit, ILazyModuleRefService {
	private readonly Logger: AppLogger;

	private Client: KeycloakClient | null = null;

	private GrantedScopes: ReadonlySet<TKeycloakAdminScope> = new Set(KEYCLOAK_DEFAULT_SCOPES) as ReadonlySet<TKeycloakAdminScope>;

	/** NestJS module reference used for lazy dependency resolution */
	public readonly Module: ModuleRef;

	/** Resolved admin configuration from the DI container */
	public get Config(): IKeycloakAdminConfig {
		return this.Module.get(KEYCLOAK_ADMIN_CONFIG_TOKEN, { strict: false });
	}

	/** Resolved application logger from the DI container */
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
			const Scopes = this.Config.permissions ?? [...KEYCLOAK_DEFAULT_SCOPES];
			this.GrantedScopes = new Set(Scopes) as ReadonlySet<TKeycloakAdminScope>;

			if (!this.Config.permissions) {
				this.Logger.warn(
					'KeycloakAdminModule: no permissions configured — defaulting to read-only scopes. ' +
						'To grant write access, set the permissions array in KeycloakAdminModule.forRoot() config.',
				);
			}

			const { type: _Type, ...CredentialsWithoutType } = this.Config.credentials as { type: string; [key: string]: string };
			this.Client = new KeycloakClient(
				{
					baseUrl: this.Config.baseUrl,
					realmName: this.Config.realmName,
					credentials: CredentialsWithoutType as unknown as typeof this.Config.credentials,
					timeout: this.Config.timeout,
					retry: this.Config.retry,
				},
				this.GrantedScopes,
			);

			await this.Client.Authenticate();
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

	/**
	 * Returns the underlying `KeycloakClient` instance, or `null` if the module is
	 * disabled or initialization failed.
	 */
	public GetClient(): KeycloakClient | null {
		return this.Client;
	}

	/**
	 * Returns `true` when `enabled` is `true` in the module configuration.
	 * Check this before calling sub-services in environments where the admin client
	 * may be intentionally disabled (e.g. tests or services that do not manage users).
	 */
	public IsEnabled(): boolean {
		return this.Config.enabled;
	}

	/**
	 * Returns `true` when the admin client has successfully authenticated with Keycloak.
	 * A `false` result means API calls will fail — the client is either disabled or
	 * authentication failed during module initialization.
	 */
	public IsAuthenticated(): boolean {
		return this.Client?.IsAuthenticated() ?? false;
	}

	/** User management service — create, read, update, delete users and manage role assignments */
	public get Users(): UserService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Users;
	}

	/** Realm management service — query and update realm-level configuration */
	public get Realms(): RealmService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Realms;
	}

	/** OAuth/OIDC client management service — manage clients and client scopes */
	public get Clients(): ClientService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Clients;
	}

	/** Role management service — manage realm-level and client-level roles */
	public get Roles(): RoleService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Roles;
	}

	/** Group management service — create and manage groups and group membership */
	public get Groups(): GroupService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Groups;
	}

	/** Identity provider management service — configure external identity providers */
	public get IdentityProviders(): IdentityProviderService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.IdentityProviders;
	}

	/** Authentication flow management service — manage authentication flows and executions */
	public get Authentication(): AuthenticationService {
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
	public get FederatedIdentity(): FederatedIdentityService {
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
	public get Events(): EventService {
		if (!this.Client) throw new Error('Keycloak client not initialized');
		return this.Client.Events;
	}
}
