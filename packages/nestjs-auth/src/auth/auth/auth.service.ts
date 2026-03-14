import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { LazyModuleRefService } from '@pawells/nestjs-shared/common/utils/lazy-getter.types';
import { AppLogger, AuditLoggerService, CACHE_PROVIDER, type ICacheProvider } from '@pawells/nestjs-shared/common';
import { Traced } from '@pawells/nestjs-open-telemetry';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';
import type { IUserRepository } from './interfaces/user-repository.interface.js';
import { USER_REPOSITORY } from './tokens.js';
import { TokenBlacklistService } from './token-blacklist.service.js';
import { DEFAULT_JWT_ISSUER, DEFAULT_JWT_AUDIENCE, MS_PER_SECOND, TOKEN_TTL_15_MINUTES, TOKEN_TTL_3_DAYS, TOKEN_TTL_MIN_POSITIVE, DEFAULT_MAX_CONCURRENT_SESSIONS, SESSION_TRACKING_TTL } from '../constants/auth-timeouts.constants.js';

import type { User, AuthResponse, JWTPayload } from './auth.types.js';

/**
 * Authentication service
 * Handles user authentication, password hashing, and JWT token management
 */
@Injectable()
export class AuthService implements LazyModuleRefService {
	private _contextualLogger: AppLogger | undefined;

	constructor(public readonly Module: ModuleRef) {}

	public get UserRepository(): IUserRepository {
		return this.Module.get(USER_REPOSITORY, { strict: false });
	}

	public get JwtService(): JwtService {
		return this.Module.get(JwtService);
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	public get AuditLogger(): AuditLoggerService {
		return this.Module.get(AuditLoggerService);
	}

	public get TokenBlacklistServiceInstance(): TokenBlacklistService {
		return this.Module.get(TokenBlacklistService);
	}

	public get CacheProvider(): ICacheProvider | null {
		// Optional cache provider - applications may not have cache configured
		// This allows auth to work without cache, but token blacklisting will be disabled
		try {
			return this.Module.get<ICacheProvider>(CACHE_PROVIDER);
		} catch {
			return null;
		}
	}

	private get logger(): AppLogger {
		this._contextualLogger ??= this.AppLogger.createContextualLogger(AuthService.name);
		return this._contextualLogger;
	}

	/**
	 * Validate user credentials
	 * @param user User object to validate against
	 * @param password Plain text password
	 * @returns User object if valid, null otherwise
	 */
	@Traced({ name: 'auth.validateUser' })
	@ProfileMethod({ tags: { operation: 'validateUser' } })
	public async validateUser(user: User | null, password: string): Promise<User | null> {
		this.logger.debug(`Validating credentials for user: ${user?.email ?? 'unknown'}`);

		if (!user?.isActive) {
			this.AuditLogger.logAuthenticationAttempt(user?.email ?? 'unknown', false, undefined, 'User inactive or not found');
			this.logger.warn(`User validation failed: user inactive or not found for ${user?.email ?? 'unknown'}`);
			return null;
		}

		// This assumes the user object has a passwordHash field
		// In a real implementation, you'd fetch the user with password hash
		const userWithHash = user as User & { passwordHash: string };
		if (!userWithHash.passwordHash) {
			this.AuditLogger.logAuthenticationAttempt(user.email, false, undefined, 'No password hash');
			this.logger.warn(`User validation failed: no password hash for user ${user.email}`);
			return null;
		}

		const isPasswordValid = await bcrypt.compare(password, userWithHash.passwordHash);
		if (!isPasswordValid) {
			this.AuditLogger.logAuthenticationAttempt(user.email, false, undefined, 'Invalid password');
			this.logger.warn(`Password validation failed for user ${user.email}`);
			return null;
		}

		this.logger.debug(`User validation successful for ${user.email}`);
		// Return user without password hash for security
		return {
			id: user.id,
			email: user.email,
			role: user.role ?? 'user',
			firstName: user.firstName,
			lastName: user.lastName,
			isActive: user.isActive,
		};
	}

	/**
	 * Authenticate user and generate JWT tokens
	 * @param user User object
	 * @returns Authentication response with tokens
	 */
	@Traced({ name: 'auth.login' })
	@ProfileMethod({ tags: { operation: 'login' } })
	public login(user: User): AuthResponse {
		this.logger.info(`User login initiated for ${user.email}`);

		const basePayload: JWTPayload = {
			email: user.email,
			sub: user.id,
			role: user.role ?? 'user',
		};

		const accessTokenExpiry = '15m';
		const refreshTokenExpiry = '3d';

		const accessToken = this.JwtService.sign(
			{
				...basePayload,
				type: 'access',
				iss: DEFAULT_JWT_ISSUER,
				aud: DEFAULT_JWT_AUDIENCE,
			},
			{
				expiresIn: accessTokenExpiry,
				algorithm: 'HS256',
			},
		);

		const refreshToken = this.JwtService.sign(
			{
				...basePayload,
				type: 'refresh',
				iss: DEFAULT_JWT_ISSUER,
				aud: DEFAULT_JWT_AUDIENCE,
			},
			{
				expiresIn: refreshTokenExpiry,
				algorithm: 'HS256',
			},
		);

		// Validate tokens have correct expiration
		this.validateTokenExpiration(accessToken, accessTokenExpiry);
		this.validateTokenExpiration(refreshToken, refreshTokenExpiry);

		this.AuditLogger.logAuthenticationAttempt(user.email, true);
		this.AuditLogger.logTokenGeneration(user.id, 'access');
		this.AuditLogger.logTokenGeneration(user.id, 'refresh');

		this.logger.info(`JWT tokens generated successfully for user ${user.email}`);

		return {
			accessToken,
			refreshToken,
			expiresIn: TOKEN_TTL_15_MINUTES,
			tokenType: 'Bearer',
			user: {
				id: user.id,
				email: user.email,
				role: user.role ?? 'user',
				firstName: user.firstName,
				lastName: user.lastName,
			},
		};
	}

	/**
	 * Validate OAuth user profile and create/update user
	 * @param profile OAuth profile
	 * @param accessToken OAuth access token
	 * @param refreshToken OAuth refresh token
	 * @returns User object
	 */
	@Traced({ name: 'auth.validateOAuthUser' })
	@ProfileMethod({ tags: { operation: 'validateOAuthUser' } })
	public async validateOAuthUser(profile: any, accessToken: string, refreshToken: string): Promise<User> {
		this.logger.debug(`Validating OAuth2 user: ${profile.id ?? profile.sub}`);

		// Extract user info from profile
		const email = profile.emails?.[0]?.value ?? profile.email;
		const displayName = profile.displayName ?? profile.name ?? `${profile.given_name} ${profile.family_name}`.trim();

		if (!email) {
			this.logger.error('OAuth2 profile missing email');
			throw new UnauthorizedException('Email required from OAuth provider');
		}

		// Check if user exists
		let user = await this.findUserByEmail(email);

		if (!user) {
			// Create new user
			user = await this.createOAuthUser({
				email,
				displayName,
				profile,
				accessToken,
				refreshToken,
			});
			this.logger.info(`Created new OAuth2 user: ${email}`);
		} else {
			// Update existing user with OAuth info
			user = await this.updateOAuthUser(user, profile, accessToken, refreshToken);
			this.logger.info(`Updated existing OAuth2 user: ${email}`);
		}

		return user;
	}

	/**
	 * Find user by email
	 * @param email User email
	 * @returns User or null
	 */
	private async findUserByEmail(email: string): Promise<User | null> {
		this.logger.debug(`Looking up user by email: ${email}`);
		const user = await this.UserRepository.findByEmail(email);
		return user;
	}

	/**
	 * Create OAuth2 user
	 * @param userData User data
	 * @returns Created user
	 */
	private async createOAuthUser(userData: { email: string; displayName: string; profile: unknown; accessToken: string; refreshToken: string }): Promise<User> {
		try {
			const user = await this.UserRepository.create({
				email: userData.email,
				displayName: userData.displayName,
				isActive: true,
				role: 'user',
				oauthProfile: userData.profile,
				oauthTokens: {
					accessToken: userData.accessToken,
					refreshToken: userData.refreshToken,
				},
			});

			this.AuditLogger.logAuthenticationAttempt(user.email, true, user.id, 'OAuth user created');
			this.logger.debug(`Created OAuth2 user: ${user.email}`);
			return user;
		} catch (error) {
			this.logger.error(`Failed to create OAuth user: ${(error as Error).message}`);
			throw error;
		}
	}

	/**
	 * Update OAuth2 user
	 * @param user Existing user
	 * @param profile OAuth2 profile
	 * @param accessToken Access token
	 * @param refreshToken Refresh token
	 * @returns Updated user
	 */
	private async updateOAuthUser(user: User, profile: any, accessToken: string, refreshToken: string): Promise<User> {
		try {
			const updated = await this.UserRepository.update(user.id, {
				oauthProfile: profile,
				oauthTokens: {
					accessToken,
					refreshToken,
				},
				updatedAt: new Date(),
			});

			this.AuditLogger.logAuthenticationAttempt(updated.email, true, updated.id, 'OAuth user updated');
			this.logger.debug(`Updated OAuth2 user: ${updated.email}`);
			return updated;
		} catch (error) {
			this.logger.error(`Failed to update OAuth user: ${(error as Error).message}`);
			throw error;
		}
	}

	/**
	 * Decode JWT token without verification
	 * @param token JWT token
	 * @returns Decoded payload or null
	 */
	public decodeToken(token: string): JWTPayload | null {
		try {
			return this.JwtService.decode(token) as JWTPayload;
		} catch (error) {
			this.logger.error(`Failed to decode token: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		}
	}

	/**
	 * Validate token expiration
	 * @param token JWT token
	 * @param expectedExpiry Expected expiry string (e.g., '15m', '3d')
	 */
	private validateTokenExpiration(token: string, _expectedExpiry: string): void {
		try {
			const decoded = this.JwtService.decode(token) as JWTPayload;
			if (!decoded?.exp) {
				throw new Error('Token has no expiration');
			}
			// For validation, we just check that the token has an expiration
			// The actual expiry validation is handled by the JWT library
			this.logger.debug(`Token expiration validated: ${new Date(decoded.exp * MS_PER_SECOND).toISOString()}`);
		} catch (error) {
			this.logger.error(`Token expiration validation failed: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	/**
	 * Refresh access token using refresh token
	 * @param refreshToken Refresh token
	 * @param userLookupFn Function to lookup user by ID
	 * @returns New access token response
	 */
	@ProfileMethod({ tags: { operation: 'refreshToken' } })
	public async refreshToken(
		refreshToken: string,
		userLookupFn: (userId: string) => Promise<User | null>,
	): Promise<{ accessToken: string; expiresIn: number; tokenType: string }> {
		this.logger.info('Token refresh initiated');

		try {
			// Verify refresh token
			const payload = this.JwtService.verify(refreshToken) as JWTPayload;
			this.logger.debug(`Refresh token verified for user: ${payload.email}`);

			// Check if refresh token is blacklisted
			const tokenBlacklistService = this.getTokenBlacklistService();
			if (await tokenBlacklistService.isTokenBlacklisted(refreshToken)) {
				this.logger.warn(`Refresh token is blacklisted for user: ${payload.email}`);
				throw new UnauthorizedException('Refresh token has been revoked');
			}

			// Lookup user
			const user = await userLookupFn(payload.sub);
			if (!user?.isActive) {
				this.logger.warn(`User not found or inactive during token refresh: ${payload.email}`);
				throw new UnauthorizedException('Invalid refresh token');
			}

			// Generate new access token
			const newPayload: JWTPayload = {
				email: user.email,
				sub: user.id,
				role: user.role ?? 'user',
			};

			const accessTokenExpiry = '15m';
			const newAccessToken = this.JwtService.sign(
				{
					...newPayload,
					type: 'access',
					iss: DEFAULT_JWT_ISSUER,
					aud: DEFAULT_JWT_AUDIENCE,
				},
				{
					expiresIn: accessTokenExpiry,
					algorithm: 'HS256',
				},
			);

			// Blacklist the old refresh token
			const refreshTokenDecoded = this.JwtService.decode(refreshToken) as JWTPayload;
			const calculatedTtl = refreshTokenDecoded?.exp
				? Math.floor((refreshTokenDecoded.exp * MS_PER_SECOND - Date.now()) / MS_PER_SECOND)
				: TOKEN_TTL_3_DAYS; // Default 3 days for refresh tokens
			// Ensure TTL is positive; if token is already expired, use a short TTL for the blacklist entry
			const expiresInSeconds = Math.max(calculatedTtl, TOKEN_TTL_MIN_POSITIVE);

			await tokenBlacklistService.blacklistToken(refreshToken, expiresInSeconds);

			this.AuditLogger.logTokenGeneration(user.id, 'access');
			this.logger.info(`Token refresh successful for user: ${user.email}`);

			return {
				accessToken: newAccessToken,
				expiresIn: TOKEN_TTL_15_MINUTES,
				tokenType: 'Bearer',
			};
		} catch (error) {
			this.logger.error(`Token refresh failed: ${(error as Error).message}`);
			if (error instanceof UnauthorizedException) {
				throw error;
			}
			throw new UnauthorizedException('Invalid refresh token');
		}
	}

	/**
	 * Get token blacklist service instance
	 * @returns TokenBlacklistService instance
	 */
	private getTokenBlacklistService(): TokenBlacklistService {
		return this.TokenBlacklistServiceInstance;
	}

	/**
	 * Track user session for concurrent session management
	 * @param userId User ID
	 * @param sessionId Session identifier
	 * @param maxConcurrentSessions Maximum allowed concurrent sessions
	 * @returns Success status
	 */
	@ProfileMethod({ tags: { operation: 'trackUserSession' } })
	public async trackUserSession(
		userId: string,
		sessionId: string,
		maxConcurrentSessions: number = DEFAULT_MAX_CONCURRENT_SESSIONS,
	): Promise<{ allowed: boolean; activeSessions: string[] }> {
		// Validate inputs for cache key generation
		if (!userId || typeof userId !== 'string' || userId.length === 0) {
			throw new UnauthorizedException('Invalid user ID');
		}
		if (!sessionId || typeof sessionId !== 'string' || sessionId.length === 0) {
			throw new UnauthorizedException('Invalid session ID');
		}
		if (maxConcurrentSessions < 1) {
			throw new UnauthorizedException('Invalid max concurrent sessions');
		}

		this.logger.debug(`Tracking session for user: ${userId}, session: ${sessionId}`);

		// Use the cache service instance
		const cacheService = this.getCacheService();
		if (!cacheService) {
			this.logger.warn('Cache service is not available, allowing session');
			return {
				allowed: true,
				activeSessions: [sessionId],
			};
		}
		const sessionKey = `sessions:${userId}`;

		// TODO: TOCTOU — use a Redis atomic operation (Lua script) to make session count enforcement fully race-free under high concurrency
		try {
			// Get current sessions
			let sessions: string[] = [];
			try {
				const cached = await cacheService.get(sessionKey);
				sessions = cached ? JSON.parse(String(cached)) : [];
			} catch {
				sessions = [];
			}

			// Check if session already exists
			const existingIndex = sessions.indexOf(sessionId);
			if (existingIndex === -1) {
				// New session
				if (sessions.length >= maxConcurrentSessions) {
					// Remove oldest session
					const removedSession = sessions.shift();
					this.logger.info(`Removed old session for user ${userId}: ${removedSession}`);
				}
				sessions.push(sessionId);
			}

			// Save updated sessions
			await cacheService.set(sessionKey, JSON.stringify(sessions), SESSION_TRACKING_TTL);

			const allowed = sessions.length <= maxConcurrentSessions;
			this.logger.debug(`Session tracking result for user ${userId}: allowed=${allowed}, active=${sessions.length}`);

			return {
				allowed,
				activeSessions: sessions,
			};
		} catch (error) {
			this.logger.error(`Session tracking failed for user ${userId}: ${(error as Error).message}`);
			// Fail closed: cache unavailability must not bypass session limits
			throw error;
		}
	}

	/**
	 * Get cache service instance
	 * @returns Cache service instance
	 */
	private getCacheService(): ICacheProvider | null {
		return this.CacheProvider;
	}
}
