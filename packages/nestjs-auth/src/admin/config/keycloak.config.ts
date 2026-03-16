import type { KeycloakAdminScope } from '../permissions/keycloak-admin.permissions.js';

export interface KeycloakAdminConfig {
	enabled: boolean;
	baseUrl: string;
	realmName: string;
	credentials:
		| {
			type: 'password';
			username: string;
			password: string;
		}
		| {
			type: 'clientCredentials';
			clientId: string;
			clientSecret: string;
		};
	timeout?: number;
	retry?: {
		maxRetries: number;
		retryDelay: number;
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
	permissions?: KeycloakAdminScope[];
}
