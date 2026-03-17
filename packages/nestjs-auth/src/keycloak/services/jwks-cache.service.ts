import { Injectable, OnModuleInit, Inject, UnauthorizedException } from '@nestjs/common';
import { createPublicKey } from 'node:crypto';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { KEYCLOAK_MODULE_OPTIONS } from '../keycloak.constants.js';
import type { KeycloakModuleOptions } from '../keycloak.types.js';

interface JWK {
	kid: string;
	kty: string;
	n: string;
	e: string;
	[key: string]: unknown;
}

interface JWKSResponse {
	keys: JWK[];
}

const DEFAULT_JWKS_CACHE_TTL_MS = 300_000;

/**
 * JWKS Cache Service
 *
 * Fetches and caches JWKS (JSON Web Key Set) from Keycloak for offline token validation.
 * Used exclusively in offline validation mode to verify JWT signatures locally without
 * contacting the Keycloak introspection endpoint.
 *
 * Caches keys with automatic expiration (default 5 minutes). On key rotation or cache expiry,
 * automatically re-fetches the latest JWKS from Keycloak. Prevents concurrent fetches to avoid
 * stampedes.
 *
 * @example
 * ```typescript
 * constructor(private jwksCache: JwksCacheService) {}
 *
 * async validateJwt(token: string): Promise<boolean> {
 *   const decoded = jwt.decode(token, { complete: true });
 *   const key = await this.jwksCache.getKey(decoded.header.kid);
 *   return jwt.verify(token, key);
 * }
 * ```
 */
@Injectable()
export class JwksCacheService implements OnModuleInit {
	private readonly keyCache: Map<string, string> = new Map();

	private cacheExpiresAt: number = 0;

	private fetchPromise: Promise<void> | null = null;

	private logger?: AppLogger;

	private readonly options: KeycloakModuleOptions;

	constructor(
		@Inject(KEYCLOAK_MODULE_OPTIONS) options: KeycloakModuleOptions,
	) {
		this.options = options;
		this.initializeLogger();
	}

	private initializeLogger(): void {
		try {
			this.logger = new AppLogger(undefined, JwksCacheService.name);
		} catch {
			// Logger unavailable, fall back to console
		}
	}

	public async onModuleInit(): Promise<void> {
		// Only fetch JWKS if in offline validation mode
		if (this.options.validationMode !== 'offline') {
			return;
		}
		await this.fetchJwks();
	}

	/**
	 * Get a public key from cache by key ID (kid)
	 *
	 * Checks the cache for the requested key. If found and not expired, returns it immediately.
	 * If not found or cache is expired, automatically re-fetches all keys from Keycloak.
	 * Prevents concurrent fetches with an internal lock.
	 *
	 * On key rotation, the next key request for a missing `kid` will trigger a refresh and
	 * cache the new key set.
	 *
	 * @param kid - The Key ID (from JWT header) to retrieve
	 * @returns The PEM-encoded public key (SPKI format)
	 * @throws {UnauthorizedException} If the key ID is not found after re-fetch attempt
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   const key = await this.jwksCache.getKey('abc123');
	 *   // Use key for JWT verification
	 * } catch (error) {
	   *   // Handle unknown key ID
	 * }
	 * ```
	 */
	public async getKey(kid: string): Promise<string> {
		// Check if key is in cache and not expired
		if (this.keyCache.has(kid) && Date.now() < this.cacheExpiresAt) {
			const key = this.keyCache.get(kid);
			if (key) {
				return key;
			}
		}

		// Key not found or cache expired, re-fetch
		try {
			await this.fetchJwks();
		} catch (error) {
			this.log('warn', `Failed to re-fetch JWKS during key lookup: ${getErrorMessage(error)}`);
		}

		// Check cache again after re-fetch — only return if cache is still valid
		if (this.keyCache.has(kid) && Date.now() < this.cacheExpiresAt) {
			const key = this.keyCache.get(kid);
			if (key) {
				return key;
			}
		}

		throw new UnauthorizedException('Unknown signing key');
	}

	private async fetchJwks(): Promise<void> {
		// If a fetch is already in-flight, await it instead of making another request
		if (this.fetchPromise !== null) {
			await this.fetchPromise;
			return;
		}

		this.fetchPromise = this.doFetch().finally(() => {
			this.fetchPromise = null;
		});
		await this.fetchPromise;
	}

	private async doFetch(): Promise<void> {
		try {
			const jwksUrl = `${this.options.authServerUrl}/realms/${this.options.realm}/protocol/openid-connect/certs`;
			const response = await fetch(jwksUrl);

			if (!response.ok) {
				throw new Error(`JWKS fetch failed with status ${response.status}`);
			}

			const jwksData: JWKSResponse = await response.json();

			if (!Array.isArray(jwksData.keys)) {
				throw new Error('Invalid JWKS response: keys is not an array');
			}

			this.keyCache.clear();
			for (const jwk of jwksData.keys) {
				const pem = this.convertJwkToPem(jwk);
				this.keyCache.set(jwk.kid, pem);
			}

			const ttlMs = this.options.jwksCacheTtlMs ?? DEFAULT_JWKS_CACHE_TTL_MS;
			this.cacheExpiresAt = Date.now() + ttlMs;
		} catch (error) {
			this.log('warn', `Failed to fetch JWKS: ${getErrorMessage(error)}`);
			throw error;
		}
	}

	private convertJwkToPem(jwk: JWK): string {
		const key = createPublicKey({
			key: jwk,
			format: 'jwk',
		});
		return key.export({
			type: 'spki',
			format: 'pem',
		}) as string;
	}

	private log(level: 'warn' | 'info', message: string): void {
		if (this.logger) {
			if (level === 'warn') {
				this.logger.warn(message);
			} else {
				this.logger.info(message);
			}
		}
	}
}
