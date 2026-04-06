import { Injectable, OnModuleInit, Inject, UnauthorizedException } from '@nestjs/common';
import { createPublicKey } from 'node:crypto';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { KEYCLOAK_MODULE_OPTIONS } from '../keycloak.constants.js';
import type { IKeycloakModuleOptions } from '../keycloak.types.js';

interface IJWK {
	kid: string;
	kty: string;
	n: string;
	e: string;
	[key: string]: unknown;
}

interface IJWKSResponse {
	keys: IJWK[];
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
	private readonly KeyCache: Map<string, string> = new Map();

	private CacheExpiresAt: number = 0;

	private FetchPromise: Promise<void> | null = null;

	private Logger?: AppLogger;

	private readonly Options: IKeycloakModuleOptions;

	constructor(
		@Inject(KEYCLOAK_MODULE_OPTIONS) options: IKeycloakModuleOptions,
	) {
		this.Options = options;
		this.InitializeLogger();
	}

	private InitializeLogger(): void {
		try {
			this.Logger = new AppLogger(undefined, JwksCacheService.name);
		} catch {
			// Logger unavailable, fall back to console
		}
	}

	public async onModuleInit(): Promise<void> {
		// Only fetch JWKS if in offline validation mode
		if (this.Options.validationMode !== 'offline') {
			return;
		}
		await this.FetchJwks();
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
	public async GetKey(kid: string): Promise<string> {
		// Check if key is in cache and not expired
		if (this.KeyCache.has(kid) && Date.now() < this.CacheExpiresAt) {
			const Key = this.KeyCache.get(kid);
			if (Key) {
				return Key;
			}
		}

		// Key not found or cache expired, re-fetch
		try {
			await this.FetchJwks();
		} catch (error) {
			this.Log('warn', `Failed to re-fetch JWKS during key lookup: ${getErrorMessage(error)}`);
		}

		// Check cache again after re-fetch — only return if cache is still valid
		if (this.KeyCache.has(kid) && Date.now() < this.CacheExpiresAt) {
			const Key = this.KeyCache.get(kid);
			if (Key) {
				return Key;
			}
		}

		throw new UnauthorizedException('Unknown signing key');
	}

	private async FetchJwks(): Promise<void> {
		// If a fetch is already in-flight, await it instead of making another request
		if (this.FetchPromise !== null) {
			await this.FetchPromise;
			return;
		}

		this.FetchPromise = this.DoFetch().finally(() => {
			this.FetchPromise = null;
		});
		await this.FetchPromise;
	}

	private async DoFetch(): Promise<void> {
		try {
			const JwksUrl = `${this.Options.authServerUrl}/realms/${this.Options.realm}/protocol/openid-connect/certs`;
			const Response = await fetch(JwksUrl);

			if (!Response.ok) {
				throw new Error(`JWKS fetch failed with status ${Response.status}`);
			}

			const JwksData: IJWKSResponse = await Response.json();

			if (!Array.isArray(JwksData.keys)) {
				throw new Error('Invalid JWKS response: keys is not an array');
			}

			this.KeyCache.clear();
			for (const Jwk of JwksData.keys) {
				const Pem = this.ConvertJwkToPem(Jwk);
				this.KeyCache.set(Jwk.kid, Pem);
			}

			const TtlMs = this.Options.jwksCacheTtlMs ?? DEFAULT_JWKS_CACHE_TTL_MS;
			this.CacheExpiresAt = Date.now() + TtlMs;
		} catch (error) {
			this.Log('warn', `Failed to fetch JWKS: ${getErrorMessage(error)}`);
			throw error;
		}
	}

	private ConvertJwkToPem(jwk: IJWK): string {
		const Key = createPublicKey({
			key: jwk,
			format: 'jwk',
		});
		return Key.export({
			type: 'spki',
			format: 'pem',
		}) as string;
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
