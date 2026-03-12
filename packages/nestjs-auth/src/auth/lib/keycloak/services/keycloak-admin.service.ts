import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { KeycloakClient } from '../client/client.js';
import { AppLogger } from '@pawells/nestjs-shared/common';
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
export class KeycloakAdminService implements OnModuleInit {
	private readonly logger = new Logger(KeycloakAdminService.name);

	private client: KeycloakClient | null = null;

	constructor(
		@Inject(KEYCLOAK_ADMIN_CONFIG_TOKEN) private readonly config: KeycloakAdminConfig,
		@Inject(AppLogger) private readonly appLogger: AppLogger,
	) {}

	public async onModuleInit(): Promise<void> {
		if (!this.config.enabled) {
			this.logger.log('Keycloak admin client is disabled, skipping initialization');
			return;
		}

		try {
			this.logger.log('Initializing Keycloak admin client...');
			const { type: _type, ...credentialsWithoutType } = this.config.credentials as { type: string; [key: string]: string };
			this.client = new KeycloakClient({
				baseUrl: this.config.baseUrl,
				realmName: this.config.realmName,
				credentials: credentialsWithoutType as any,
				timeout: this.config.timeout,
				retry: this.config.retry,
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
		return this.config.enabled;
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
