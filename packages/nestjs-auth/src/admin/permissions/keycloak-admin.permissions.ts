/**
 * Permission scopes for the Keycloak Admin API.
 *
 * Each scope controls access to a category of Keycloak Admin REST API operations.
 * Scopes ending in `:read` permit query/list operations only.
 * Scopes ending in `:write` permit create/update/delete/mutation operations.
 *
 * @see {@link KEYCLOAK_DEFAULT_SCOPES} for the default read-only set
 * @see {@link KEYCLOAK_ALL_SCOPES} for the full set including all write scopes
 */
export type KeycloakAdminScope =
	| 'users:read'
	| 'users:write'
	| 'roles:read'
	| 'roles:write'
	| 'groups:read'
	| 'groups:write'
	| 'federated-identity:read'
	| 'federated-identity:write'
	| 'events:read'
	| 'clients:read'
	| 'clients:write'
	| 'realms:read'
	| 'realms:write'
	| 'identity-providers:read'
	| 'identity-providers:write'
	| 'authentication:read'
	| 'authentication:write';

/**
 * The default set of scopes granted when no `permissions` array is configured.
 * Contains all read-only scopes. No write scopes are included.
 */
export const KEYCLOAK_DEFAULT_SCOPES: readonly KeycloakAdminScope[] = Object.freeze([
	'users:read',
	'roles:read',
	'groups:read',
	'federated-identity:read',
	'events:read',
	'clients:read',
	'realms:read',
	'identity-providers:read',
	'authentication:read',
]);

/**
 * All available scopes, including all write scopes.
 * Use this as a convenience constant for adapter microservices that require
 * full access. Ensure the Keycloak service account has all corresponding roles.
 */
export const KEYCLOAK_ALL_SCOPES: readonly KeycloakAdminScope[] = Object.freeze([
	'users:read',
	'users:write',
	'roles:read',
	'roles:write',
	'groups:read',
	'groups:write',
	'federated-identity:read',
	'federated-identity:write',
	'events:read',
	'clients:read',
	'clients:write',
	'realms:read',
	'realms:write',
	'identity-providers:read',
	'identity-providers:write',
	'authentication:read',
	'authentication:write',
]);

/**
 * Thrown when a Keycloak Admin API operation is called but the required
 * permission scope has not been granted in the module configuration.
 *
 * This is a **configuration error**, not a Keycloak HTTP error. It is thrown
 * synchronously before any network request is made.
 *
 * @example
 * ```typescript
 * try {
 *   await keycloakAdminService.users.create(realm, user);
 * } catch (error) {
 *   if (error instanceof KeycloakAdminScopeError) {
 *     // Service is not configured to create users
 *   }
 * }
 * ```
 */
export class KeycloakAdminScopeError extends Error {
	public readonly scope: KeycloakAdminScope;

	constructor(scope: KeycloakAdminScope) {
		super(
			`Keycloak admin mutation blocked: scope '${scope}' is not granted. ` +
			`Add '${scope}' to the permissions array in KeycloakAdminModule.forRoot() config.`,
		);
		this.name = 'KeycloakAdminScopeError';
		this.scope = scope;
		Error.captureStackTrace(this, this.constructor);
	}
}
