/**
 * Mock Keycloak Token Validation Service for Testing
 *
 * Provides a configurable stub for KeycloakTokenValidationService.
 * Defaults to returning a valid token result. Use setValidateTokenResult()
 * to change behaviour within a test.
 */
import { Injectable } from '@nestjs/common';
import type { KeycloakTokenClaims, KeycloakUser } from '../../keycloak/keycloak.types.js';
import type { TokenValidationResult } from '../../keycloak/services/keycloak-token-validation.service.js';

const SECONDS_PER_MILLISECOND = 1000;
const TOKEN_TTL_SECONDS = 3600;

/**
 * Default minimal token claims used by MockKeycloakTokenValidationService.
 */
const DEFAULT_CLAIMS: KeycloakTokenClaims = {
	sub: 'test-user-id',
	iss: 'https://auth.example.com/realms/test',
	aud: 'test-client',
	exp: Math.floor(Date.now() / SECONDS_PER_MILLISECOND) + TOKEN_TTL_SECONDS,
	iat: Math.floor(Date.now() / SECONDS_PER_MILLISECOND),
	preferred_username: 'test-user',
	email: 'test@example.com',
	name: 'Test User',
	realm_access: { roles: [] },
	resource_access: {},
};

/**
 * Default minimal user used by MockKeycloakTokenValidationService.
 */
const DEFAULT_USER: KeycloakUser = {
	id: 'test-user-id',
	email: 'test@example.com',
	username: 'test-user',
	name: 'Test User',
	realmRoles: [],
	clientRoles: [],
};

/**
 * Configurable stub for KeycloakTokenValidationService.
 *
 * By default returns a valid token result with sensible test defaults.
 * Override behaviour per-test using the setter methods.
 *
 * @example
 * ```typescript
 * const mock = moduleRef.get(MockKeycloakTokenValidationService);
 * mock.setValidateTokenResult({ valid: false, error: 'token_inactive' });
 * ```
 */
@Injectable()
export class MockKeycloakTokenValidationService {
	private validateResult: TokenValidationResult = {
		valid: true,
		claims: DEFAULT_CLAIMS,
	};

	private extractResult: KeycloakUser = DEFAULT_USER;

	// eslint-disable-next-line require-await
	public async validateToken(_token: string): Promise<TokenValidationResult> {
		return this.validateResult;
	}

	public extractUser(_claims: KeycloakTokenClaims): KeycloakUser {
		return this.extractResult;
	}

	/**
	 * Override the result returned by validateToken() for subsequent calls.
	 * @param result - The TokenValidationResult to return
	 */
	public setValidateTokenResult(result: TokenValidationResult): void {
		this.validateResult = result;
	}

	/**
	 * Override the result returned by extractUser() for subsequent calls.
	 * @param user - The KeycloakUser to return
	 */
	public setExtractUserResult(user: KeycloakUser): void {
		this.extractResult = user;
	}

	/**
	 * Reset validateToken and extractUser results to their defaults.
	 */
	public reset(): void {
		this.validateResult = { valid: true, claims: DEFAULT_CLAIMS };
		this.extractResult = DEFAULT_USER;
	}
}
