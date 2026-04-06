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

/**
 * Raw claims decoded from a Keycloak-issued JWT.
 *
 * These are the standard OpenID Connect and Keycloak-specific claims present in
 * access tokens. Additional custom claims added via Keycloak mappers are accessible
 * through the index signature.
 */
export interface IKeycloakTokenClaims {
	/** Subject — the Keycloak user ID (UUID) */
	sub: string;
	/** Token issuer URL — must match `authServerUrl` (or `issuer` if overridden) */
	iss: string;
	/** Intended audience(s) — must include this service's `clientId` */
	aud: string | string[];
	/** Expiration time (Unix seconds) */
	exp: number;
	/** Issued-at time (Unix seconds) */
	iat: number;
	/** Unique token ID */
	jti?: string;
	/** Authorized party — the client that requested the token */
	azp?: string;
	/** Keycloak session state identifier */
	session_state?: string;
	/** User email address */
	email?: string;
	/** Whether the user's email address has been verified */
	email_verified?: boolean;
	/** Preferred display username */
	preferred_username?: string;
	/** User's full name */
	name?: string;
	/** User's given (first) name */
	given_name?: string;
	/** User's family (last) name */
	family_name?: string;
	/** Realm-level role assignments */
	realm_access?: { roles: string[] };
	/** Client-level role assignments, keyed by client ID */
	resource_access?: Record<string, { roles: string[] }>;
	/** Space-separated OAuth 2.0 scopes granted to the token */
	scope?: string;
	/** Additional custom claims from Keycloak mappers */
	[key: string]: unknown;
}

/**
 * Normalised user identity extracted from a validated Keycloak token.
 *
 * Populated by `KeycloakTokenValidationService.ExtractUser` and attached to
 * `request.user` by `JwtAuthGuard`. Inject via `@CurrentUser()` in controllers
 * and resolvers.
 */
export interface IKeycloakUser {
	/** The user's unique Keycloak ID (`sub` claim) */
	id: string;
	/** User's email address (`email` claim), if present in the token */
	email?: string;
	/** Preferred display username (`preferred_username` claim) */
	username?: string;
	/** User's full name (`name` claim) */
	name?: string;
	/** Realm-level roles from `realm_access.roles` */
	realmRoles: string[];
	/** Client-level roles from `resource_access[clientId].roles` */
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
