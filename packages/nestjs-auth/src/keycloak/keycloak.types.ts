export interface IKeycloakModuleOptions {
	/** Keycloak realm base URL — e.g. 'https://auth.example.com/realms/myrealm' */
	authServerUrl: string;
	/** Realm name */
	realm: string;
	/** This service's Keycloak client ID — used for audience validation and client role extraction */
	clientId: string;
	/**
	 * Token validation mode.
	 * - 'online' (default): validate via Keycloak introspection — authoritative, detects revocation immediately
	 * - 'offline': validate JWT locally using JWKS — fast, no network hop, does not detect revocation
	 */
	validationMode?: 'online' | 'offline';
	/** Required when validationMode is 'online' (the default). Client secret for the introspection endpoint. */
	clientSecret?: string;
	/** JWKS cache TTL in milliseconds. Used in offline mode only. Default: 300000 (5 minutes). */
	jwksCacheTtlMs?: number;
	/**
	 * Expected token issuer. Must match the 'iss' claim exactly.
	 * Defaults to authServerUrl.
	 */
	issuer?: string;
}

export interface IKeycloakTokenClaims {
	sub: string;
	iss: string;
	aud: string | string[];
	exp: number;
	iat: number;
	jti?: string;
	azp?: string;
	session_state?: string;
	email?: string;
	email_verified?: boolean;
	preferred_username?: string;
	name?: string;
	given_name?: string;
	family_name?: string;
	realm_access?: { roles: string[] };
	resource_access?: Record<string, { roles: string[] }>;
	scope?: string;
	[key: string]: unknown;
}

export interface IKeycloakUser {
	/** The user's unique ID (sub claim) */
	id: string;
	email?: string;
	/** preferred_username claim */
	username?: string;
	name?: string;
	/** Roles from realm_access.roles */
	realmRoles: string[];
	/** Roles from resource_access[clientId].roles */
	clientRoles: string[];
}

/**
 * Create a mock IKeycloakUser with sensible test defaults.
 * Override any field by passing a Partial<IKeycloakUser>.
 *
 * This is a pure data factory with no side effects — safe to use in any test context.
 *
 * @example
 * ```typescript
 * const adminUser = createMockKeycloakUser({ realmRoles: ['admin'] });
 * const guestUser = createMockKeycloakUser({ id: 'guest-id', clientRoles: [] });
 * ```
 */
export function CreateMockKeycloakUser(overrides: Partial<IKeycloakUser> = {}): IKeycloakUser {
	return {
		id: 'test-user-id',
		email: 'test@example.com',
		username: 'test-user',
		name: 'Test IUser',
		realmRoles: [],
		clientRoles: [],
		...overrides,
	};
}
