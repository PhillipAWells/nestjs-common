import { Injectable, OnModuleInit } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import axios, { AxiosInstance } from 'axios';
import jwkToPem from 'jwk-to-pem';
import * as jwt from 'jsonwebtoken';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { OAuthUser, OAuthToken } from './types/oauth-config.types.js';
import { OAUTH_SERVICE_TIMEOUT, OAUTH_TIMEOUT_10_SECONDS_MULTIPLIER, JWK_CACHE_TTL_MS } from '../../constants/auth-timeouts.constants.js';

const OAUTH_DEFAULT_EXPIRES_IN = 3600;

@Injectable()
export class OAuthService implements LazyModuleRefService, OnModuleInit {
	private _logger: AppLogger | undefined;

	private httpClient!: AxiosInstance;

	private readonly publicKeyCache = new Map<string, { key: string; expires: number }>();

	private readonly _jwksFetching = new Map<string, Promise<string>>();

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	private get logger(): AppLogger {
		this._logger ??= this.AppLogger.createContextualLogger(OAuthService.name);
		return this._logger;
	}

	constructor(public readonly Module: ModuleRef) {}

	public onModuleInit(): void {
		this.httpClient = axios.create({
			timeout: OAUTH_SERVICE_TIMEOUT * OAUTH_TIMEOUT_10_SECONDS_MULTIPLIER, // 10 seconds
		});
	}

	/**
    * Verify and decode OAuth token
    */
	public async verifyToken(token: string, provider: string): Promise<OAuthUser> {
		this.logger.debug(`Token verification initiated for provider ${provider}`);
		try {
			const publicKey = await this.getPublicKey(provider);
			const decoded = await this.validateToken(token, publicKey);
			const user = this.extractUserFromToken(decoded);
			this.logger.info(`Token verification successful for provider ${provider}, user ${user.email}`);
			return user;
		} catch (error) {
			this.logger.error(`Token verification failed for provider ${provider}`, (error as Error).stack);
			throw new Error('Invalid token');
		}
	}

	/**
    * Get public key for token verification
    */
	public async getPublicKey(provider: string): Promise<string> {
		const cacheKey = `public_key_${provider}`;
		const cached = this.publicKeyCache.get(cacheKey);

		if (cached && cached.expires > Date.now()) {
			this.logger.debug(`Using cached public key for provider ${provider}`);
			return cached.key;
		}

		this.logger.debug(`Fetching public key for provider ${provider}`);

		// For now, implement basic JWKS fetching
		// In production, this would be configured per provider
		const jwksUrl = this.getJwksUrl(provider);
		if (!jwksUrl) {
			this.logger.error(`JWKS URL not configured for provider ${provider}`);
			throw new Error(`JWKS URL not configured for provider ${provider}`);
		}

		// Single-flight pattern: reuse in-flight fetch if one exists
		if (this._jwksFetching.has(jwksUrl)) {
			this.logger.debug(`Reusing in-flight JWKS fetch for ${jwksUrl}`);
			return this._jwksFetching.get(jwksUrl)!;
		}

		const fetchPromise = this.fetchAndCachePublicKey(jwksUrl, provider)
			.finally(() => {
				this._jwksFetching.delete(jwksUrl);
			});

		this._jwksFetching.set(jwksUrl, fetchPromise);
		return fetchPromise;
	}

	/**
	 * Fetch and cache public key from JWKS endpoint
	 */
	private async fetchAndCachePublicKey(jwksUrl: string, provider: string): Promise<string> {
		try {
			const response = await this.httpClient.get(jwksUrl);
			const jwk = response.data.keys?.find((k: any) => k.use === 'sig' && (!k.alg || k.alg === 'RS256'));
			if (!jwk) {
				this.logger.error(`No suitable signing key found in JWKS response from ${jwksUrl}`);
				throw new Error('No suitable signing key found in JWKS');
			}

			const pem = jwkToPem(jwk);
			const cacheKey = `public_key_${provider}`;
			this.publicKeyCache.set(cacheKey, {
				key: pem,
				expires: Date.now() + JWK_CACHE_TTL_MS,
			});

			this.logger.info(`Public key cached for provider ${provider}`);
			return pem;
		} catch (error) {
			this.logger.error(`Failed to fetch public key for provider ${provider}`, (error as Error).stack);
			throw error;
		}
	}

	/**
    * Validate JWT token with public key
    */
	public async validateToken(token: string, publicKey: string): Promise<any> {
		this.logger.debug('JWT token validation initiated');
		const decoded = await new Promise((resolve, reject) => {
			jwt.verify(token, publicKey, { algorithms: ['RS256'] }, (err: any, result: any) => {
				if (err) {
					this.logger.warn('JWT token validation failed', err.message);
					reject(err);
				} else {
					this.logger.debug('JWT token validation successful');
					resolve(result);
				}
			});
		});
		return decoded;
	}

	/**
    * Extract user information from JWT claims
    */
	public extractUserFromToken(decoded: any): OAuthUser {
		this.logger.debug(`Extracting user info from token for user ${decoded.email ?? decoded.sub}`);
		const user = {
			id: decoded.sub ?? decoded.preferred_username ?? decoded.email,
			email: decoded.email,
			name: decoded.name,
			roles: this.extractRolesFromToken(decoded),
			sub: decoded.sub,
			preferred_username: decoded.preferred_username,
			given_name: decoded.given_name,
			family_name: decoded.family_name,
			...decoded,
		};
		this.logger.debug(`User info extracted: ${user.email} with roles [${user.roles.join(', ')}]`);
		return user;
	}

	/**
    * Extract roles from token claims
    */
	public extractRolesFromToken(decoded: any): string[] {
		const roles: string[] = [];

		// Keycloak realm roles
		if (decoded.realm_access?.roles) {
			roles.push(...decoded.realm_access.roles);
		}

		// Keycloak client roles
		if (decoded.resource_access) {
			Object.values(decoded.resource_access).forEach((clientRoles: any) => {
				if (clientRoles.roles) {
					roles.push(...clientRoles.roles);
				}
			});
		}

		// Generic OIDC roles claim
		if (decoded.roles) {
			if (Array.isArray(decoded.roles)) {
				roles.push(...decoded.roles);
			} else if (typeof decoded.roles === 'string') {
				roles.push(decoded.roles);
			}
		}

		const uniqueRoles = [...new Set(roles)]; // Remove duplicates
		this.logger.debug(`Extracted ${uniqueRoles.length} unique roles from token`);
		return uniqueRoles;
	}

	/**
   * Refresh OAuth token
   */
	public async refreshToken(refreshToken: string, provider: string): Promise<OAuthToken> {
		this.logger.debug(`Token refresh initiated for provider ${provider}`);
		try {
			if (!refreshToken || typeof refreshToken !== 'string') {
				this.logger.error('Invalid refresh token provided');
				throw new Error('Invalid refresh token');
			}

			// Construct provider-specific token endpoint
			const tokenEndpoint = this.getTokenEndpoint(provider);
			if (!tokenEndpoint) {
				this.logger.error(`Token endpoint not configured for provider ${provider}`);
				throw new Error(`Token endpoint not configured for provider ${provider}`);
			}

			// Request new tokens from provider
			const response = await this.httpClient.post<any>(tokenEndpoint, {
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				client_id: process.env[`${provider.toUpperCase()}_CLIENT_ID`],
				client_secret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`],
			});

			if (!response.data.access_token) {
				this.logger.error('Provider returned no access token');
				throw new Error('No access token in response');
			}

			const token: OAuthToken = {
				accessToken: response.data.access_token,
				refreshToken: response.data.refresh_token ?? refreshToken,
				expiresIn: response.data.expires_in ?? OAUTH_DEFAULT_EXPIRES_IN,
				tokenType: response.data.token_type ?? 'Bearer',
			};

			this.logger.info(`Token refresh successful for provider ${provider}`);
			return token;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Token refresh failed for provider ${provider}: ${errorMessage}`);
			throw error;
		}
	}

	/**
   * Get user info from OAuth provider
   */
	public async getUserInfo(accessToken: string, provider: string): Promise<OAuthUser> {
		this.logger.debug(`Retrieving user info from provider ${provider}`);
		try {
			if (!accessToken || typeof accessToken !== 'string') {
				this.logger.error('Invalid access token provided');
				throw new Error('Invalid access token');
			}

			// Construct provider-specific userinfo endpoint
			const userInfoEndpoint = this.getUserInfoEndpoint(provider);
			if (!userInfoEndpoint) {
				this.logger.error(`User info endpoint not configured for provider ${provider}`);
				throw new Error(`User info endpoint not configured for provider ${provider}`);
			}

			// Request user info from provider
			const response = await this.httpClient.get<any>(userInfoEndpoint, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});

			if (!response.data) {
				this.logger.error('Provider returned no user data');
				throw new Error('No user data in response');
			}

			// Extract user info - normalize across different provider formats
			const user = this.extractUserFromToken(response.data);

			this.logger.info(`User info retrieved successfully for provider ${provider}, user ${user.email}`);
			return user;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Failed to retrieve user info from provider ${provider}: ${errorMessage}`);
			throw error;
		}
	}

	/**
   * Get JWKS URL for provider
   */
	private getJwksUrl(provider: string): string | null {
		const envKey = `${provider.toUpperCase()}_JWKS_URI`;
		return process.env[envKey] ?? null;
	}

	/**
	 * Get token endpoint URL for provider
	 */
	private getTokenEndpoint(provider: string): string | null {
		const envKey = `${provider.toUpperCase()}_TOKEN_ENDPOINT`;
		return process.env[envKey] ?? null;
	}

	/**
	 * Get user info endpoint URL for provider
	 */
	private getUserInfoEndpoint(provider: string): string | null {
		const envKey = `${provider.toUpperCase()}_USERINFO_ENDPOINT`;
		return process.env[envKey] ?? null;
	}
}
