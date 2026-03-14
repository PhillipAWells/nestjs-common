import Joi from 'joi';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request as ExpressRequest } from 'express';
import { ModuleRef } from '@nestjs/core';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { User } from './auth.types.js';
import type { JWTPayload } from './auth.types.js';
import { TokenValidationService } from './token-validation.service.js';
import { TokenBlacklistService } from './token-blacklist.service.js';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';
import { AUTH_JWT_KEY_SIZE } from '../constants/auth-timeouts.constants.js';
import { USER_LOOKUP_FN } from './tokens.js';

/**
 * JWT (JSON Web Token) authentication strategy for Passport.
 * Validates JWT token signatures, expiration, and blacklist status.
 * Extracts user information from validated JWT payloads.
 *
 * @class JWTStrategy
 * @extends {PassportStrategy(Strategy)}
 * @implements {LazyModuleRefService}
 *
 * @example
 * ```typescript
 * @UseGuards(AuthGuard('jwt'))
 * @Get('protected')
 * getProtected(@Request() req) {
 *   // req.user is populated by JWT validation
 *   return { user: req.user };
 * }
 * ```
 */
@Injectable()
export class JWTStrategy extends PassportStrategy(Strategy) implements LazyModuleRefService {
	private _contextualLogger: AppLogger | undefined;

	public get UserLookupFn(): (userId: string) => Promise<User | null> {
		return this.Module.get(USER_LOOKUP_FN, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	public get TokenValidationService(): TokenValidationService {
		return this.Module.get(TokenValidationService);
	}

	public get TokenBlacklistService(): TokenBlacklistService {
		return this.Module.get(TokenBlacklistService);
	}

	private get logger(): AppLogger {
		this._contextualLogger ??= this.AppLogger.createContextualLogger(JWTStrategy.name);
		return this._contextualLogger;
	}

	constructor(public readonly Module: ModuleRef) {
		// Validate JWT configuration
		const jwtConfigSchema = Joi.object({
			JWT_SECRET: Joi.string().min(AUTH_JWT_KEY_SIZE).pattern(/^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};'":\\|,.<>?`~]+$/).required()
				.description('JWT signing secret (min 32 chars, alphanumeric + special chars)'),
			JWT_EXPIRES_IN: Joi.string().pattern(/^\d+[smhd]$/).default('15m')
				.description('JWT expiration time (e.g., 15m, 1h, 7d)'),
		});

		const envVars = {
			JWT_SECRET: process.env['JWT_SECRET'],
			JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'],
		};

		const { error, value } = jwtConfigSchema.validate(envVars);
		if (error) {
			throw new Error(`JWT configuration validation failed: ${error.details.map(d => d.message).join(', ')}`);
		}

		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: value.JWT_SECRET,
		});
	}

	/**
	 * Validate JWT payload and return user
	 * @param payload JWT payload
	 * @param request Express request object
	 * @returns User object
	 */
	@ProfileMethod({ tags: { operation: 'jwtValidate', strategy: 'jwt' } })
	public async validate(payload: JWTPayload, request: ExpressRequest): Promise<User> {
		this.logger.debug(`JWT validation initiated for user ${payload.sub}`);

		// Extract token from request for comprehensive validation
		const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);

		if (!token) {
			this.logger.warn('Token validation failed: no token provided');
			throw new UnauthorizedException('No token provided');
		}

		// Comprehensive token validation
		try {
			this.TokenValidationService.validateToken(token, 'access');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Token validation failed: ${errorMessage}`);
			throw error;
		}

		const user = await this.UserLookupFn(payload.sub);

		if (!user?.isActive) {
			this.logger.warn(`JWT validation failed: user ${payload.sub} not found or inactive`);
			throw new UnauthorizedException('User not found or inactive');
		}

		// Check if user has revoked all tokens
		const userTokensRevoked = await this.TokenBlacklistService.hasUserRevokedTokens(payload.sub);
		if (userTokensRevoked) {
			this.logger.warn(`JWT validation failed: all tokens revoked for user ${payload.sub}`);
			throw new UnauthorizedException('User tokens have been revoked');
		}

		this.logger.info(`JWT validation successful for user ${user.email}`);
		return user;
	}
}
