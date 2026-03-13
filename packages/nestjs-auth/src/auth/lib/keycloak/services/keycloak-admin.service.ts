import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { KeycloakClient } from '../client/client.js';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { KEYCLOAK_ADMIN_CONFIG_TOKEN } from '../keycloak.constants.js';
import type { KeycloakAdminConfig } from '../config/keycloak.config.js';
import type { UserService } from '../client/services/user.service.js';
import type { RealmService } from '../client/services/realm.service.js';
import type { ClientService } from '../client/services/client.service.js';
import type { RoleService } from '../client/services/role.service.js';
import type { GroupService } from '../client/services/group.service.js';
import type { IdentityProviderService } from '../client/services/identity-provider.service.js';
import type { AuthenticationService } from '../client/services/authentication.service.js';

@Injectable()
export class KeycloakAdminService implements OnModuleInit, LazyModuleRefService {
	private readonly logger = new Logger(KeycloakAdminService.name);

	private client: KeycloakClient | null = null;

	public get Config(): KeycloakAdminConfig {
		return this.Module.get(KEYCLOAK_ADMIN_CONFIG_TOKEN, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	constructor(public readonly Module: ModuleRef) {}

	public async onModuleInit(): Promise<void> {
		if (!this.Config.enabled) {
			this.logger.log('Keycloak admin client is disabled, skipping initialization');
			return;
		}

		try {
			this.logger.log('Initializing Keycloak admin client...');
			const { type: _type, ...credentialsWithoutType } = this.Config.credentials as { type: string; [key: string]: string };
			this.client = new KeycloakClient({
				baseUrl: this.Config.baseUrl,
				realmName: this.Config.realmName,
				credentials: credentialsWithoutType as any,
				timeout: this.Config.timeout,
				retry: this.Config.retry,
			});

			await this.client.authenticate();
			this.logger.log('Keycloak admin client initialized successfully');
		} catch (error) {
			this.logger.error(
				'Failed to initialize Keycloak admin client',
				error instanceof Error ? error.stack : String(error),
			);
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
}
