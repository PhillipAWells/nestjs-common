import Joi from 'joi';
import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request as ExpressRequest } from 'express';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { User } from './auth.types.js';
import type { JWTPayload } from './auth.types.js';
import { TokenValidationService } from './token-validation.service.js';
import { TokenBlacklistService } from './token-blacklist.service.js';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';
import { AUTH_JWT_KEY_SIZE } from '../constants/auth-timeouts.constants.js';

/**
 * JWT authentication strategy
 * Validates JWT tokens and extracts user information
 */
@Injectable()
export class JWTStrategy extends PassportStrategy(Strategy) {
	private readonly logger: AppLogger;

	constructor(
		private readonly userLookupFn: (userId: string) => Promise<User | null>,
		@Inject(AppLogger) private readonly appLogger: AppLogger,
		private readonly tokenValidationService: TokenValidationService,
		private readonly tokenBlacklistService: TokenBlacklistService,
	) {
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

		this.logger = this.appLogger.createContextualLogger(JWTStrategy.name);
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
			this.tokenValidationService.validateToken(token, 'access');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Token validation failed: ${errorMessage}`);
			throw error;
		}

		const user = await this.userLookupFn(payload.sub);

		if (!user?.isActive) {
			this.logger.warn(`JWT validation failed: user ${payload.sub} not found or inactive`);
			throw new UnauthorizedException('User not found or inactive');
		}

		// Check if user has revoked all tokens
		const userTokensRevoked = await this.tokenBlacklistService.hasUserRevokedTokens(payload.sub);
		if (userTokensRevoked) {
			this.logger.warn(`JWT validation failed: all tokens revoked for user ${payload.sub}`);
			throw new UnauthorizedException('User tokens have been revoked');
		}

		this.logger.info(`JWT validation successful for user ${user.email}`);
		return user;
	}
}
