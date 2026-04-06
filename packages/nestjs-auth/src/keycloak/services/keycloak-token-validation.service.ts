import { Injectable, Inject, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppLogger, getErrorMessage, escapeNewlines } from '@pawells/nestjs-shared/common';
import { KEYCLOAK_MODULE_OPTIONS } from '../keycloak.constants.js';
import type { IKeycloakModuleOptions, IKeycloakTokenClaims, IKeycloakUser } from '../keycloak.types.js';
import { JwksCacheService } from './jwks-cache.service.js';

/**
 * Result returned by `KeycloakTokenValidationService.ValidateToken`.
 *
 * On success, `valid` is `true` and `claims` contains the decoded token payload.
 * On failure, `valid` is `false` and `error` contains a short error code string
 * (e.g. `'token_expired'`, `'invalid_audience'`, `'token_inactive'`).
 */
export interface ITokenValidationResult {
	/** Whether the token passed all validation checks */
	valid: boolean;
	/** Decoded token claims — present only when `valid` is `true` */
	claims?: IKeycloakTokenClaims;
	/** Short error code describing why validation failed — present only when `valid` is `false` */
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
	private Logger?: AppLogger;

	private readonly Options: IKeycloakModuleOptions;

	private readonly JwtService: JwtService;

	private readonly JwksCacheService?: JwksCacheService;

	constructor(
		@Inject(KEYCLOAK_MODULE_OPTIONS) options: IKeycloakModuleOptions,
		jwtService: JwtService,
		@Optional() jwksCacheService?: JwksCacheService,
	) {
		this.Options = options;
		this.JwtService = jwtService;
		this.JwksCacheService = jwksCacheService;
		this.InitializeLogger();
	}

	private InitializeLogger(): void {
		try {
			this.Logger = new AppLogger(undefined, KeycloakTokenValidationService.name);
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
	 * @returns `{ valid: true, claims: IKeycloakTokenClaims }` on success
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
	public async ValidateToken(token: string): Promise<ITokenValidationResult> {
		try {
			const IsOfflineMode = this.Options.validationMode === 'offline';

			if (IsOfflineMode) {
				return await this.ValidateTokenOffline(token);
			}
			return await this.ValidateTokenOnline(token);
		} catch (error) {
			const ErrorMessage = getErrorMessage(error);
			this.Log('warn', `Token validation failed unexpectedly: ${ErrorMessage}`);
			return { valid: false, error: 'validation_error' };
		}
	}

	private async ValidateTokenOnline(token: string): Promise<ITokenValidationResult> {
		try {
			const IntrospectionUrl = `${this.Options.authServerUrl}/realms/${this.Options.realm}/protocol/openid-connect/token/introspect`;

			const Body = new URLSearchParams({
				token,
				token_type_hint: 'access_token',
				client_id: this.Options.clientId,
				client_secret: this.Options.clientSecret ?? '',
			});

			const Response = await fetch(IntrospectionUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: Body.toString(),
			});

			if (!Response.ok) {
				this.Log('warn', `Introspection request failed with status ${Response.status}`);
				return { valid: false, error: 'introspection_failed' };
			}

			const IntrospectionResult = await Response.json();

			if (IntrospectionResult.active !== true) {
				return { valid: false, error: 'token_inactive' };
			}

			// Validate audience claim — must match our clientId
			const Audiences = Array.isArray(IntrospectionResult.aud)
				? IntrospectionResult.aud
				: [IntrospectionResult.aud].filter(Boolean);
			if (!Audiences.includes(this.Options.clientId)) {
				return { valid: false, error: 'invalid_audience' };
			}

			return { valid: true, claims: IntrospectionResult as IKeycloakTokenClaims };
		} catch (error) {
			const ErrorMessage = getErrorMessage(error);
			this.Log('warn', `Introspection error: ${ErrorMessage}`);
			return { valid: false, error: 'introspection_failed' };
		}
	}

	private async ValidateTokenOffline(token: string): Promise<ITokenValidationResult> {
		try {
			if (!this.JwksCacheService) {
				return { valid: false, error: 'offline_mode_not_available' };
			}

			// Decode header to get kid
			const Decoded = this.JwtService.decode(token, { complete: true }) as {
				header: { kid?: string };
				payload: unknown;
			} | null;

			if (!Decoded?.header?.kid) {
				return { valid: false, error: 'missing_kid' };
			}

			// Get public key from cache
			let PublicKey: string;
			try {
				PublicKey = await this.JwksCacheService.GetKey(Decoded.header.kid);
			} catch (error) {
				const ErrorMessage = getErrorMessage(error);
				this.Log('warn', `Failed to get signing key: ${ErrorMessage}`);
				return { valid: false, error: 'unknown_signing_key' };
			}

			// Verify JWT
			let Claims: IKeycloakTokenClaims;
			try {
				Claims = this.JwtService.verify(token, {
					publicKey: PublicKey,
					algorithms: ['RS256'],
				}) as IKeycloakTokenClaims;
			} catch (error) {
				const ErrorMessage = getErrorMessage(error);
				this.Log('warn', `JWT verification failed: ${ErrorMessage}`);
				return { valid: false, error: 'jwt_verification_failed' };
			}

			// Validate claims
			const Now = Math.floor(Date.now() / MS_PER_SECOND);
			if (Claims.exp <= Now) {
				return { valid: false, error: 'token_expired' };
			}

			const ExpectedIssuer = this.Options.issuer ?? this.Options.authServerUrl;
			if (Claims.iss !== ExpectedIssuer) {
				this.Log('warn', `Issuer mismatch: expected ${escapeNewlines(ExpectedIssuer)}, got ${escapeNewlines(Claims.iss)}`);
				return { valid: false, error: 'invalid_issuer' };
			}

			const Audience = Array.isArray(Claims.aud) ? Claims.aud : [Claims.aud];
			if (!Audience.includes(this.Options.clientId)) {
				this.Log('warn', `Audience mismatch: clientId ${this.Options.clientId} not in ${escapeNewlines(Audience.join(','))}`);
				return { valid: false, error: 'invalid_audience' };
			}

			return { valid: true, claims: Claims };
		} catch (error) {
			const ErrorMessage = getErrorMessage(error);
			this.Log('warn', `Offline validation error: ${ErrorMessage}`);
			return { valid: false, error: 'validation_failed' };
		}
	}

	/**
	 * Extract user identity and roles from validated token claims
	 *
	 * Maps Keycloak token claims to a simplified `IKeycloakUser` object.
	 * Extracts both realm-level roles (`realm_access.roles`) and client-specific roles
	 * (`resource_access[clientId].roles`).
	 *
	 * @param claims - The validated Keycloak token claims
	 * @returns IUser object with ID, email, username, name, and both realm and client roles
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
	public ExtractUser(claims: IKeycloakTokenClaims): IKeycloakUser {
		return {
			id: claims.sub,
			email: claims.email,
			username: claims.preferred_username,
			name: claims.name,
			realmRoles: claims.realm_access?.roles ?? [],
			clientRoles: claims.resource_access?.[this.Options.clientId]?.roles ?? [],
		};
	}

	private Log(level: 'warn' | 'info', message: string): void {
		if (this.Logger) {
			if (level === 'warn') {
				this.Logger.warn(message);
			} else {
				this.Logger.info(message);
			}
		}
	}
}
