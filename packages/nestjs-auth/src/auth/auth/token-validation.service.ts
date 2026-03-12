import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { TOKEN_TTL_24_HOURS, MS_PER_SECOND } from '../constants/auth-timeouts.constants.js';
import type { JWTPayload } from './auth.types.js';

@Injectable()
export class TokenValidationService implements LazyModuleRefService {
	constructor(public readonly moduleRef: ModuleRef) {}

	public get JwtService(): JwtService {
		return this.moduleRef.get(JwtService);
	}

	/**
   * Comprehensive token validation
   */
	public validateToken(token: string, type: 'access' | 'refresh' = 'access'): JWTPayload {
		try {
			// Decode token
			const decoded = this.JwtService.decode(token) as JWTPayload | null;

			if (!decoded) {
				throw new UnauthorizedException('Invalid token format');
			}

			// Validate required claims
			this.validateRequiredClaims(decoded);

			// Validate claim values
			this.validateClaimValues(decoded);

			// Validate token type
			this.validateTokenType(decoded, type);

			// Validate token age
			this.validateTokenAge(decoded);

			// Validate issuer
			this.validateIssuer(decoded);

			// Validate audience
			this.validateAudience(decoded);

			// Verify signature (done by JWT strategy, but can be done here too)
			this.JwtService.verify(token);

			return decoded;
		} catch (error) {
			if (error instanceof UnauthorizedException) {
				throw error;
			}
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new UnauthorizedException(`Token validation failed: ${errorMessage}`);
		}
	}

	/**
   * Validate required claims
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
   * Validate claim values
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
   * Validate token type
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
   * Validate token age
   */
	private validateTokenAge(payload: JWTPayload): void {
		const tokenAge = Math.floor(Date.now() / MS_PER_SECOND) - (payload.iat ?? 0);
		const maxAge = TOKEN_TTL_24_HOURS;

		if (tokenAge > maxAge) {
			throw new UnauthorizedException('Token too old');
		}
	}

	/**
   * Validate issuer
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
   * Validate audience
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
   * Validate email format
   */
	private isValidEmail(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}
}
