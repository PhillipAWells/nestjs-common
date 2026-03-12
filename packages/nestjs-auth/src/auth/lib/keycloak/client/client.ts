import { v4 as uuidv4 } from 'uuid';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import type { KeycloakClientConfig } from './types/index.js';
import { isPasswordCredentials, isClientCredentials } from './types/index.js';
import {
	RealmService,
	UserService,
	ClientService,
	RoleService,
	GroupService,
	IdentityProviderService,
	AuthenticationService,
} from './services/index.js';
import { CLIENT_ID_SHORT_LENGTH } from '../../../constants/auth-timeouts.constants.js';

/**
 * Keycloak Admin API client
 */
export class KeycloakClient {
	/**
	 * Unique identifier for this client instance
	 */
	public readonly ClientUUID: string;

	/**
	 * Short client identifier (last 12 characters of UUID)
	 */
	public readonly ClientID: string;

	/**
	 * Realm service for managing realms
	 */
	public readonly Realms: RealmService;

	/**
	 * User service for managing users
	 */
	public readonly Users: UserService;

	/**
	 * Client service for managing OAuth/OIDC clients
	 */
	public readonly Clients: ClientService;

	/**
	 * Role service for managing roles
	 */
	public readonly Roles: RoleService;

	/**
	 * Group service for managing groups
	 */
	public readonly Groups: GroupService;

	/**
	 * Identity provider service
	 */
	public readonly IdentityProviders: IdentityProviderService;

	/**
	 * Authentication service for managing auth flows
	 */
	public readonly Authentication: AuthenticationService;

	/**
	 * Internal Keycloak admin client
	 */
	private readonly adminClient: KcAdminClient;

	/**
	 * Client configuration
	 */
	private readonly config: KeycloakClientConfig;

	/**
	 * Create a new Keycloak client instance
	 */
	constructor(config: KeycloakClientConfig) {
		this.config = {
			realmName: 'master',
			timeout: 30000,
			...config,
		};

		// Generate client identifiers
		this.ClientUUID = uuidv4();
		this.ClientID = this.ClientUUID.slice(-CLIENT_ID_SHORT_LENGTH);

		// Initialize admin client
		this.adminClient = new KcAdminClient({
			baseUrl: this.config.baseUrl,
			...(this.config.realmName && { realmName: this.config.realmName }),
		});

		// Initialize services
		const { logger, retry } = this.config;

		this.Realms = new RealmService(this.adminClient, logger, retry);
		this.Users = new UserService(this.adminClient, logger, retry);
		this.Clients = new ClientService(this.adminClient, logger, retry);
		this.Roles = new RoleService(this.adminClient, logger, retry);
		this.Groups = new GroupService(this.adminClient, logger, retry);
		this.IdentityProviders = new IdentityProviderService(this.adminClient, logger, retry);
		this.Authentication = new AuthenticationService(this.adminClient, logger, retry);

		if (this.config.logger) {
			this.config.logger.info('KeycloakClient initialized', {
				clientId: this.ClientID,
				baseUrl: this.config.baseUrl,
				realm: this.config.realmName,
			});
		}
	}

	/**
	 * Authenticate with Keycloak admin API
	 * This must be called before making API requests
	 */
	public async authenticate(): Promise<void> {
		try {
			if (isPasswordCredentials(this.config.credentials)) {
				await this.adminClient.auth({
					username: this.config.credentials.username,
					password: this.config.credentials.password,
					grantType: 'password',
					clientId: 'admin-cli',
				});

				if (this.config.logger) {
					this.config.logger.info('Authenticated with Keycloak using password credentials', {
						username: this.config.credentials.username,
					});
				}
			} else if (isClientCredentials(this.config.credentials)) {
				await this.adminClient.auth({
					grantType: 'client_credentials',
					clientId: this.config.credentials.clientId,
					clientSecret: this.config.credentials.clientSecret,
				});

				if (this.config.logger) {
					this.config.logger.info('Authenticated with Keycloak using client credentials', {
						clientId: this.config.credentials.clientId,
					});
				}
			}
		} catch (error) {
			if (this.config.logger) {
				this.config.logger.error('Failed to authenticate with Keycloak', { error });
			}
			throw error;
		}
	}

	/**
	 * Check if the client is authenticated
	 */
	public isAuthenticated(): boolean {
		return this.adminClient.accessToken !== undefined;
	}

	/**
	 * Get the current access token
	 */
	public getAccessToken(): string | undefined {
		return this.adminClient.accessToken;
	}

	/**
	 * Set the access token manually (for use with external auth)
	 */
	public setAccessToken(token: string): void {
		this.adminClient.setAccessToken(token);
	}
}
