import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { TOKEN_TTL_24_HOURS, MS_PER_SECOND } from '../constants/auth-timeouts.constants.js';
import type { JWTPayload } from './auth.types.js';

/**
 * Token validation service
 * Validates JWT tokens including signature, claims, expiration, type, and issuer/audience.
 * Enforces strict validation requirements to prevent token reuse and tampering.
 *
 * @class TokenValidationService
 * @implements {LazyModuleRefService}
 */
@Injectable()
export class TokenValidationService implements LazyModuleRefService {
	constructor(public readonly Module: ModuleRef) {}

	public get JwtService(): JwtService {
		return this.Module.get(JwtService);
	}

	/**
	 * Validate JWT token comprehensively
	 * @param token JWT token string to validate
	 * @param type Token type: 'access' or 'refresh' (default: 'access')
	 * @returns Validated JWT payload
	 * @throws UnauthorizedException if token is invalid, expired, or fails any validation check
	 */
	public validateToken(token: string, type: 'access' | 'refresh' = 'access'): JWTPayload {
		try {
			// Verify signature first — throws if signature is invalid or token is expired
			const verified = this.JwtService.verify(token) as JWTPayload | null;

			if (!verified) {
				throw new UnauthorizedException('Invalid token format');
			}

			// Validate required claims
			this.validateRequiredClaims(verified);

			// Validate claim values
			this.validateClaimValues(verified);

			// Validate token type
			this.validateTokenType(verified, type);

			// Validate token age
			this.validateTokenAge(verified);

			// Validate issuer
			this.validateIssuer(verified);

			// Validate audience
			this.validateAudience(verified);

			return verified;
		} catch (error) {
			if (error instanceof UnauthorizedException) {
				throw error;
			}
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new UnauthorizedException(`Token validation failed: ${errorMessage}`);
		}
	}

	/**
	 * Validate that all required JWT claims are present
	 * @param payload JWT payload to validate
	 * @throws UnauthorizedException if required claims are missing
	 */
	private validateRequiredClaims(payload: JWTPayload): void {
		const requiredClaims: (keyof JWTPayload)[] = ['sub', 'email', 'iat', 'exp'];

		for (const claim of requiredClaims) {
			if (!payload[claim]) {
				throw new UnauthorizedException(`Missing required claim: ${claim}`);
			}
		}
	}

	/**
	 * Validate that claim values are valid and properly formatted
	 * @param payload JWT payload to validate
	 * @throws UnauthorizedException if claim values are invalid
	 */
	private validateClaimValues(payload: JWTPayload): void {
		// Validate subject (user ID)
		if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
			throw new UnauthorizedException('Invalid subject claim');
		}

		// Validate email
		if (typeof payload.email !== 'string' || !this.isValidEmail(payload.email)) {
			throw new UnauthorizedException('Invalid email claim');
		}

		// Validate issued at
		if (typeof payload.iat !== 'number' || payload.iat <= 0) {
			throw new UnauthorizedException('Invalid issued-at claim');
		}

		// Validate expiration
		if (typeof payload.exp !== 'number' || payload.exp <= 0) {
			throw new UnauthorizedException('Invalid expiration claim');
		}
	}

	/**
	 * Validate that token type matches the expected type (access or refresh)
	 * @param payload JWT payload to validate
	 * @param expectedType Expected token type
	 * @throws UnauthorizedException if token type does not match
	 */
	private validateTokenType(payload: JWTPayload, expectedType: 'access' | 'refresh'): void {
		const tokenType = payload.type ?? 'access';

		if (tokenType !== expectedType) {
			throw new UnauthorizedException(
				`Invalid token type. Expected ${expectedType}, got ${tokenType}`,
			);
		}
	}

	/**
	 * Validate that token is not too old (within acceptable age range)
	 * @param payload JWT payload to validate
	 * @throws UnauthorizedException if token is too old
	 */
	private validateTokenAge(payload: JWTPayload): void {
		const tokenAge = Math.floor(Date.now() / MS_PER_SECOND) - (payload.iat ?? 0);
		const maxAge = TOKEN_TTL_24_HOURS;

		if (tokenAge > maxAge) {
			throw new UnauthorizedException('Token too old');
		}
	}

	/**
	 * Validate that token issuer matches expected issuer
	 * @param payload JWT payload to validate
	 * @throws UnauthorizedException if issuer does not match
	 */
	private validateIssuer(payload: JWTPayload): void {
		const expectedIssuer = process.env['JWT_ISSUER'] ?? 'nestjs-app';

		if (payload.iss !== expectedIssuer) {
			throw new UnauthorizedException(
				`Invalid issuer. Expected ${expectedIssuer}, got ${payload.iss}`,
			);
		}
	}

	/**
	 * Validate that token audience matches expected audience
	 * @param payload JWT payload to validate
	 * @throws UnauthorizedException if audience does not match
	 */
	private validateAudience(payload: JWTPayload): void {
		const expectedAudience = process.env['JWT_AUDIENCE'] ?? 'nestjs-api';

		if (payload.aud !== expectedAudience) {
			throw new UnauthorizedException(
				`Invalid audience. Expected ${expectedAudience}, got ${payload.aud}`,
			);
		}
	}

	/**
	 * Validate email format using RFC-compliant regex
	 * @param email Email address to validate
	 * @returns True if email format is valid, false otherwise
	 */
	private isValidEmail(email: string): boolean {
		const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
		return emailRegex.test(email);
	}
}
