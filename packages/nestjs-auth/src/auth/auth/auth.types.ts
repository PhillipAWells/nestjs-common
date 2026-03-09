/**
 * User interface for authentication
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
	oauthProfile?: any;
	oauthTokens?: {
		accessToken: string;
		refreshToken?: string;
	} | undefined;
}

/**
 * Login request DTO
 */
export interface LoginDto {
	email: string;
	password: string;
}

/**
 * Register request DTO
 */
export interface RegisterDto {
	email: string;
	password: string;
	firstName?: string;
	lastName?: string;
	profile?: any;
}

/**
 * JWT payload interface
 */
export interface JWTPayload {
	sub: string;
	email: string;
	role: string;
	exp?: number; // Expiration timestamp
	iat?: number; // Issued at timestamp
}

/**
 * Authentication response
 */
export interface AuthResponse {
	accessToken: string;
	refreshToken?: string;
	expiresIn: number;
	tokenType: string;
	user: User;
}

/**
 * Refresh token request DTO
 */
export interface RefreshTokenDto {
	refreshToken: string;
}

/**
 * Refresh token response
 */
export interface RefreshTokenResponse {
	accessToken: string;
	expiresIn: number;
	tokenType: string;
}
