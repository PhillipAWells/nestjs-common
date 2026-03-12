import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { KeycloakClient } from '../client/client.js';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { KEYCLOAK_ADMIN_CONFIG_TOKEN } from '../keycloak.constants.js';
import type { KeycloakAdminConfig } from '../config/keycloak.config.js';

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
	public get users() {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Users;
	}

	public get realms() {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Realms;
	}

	public get clients() {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Clients;
	}

	public get roles() {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Roles;
	}

	public get groups() {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Groups;
	}

	public get identityProviders() {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.IdentityProviders;
	}

	public get authentication() {
		if (!this.client) throw new Error('Keycloak client not initialized');
		return this.client.Authentication;
	}
}
