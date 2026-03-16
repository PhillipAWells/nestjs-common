import { randomUUID } from 'node:crypto';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import type { KeycloakClientConfig } from './types/index.js';
import { isPasswordCredentials, isClientCredentials } from './types/index.js';
import type { KeycloakAdminScope } from '../permissions/keycloak-admin.permissions.js';
import {
	RealmService,
	UserService,
	ClientService,
	RoleService,
	GroupService,
	IdentityProviderService,
	AuthenticationService,
	FederatedIdentityService,
	EventService,
} from './services/index.js';

// Short client identifier length (last N characters of UUID)
const CLIENT_ID_SHORT_LENGTH = 12;

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
	 * Federated identity service
	 */
	public readonly FederatedIdentities: FederatedIdentityService;

	/**
	 * Event service for querying admin and access events
	 */
	public readonly Events: EventService;

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
	constructor(config: KeycloakClientConfig, grantedScopes: ReadonlySet<KeycloakAdminScope>) {
		this.config = {
			realmName: 'master',
			timeout: 30000,
			...config,
		};

		// Generate client identifiers
		this.ClientUUID = randomUUID();
		this.ClientID = this.ClientUUID.slice(-CLIENT_ID_SHORT_LENGTH);

		// Initialize admin client
		this.adminClient = new KcAdminClient({
			baseUrl: this.config.baseUrl,
			...(this.config.realmName && { realmName: this.config.realmName }),
		});

		// Initialize services
		const { logger, retry } = this.config;

		this.Realms = new RealmService(this.adminClient, grantedScopes, logger, retry);
		this.Users = new UserService(this.adminClient, grantedScopes, logger, retry);
		this.Clients = new ClientService(this.adminClient, grantedScopes, logger, retry);
		this.Roles = new RoleService(this.adminClient, grantedScopes, logger, retry);
		this.Groups = new GroupService(this.adminClient, grantedScopes, logger, retry);
		this.IdentityProviders = new IdentityProviderService(this.adminClient, grantedScopes, logger, retry);
		this.Authentication = new AuthenticationService(this.adminClient, grantedScopes, logger, retry);
		this.FederatedIdentities = new FederatedIdentityService(this.adminClient, grantedScopes, logger, retry);
		this.Events = new EventService(this.adminClient, grantedScopes, logger, retry);

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
