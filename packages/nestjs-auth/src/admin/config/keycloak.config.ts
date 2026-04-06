import type { TKeycloakAdminScope } from '../permissions/keycloak-admin.permissions.js';

/**
 * Configuration options for `KeycloakAdminModule`.
 *
 * Passed to `KeycloakAdminModule.forRoot()` or returned by the factory in
 * `KeycloakAdminModule.forRootAsync()`.
 */
export interface IKeycloakAdminConfig {
	/** When `false`, the client is not initialized — useful for disabling in test environments */
	enabled: boolean;
	/** Keycloak server base URL (not realm-specific), e.g. `https://auth.example.com`. Default: `http://localhost:8080` */
	baseUrl: string;
	/** Target realm for all Admin API calls. Default: `master` */
	realmName: string;
	/**
	 * Credentials used to authenticate the admin service account with Keycloak.
	 *
	 * Use `type: 'clientCredentials'` with a service account for production deployments.
	 * Use `type: 'password'` with `admin-cli` for local development only.
	 */
	credentials:
		| {
			/** Password grant type — use for local development with admin-cli only */
			type: 'password';
			/** Admin username */
			username: string;
			/** Admin password */
			password: string;
		}
		| {
			/** Client credentials grant type — recommended for production */
			type: 'clientCredentials';
			/** Service account client ID */
			clientId: string;
			/** Service account client secret */
			clientSecret: string;
		};
	/** Request timeout in milliseconds. Default: `30000` */
	timeout?: number;
	/** Retry configuration for transient failures */
	retry?: {
		/** Maximum number of retry attempts. Default: `3` */
		maxRetries: number;
		/** Initial delay between retries in milliseconds. Default: `1000` */
		initialDelay: number;
	};
	/**
	 * Explicit list of permitted operation scopes.
	 *
	 * Defaults to all read-only scopes ({@link KEYCLOAK_DEFAULT_SCOPES}) when omitted.
	 * Write scopes must be explicitly declared.
	 *
	 * @example
	 * ```typescript
	 * permissions: ['users:read', 'users:write', 'federated-identity:read', 'federated-identity:write']
	 * ```
	 */
	permissions?: TKeycloakAdminScope[];
}
