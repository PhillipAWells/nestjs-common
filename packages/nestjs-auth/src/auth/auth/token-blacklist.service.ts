import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { LazyModuleRefService } from '@pawells/nestjs-shared/common/utils/lazy-getter.types';
import { AppLogger, CACHE_PROVIDER, type ICacheProvider } from '@pawells/nestjs-shared/common';
import { TOKEN_TTL_24_HOURS, TOKEN_LOG_PREFIX_LENGTH } from '../constants/auth-timeouts.constants.js';

/**
 * Token blacklist service for managing revoked tokens
 */

@Injectable()
export class TokenBlacklistService implements LazyModuleRefService {
	private _contextualLogger: AppLogger | undefined;

	constructor(public readonly moduleRef: ModuleRef) {}

	public get AppLogger(): AppLogger {
		return this.moduleRef.get(AppLogger);
	}

	public get CacheProvider(): ICacheProvider | null {
		// Optional cache provider - applications may not have cache configured
		try {
			return this.moduleRef.get<ICacheProvider>(CACHE_PROVIDER);
		} catch {
			return null;
		}
	}

	private get logger(): AppLogger {
		this._contextualLogger ??= this.AppLogger.createContextualLogger(TokenBlacklistService.name);
		return this._contextualLogger;
	}

	/**
	 * Blacklist a token with expiration
	 * @param token Token to blacklist
	 * @param expiresInSeconds Time until token expires (for cache TTL)
	 */
	public async blacklistToken(token: string, expiresInSeconds: number): Promise<void> {
		this.logger.debug(`Blacklisting token: ${token.substring(0, TOKEN_LOG_PREFIX_LENGTH)}...`);
		const cacheProvider = this.CacheProvider;
		if (!cacheProvider) {
			this.logger.warn('Cache provider not available - token blacklisting disabled');
			return;
		}
		try {
			await cacheProvider.set(
				`blacklist:${token}`,
				true,
				expiresInSeconds,
			);
			this.logger.info('Token blacklisted successfully');
		} catch (error) {
			this.logger.error(`Failed to blacklist token: ${(error as Error).message}`);
			throw error;
		}
	}

	/**
	 * Check if a token is blacklisted
	 * @param token Token to check
	 * @returns True if token is blacklisted
	 */
	public async isTokenBlacklisted(token: string): Promise<boolean> {
		const cacheProvider = this.CacheProvider;
		if (!cacheProvider) {
			// Fail closed: treat token as blacklisted when cache is unavailable
			this.logger.warn('Cache provider not available - cannot check token blacklist, rejecting token for safety');
			return true;
		}
		try {
			const isBlacklisted = await cacheProvider.exists(`blacklist:${token}`);
			if (isBlacklisted) {
				this.logger.debug(`Token is blacklisted: ${token.substring(0, TOKEN_LOG_PREFIX_LENGTH)}...`);
			}
			return isBlacklisted;
		} catch (error) {
			this.logger.error(`Failed to check token blacklist: ${(error as Error).message}`);
			throw new UnauthorizedException('Failed to validate token blacklist status');
		}
	}

	/**
	 * Revoke all tokens for a user
	 * @param userId User ID whose tokens should be revoked
	 */
	public async revokeUserTokens(userId: string): Promise<void> {
		this.logger.info(`Revoking all tokens for user: ${userId}`);
		const cacheProvider = this.CacheProvider;
		if (!cacheProvider) {
			this.logger.warn('Cache provider not available - user token revocation disabled');
			return;
		}
		try {
			// Set a marker that all tokens for this user are revoked
			// This will be checked in token validation
			await cacheProvider.set(
				`revoke:${userId}`,
				Date.now(),
				TOKEN_TTL_24_HOURS,
			);
			this.logger.info(`All tokens revoked for user: ${userId}`);
		} catch (error) {
			this.logger.error(`Failed to revoke user tokens: ${(error as Error).message}`);
			throw error;
		}
	}

	/**
	 * Check if a user's tokens have been revoked
	 * @param userId User ID to check
	 * @returns True if user's tokens are revoked
	 */
	public async hasUserRevokedTokens(userId: string): Promise<boolean> {
		const cacheProvider = this.CacheProvider;
		if (!cacheProvider) {
			// Fail closed: treat tokens as revoked when cache is unavailable
			this.logger.warn('Cache provider not available - cannot check user token revocation, rejecting tokens for safety');
			return true;
		}
		try {
			const revoked = await cacheProvider.exists(`revoke:${userId}`);
			if (revoked) {
				this.logger.debug(`User tokens are revoked: ${userId}`);
			}
			return revoked;
		} catch (error) {
			this.logger.error(`Failed to check user token revocation: ${(error as Error).message}`);
			throw new UnauthorizedException('Failed to validate user token revocation status');
		}
	}

	/**
	 * Extract token from Authorization header
	 * @param authHeader Authorization header value
	 * @returns Token string or null
	 */
	public extractTokenFromHeader(authHeader: string): string | null {
		const BEARER_PREFIX = 'Bearer ';
		if (!authHeader?.startsWith(BEARER_PREFIX)) {
			return null;
		}
		return authHeader.substring(BEARER_PREFIX.length);
	}

	/**
	 * Cleanup expired blacklist entries
	 * @param _maxAgeSeconds Maximum age of entries to keep (default: 86400 = 24 hours)
	 */
	public cleanupExpiredEntries(_maxAgeSeconds: number = TOKEN_TTL_24_HOURS): void {
		this.logger.debug('Cleanup of expired blacklist entries requested - cache TTL handles this automatically');
		// Cache TTL automatically removes expired entries, so no manual cleanup needed
		// This method is here for interface compliance and potential future enhancements
	}
}
