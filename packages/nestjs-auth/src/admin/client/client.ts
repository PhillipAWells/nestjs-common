import { randomUUID } from 'node:crypto';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import type { IKeycloakClientConfig } from './types/index.js';
import { IsPasswordCredentials, IsClientCredentials } from './types/index.js';
import type { TKeycloakAdminScope } from '../permissions/keycloak-admin.permissions.js';
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
	 * IUser service for managing users
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
	private readonly AdminClient: KcAdminClient;

	/**
	 * Client configuration
	 */
	private readonly Config: IKeycloakClientConfig;

	/**
	 * Create a new Keycloak client instance
	 */
	constructor(config: IKeycloakClientConfig, grantedScopes: ReadonlySet<TKeycloakAdminScope>) {
		this.Config = {
			realmName: 'master',
			timeout: 30000,
			...config,
		};

		// Generate client identifiers
		this.ClientUUID = randomUUID();
		this.ClientID = this.ClientUUID.slice(-CLIENT_ID_SHORT_LENGTH);

		// Initialize admin client
		this.AdminClient = new KcAdminClient({
			baseUrl: this.Config.baseUrl,
			...(this.Config.realmName && { realmName: this.Config.realmName }),
		});

		// Initialize services
		const { logger, retry } = this.Config;

		this.Realms = new RealmService(this.AdminClient, grantedScopes, logger, retry);
		this.Users = new UserService(this.AdminClient, grantedScopes, logger, retry);
		this.Clients = new ClientService(this.AdminClient, grantedScopes, logger, retry);
		this.Roles = new RoleService(this.AdminClient, grantedScopes, logger, retry);
		this.Groups = new GroupService(this.AdminClient, grantedScopes, logger, retry);
		this.IdentityProviders = new IdentityProviderService(this.AdminClient, grantedScopes, logger, retry);
		this.Authentication = new AuthenticationService(this.AdminClient, grantedScopes, logger, retry);
		this.FederatedIdentities = new FederatedIdentityService(this.AdminClient, grantedScopes, logger, retry);
		this.Events = new EventService(this.AdminClient, grantedScopes, logger, retry);

		if (this.Config.logger) {
			this.Config.logger.info('KeycloakClient initialized', {
				clientId: this.ClientID,
				baseUrl: this.Config.baseUrl,
				realm: this.Config.realmName,
			});
		}
	}

	/**
	 * Authenticate with Keycloak admin API
	 * This must be called before making API requests
	 */
	public async Authenticate(): Promise<void> {
		try {
			if (IsPasswordCredentials(this.Config.credentials)) {
				await this.AdminClient.auth({
					username: this.Config.credentials.username,
					password: this.Config.credentials.password,
					grantType: 'password',
					clientId: 'admin-cli',
				});

				if (this.Config.logger) {
					this.Config.logger.info('Authenticated with Keycloak using password credentials', {
						username: this.Config.credentials.username,
					});
				}
			} else if (IsClientCredentials(this.Config.credentials)) {
				await this.AdminClient.auth({
					grantType: 'client_credentials',
					clientId: this.Config.credentials.clientId,
					clientSecret: this.Config.credentials.clientSecret,
				});

				if (this.Config.logger) {
					this.Config.logger.info('Authenticated with Keycloak using client credentials', {
						clientId: this.Config.credentials.clientId,
					});
				}
			}
		} catch (error) {
			if (this.Config.logger) {
				this.Config.logger.error('Failed to authenticate with Keycloak', { error });
			}
			throw error;
		}
	}

	/**
	 * Check if the client is authenticated
	 */
	public IsAuthenticated(): boolean {
		return this.AdminClient.accessToken !== undefined;
	}

	/**
	 * Get the current access token
	 */
	public GetAccessToken(): string | undefined {
		return this.AdminClient.accessToken;
	}

	/**
	 * Set the access token manually (for use with external auth)
	 */
	public SetAccessToken(token: string): void {
		this.AdminClient.setAccessToken(token);
	}
}
