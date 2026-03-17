import { Injectable, Inject, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { KEYCLOAK_MODULE_OPTIONS } from '../keycloak.constants.js';
import type { KeycloakModuleOptions, KeycloakTokenClaims, KeycloakUser } from '../keycloak.types.js';
import { JwksCacheService } from './jwks-cache.service.js';

export interface TokenValidationResult {
	valid: boolean;
	claims?: KeycloakTokenClaims;
	error?: string;
}

const MS_PER_SECOND = 1000;

/**
 * Keycloak Token Validation Service
 *
 * Validates JWT tokens issued by Keycloak in two modes:
 * - **Online mode (default)**: Calls Keycloak's token introspection endpoint to validate the token
 *   (requires real-time network access to Keycloak)
 * - **Offline mode**: Validates JWTs locally using JWKS (no network call; suitable for high-traffic scenarios)
 *
 * After successful validation, extracts user identity and roles from token claims.
 *
 * @example
 * ```typescript
 * // Online mode validation
 * const result = await this.validationService.validateToken(token);
 * if (result.valid) {
 *   const user = this.validationService.extractUser(result.claims!);
 * }
 *
 * // Offline mode uses JWKS-based verification (faster, no network call)
 * ```
 */
@Injectable()
export class KeycloakTokenValidationService {
	private logger?: AppLogger;

	constructor(
		@Inject(KEYCLOAK_MODULE_OPTIONS) private readonly options: KeycloakModuleOptions,
		private readonly jwtService: JwtService,
		@Optional() private readonly jwksCacheService?: JwksCacheService,
	) {
		this.initializeLogger();
	}

	private initializeLogger(): void {
		try {
			this.logger = new AppLogger(undefined, KeycloakTokenValidationService.name);
		} catch {
			// Logger unavailable, fall back to console
		}
	}

	/**
	 * Validate a JWT token issued by Keycloak
	 *
	 * Routes to the appropriate validation mode based on configuration:
	 * - **Online**: Calls the Keycloak introspection endpoint (requires network access)
	 * - **Offline**: Verifies JWT signature using cached JWKS (no network call)
	 *
	 * Both modes verify token expiration and audience/issuer claims.
	 *
	 * @param token - The JWT to validate (Bearer token without "Bearer " prefix)
	 * @returns Result object with validation status and optional claims on success, or error code on failure
	 * @returns `{ valid: true, claims: KeycloakTokenClaims }` on success
	 * @returns `{ valid: false, error: string }` on failure (includes error codes like 'token_expired', 'invalid_issuer', etc.)
	 *
	 * @example
	 * ```typescript
	 * const result = await this.validateToken(jwtToken);
	 * if (result.valid && result.claims) {
	 *   const user = this.extractUser(result.claims);
	 * }
	 * ```
	 */
	public async validateToken(token: string): Promise<TokenValidationResult> {
		try {
			const isOfflineMode = this.options.validationMode === 'offline';

			if (isOfflineMode) {
				return await this.validateTokenOffline(token);
			}
			return await this.validateTokenOnline(token);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'unexpected error type';
			this.log('warn', `Token validation failed unexpectedly: ${errorMessage}`);
			return { valid: false, error: 'validation_error' };
		}
	}

	private async validateTokenOnline(token: string): Promise<TokenValidationResult> {
		try {
			const introspectionUrl = `${this.options.authServerUrl}/protocol/openid-connect/token/introspect`;

			const body = new URLSearchParams({
				token,
				token_type_hint: 'access_token',
				client_id: this.options.clientId,
				client_secret: this.options.clientSecret ?? '',
			});

			const response = await fetch(introspectionUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: body.toString(),
			});

			if (!response.ok) {
				this.log('warn', `Introspection request failed with status ${response.status}`);
				return { valid: false, error: 'introspection_failed' };
			}

			const introspectionResult = await response.json();

			if (introspectionResult.active !== true) {
				return { valid: false, error: 'token_inactive' };
			}

			// Validate audience claim — must match our clientId
			const audiences = Array.isArray(introspectionResult.aud)
				? introspectionResult.aud
				: [introspectionResult.aud].filter(Boolean);
			if (!audiences.includes(this.options.clientId)) {
				return { valid: false, error: 'invalid_audience' };
			}

			return { valid: true, claims: introspectionResult as KeycloakTokenClaims };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'unexpected error type';
			this.log('warn', `Introspection error: ${errorMessage}`);
			return { valid: false, error: 'introspection_failed' };
		}
	}

	private async validateTokenOffline(token: string): Promise<TokenValidationResult> {
		try {
			if (!this.jwksCacheService) {
				return { valid: false, error: 'offline_mode_not_available' };
			}

			// Decode header to get kid
			const decoded = this.jwtService.decode(token, { complete: true }) as {
				header: { kid?: string };
				payload: unknown;
			} | null;

			if (!decoded?.header?.kid) {
				return { valid: false, error: 'missing_kid' };
			}

			// Get public key from cache
			let publicKey: string;
			try {
				publicKey = await this.jwksCacheService.getKey(decoded.header.kid);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'unexpected error type';
				this.log('warn', `Failed to get signing key: ${errorMessage}`);
				return { valid: false, error: 'unknown_signing_key' };
			}

			// Verify JWT
			let claims: KeycloakTokenClaims;
			try {
				claims = this.jwtService.verify(token, {
					publicKey,
					algorithms: ['RS256'],
				}) as KeycloakTokenClaims;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'unexpected error type';
				this.log('warn', `JWT verification failed: ${errorMessage}`);
				return { valid: false, error: 'jwt_verification_failed' };
			}

			// Validate claims
			const now = Math.floor(Date.now() / MS_PER_SECOND);
			if (claims.exp <= now) {
				return { valid: false, error: 'token_expired' };
			}

			const expectedIssuer = this.options.issuer ?? this.options.authServerUrl;
			if (claims.iss !== expectedIssuer) {
				this.log('warn', `Issuer mismatch: expected ${expectedIssuer}, got ${claims.iss}`);
				return { valid: false, error: 'invalid_issuer' };
			}

			const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
			if (!audience.includes(this.options.clientId)) {
				this.log('warn', `Audience mismatch: clientId ${this.options.clientId} not in ${audience.join(',')}`);
				return { valid: false, error: 'invalid_audience' };
			}

			return { valid: true, claims };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'unexpected error type';
			this.log('warn', `Offline validation error: ${errorMessage}`);
			return { valid: false, error: 'validation_failed' };
		}
	}

	/**
	 * Extract user identity and roles from validated token claims
	 *
	 * Maps Keycloak token claims to a simplified `KeycloakUser` object.
	 * Extracts both realm-level roles (`realm_access.roles`) and client-specific roles
	 * (`resource_access[clientId].roles`).
	 *
	 * @param claims - The validated Keycloak token claims
	 * @returns User object with ID, email, username, name, and both realm and client roles
	 *
	 * @example
	 * ```typescript
	 * const user = this.extractUser(claims);
	 * // {
	 * //   id: 'user-uuid',
	 * //   email: 'user@example.com',
	 * //   username: 'john_doe',
	 * //   name: 'John Doe',
	 * //   realmRoles: ['admin', 'user'],
	 * //   clientRoles: ['read', 'write']
	 * // }
	 * ```
	 */
	public extractUser(claims: KeycloakTokenClaims): KeycloakUser {
		return {
			id: claims.sub,
			email: claims.email,
			username: claims.preferred_username,
			name: claims.name,
			realmRoles: claims.realm_access?.roles ?? [],
			clientRoles: claims.resource_access?.[this.options.clientId]?.roles ?? [],
		};
	}

	private log(level: 'warn' | 'info', message: string): void {
		if (this.logger) {
			if (level === 'warn') {
				this.logger.warn(message);
			} else {
				this.logger.info(message);
			}
		} else {
			// Fallback to console
			if (level === 'warn') {
				console.warn(`[KeycloakTokenValidationService] ${message}`);
			} else {
				console.log(`[KeycloakTokenValidationService] ${message}`);
			}
		}
	}
}
