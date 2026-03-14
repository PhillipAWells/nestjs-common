/**
 * Standard OAuth2/OIDC profile structure
 * Covers common fields from Google, GitHub, Keycloak, and other providers.
 * Used for extracting user information from OAuth access tokens.
 */
export interface OAuthProfile {
	id?: string;
	sub?: string;
	displayName?: string;
	name?: string;
	given_name?: string;
	family_name?: string;
	emails?: Array<{ value: string; type?: string }>;
	email?: string;
	oauthProfile?: unknown;
	oauthTokens?: {
		accessToken: string;
		refreshToken?: string;
	};
	[key: string]: unknown;
}

/**
 * User object for authentication and authorization.
 * Contains core user identity, role/permission information, and OAuth profiles.
 */
export interface User {
	id: string;
	email: string;
	role?: string | undefined;
	firstName?: string | undefined;
	lastName?: string | undefined;
	isActive?: boolean | undefined;
	passwordHash?: string | undefined;
	displayName?: string | undefined;
	createdAt?: Date | undefined;
	updatedAt?: Date | undefined;
	oauthProfile?: unknown;
	oauthTokens?: {
		accessToken: string;
		refreshToken?: string;
	} | undefined;
}

/**
 * Login request data transfer object.
 * Used to submit email and password for user authentication.
 */
export interface LoginDto {
	email: string;
	password: string;
}

/**
 * User registration request data transfer object.
 * Used to create new user accounts with email, password, and optional profile information.
 */
export interface RegisterDto {
	email: string;
	password: string;
	firstName?: string;
	lastName?: string;
	profile?: any;
}

/**
 * JWT (JSON Web Token) payload structure.
 * Contains claims for user identity, authorization, and token metadata.
 * Standard claims follow RFC 7519 conventions.
 */
export interface JWTPayload {
	sub: string;
	email: string;
	role: string;
	type?: 'access' | 'refresh'; // Token type for distinguishing access vs refresh tokens
	iss?: string; // Issuer
	aud?: string; // Audience
	exp?: number; // Expiration timestamp
	iat?: number; // Issued at timestamp
}

/**
 * Response returned after successful authentication.
 * Contains access/refresh tokens, expiration info, and authenticated user details.
 */
export interface AuthResponse {
	accessToken: string;
	refreshToken?: string;
	expiresIn: number;
	tokenType: string;
	user: User;
}

/**
 * Refresh token request data transfer object.
 * Used to submit a refresh token for generating new access tokens.
 */
export interface RefreshTokenDto {
	refreshToken: string;
}

/**
 * Response returned after successfully refreshing an access token.
 * Contains the new access token, expiration time, and token type.
 */
export interface RefreshTokenResponse {
	accessToken: string;
	expiresIn: number;
	tokenType: string;
}
