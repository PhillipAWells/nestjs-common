/**
 * Rate Limit Config Factory
 *
 * Provides a generic factory function for creating consistent rate limit configurations
 * across all services. Includes sensible defaults for authentication and API endpoints
 * with support for service-specific customization via deep merging.
 *
 * Default limits:
 * - auth.login: 5 requests per 60 seconds
 * - auth.register: 3 requests per 60 seconds
 * - auth.refreshToken: 10 requests per 60 seconds
 * - api.default: 100 requests per 60 seconds
 * - api.search: 30 requests per 60 seconds
 */

/**
 * Describes the rate limit for a single endpoint or operation
 *
 * @property ttl Time-to-live in milliseconds (sliding window for rate limit)
 * @property limit Maximum number of requests allowed within the TTL
 */
export interface IRateLimitDescriptor {
	/** Time-to-live in milliseconds */
	ttl: number;
	/** Maximum number of requests allowed within TTL */
	limit: number;
}

/**
 * Complete rate limit configuration with auth, API, and custom domain limits
 *
 * @property auth Authentication endpoint rate limits (login, register, refresh token)
 * @property api API endpoint rate limits (default, search)
 * @property custom Index signature for service-specific custom rate limits
 */
export interface IRateLimitConfig {
	/** Authentication endpoint limits */
	auth: {
		login?: IRateLimitDescriptor;
		register?: IRateLimitDescriptor;
		refreshToken?: IRateLimitDescriptor;
	};
	/** API endpoint limits */
	api: {
		default?: IRateLimitDescriptor;
		search?: IRateLimitDescriptor;
	};
	/** Custom service-specific limits */
	[key: string]: any;
}

/**
 * Default rate limit configuration
 *
 * Provides sensible defaults for all standard auth and API endpoints.
 * TTL values are in milliseconds, limit values are request counts.
 */
const DEFAULT_CONFIG: IRateLimitConfig = {
	auth: {
		login: {
			ttl: 60000, // 60 seconds
			limit: 5, // 5 requests per 60 seconds
		},
		register: {
			ttl: 60000, // 60 seconds
			limit: 3, // 3 requests per 60 seconds
		},
		refreshToken: {
			ttl: 60000, // 60 seconds
			limit: 10, // 10 requests per 60 seconds
		},
	},
	api: {
		default: {
			ttl: 60000, // 60 seconds
			limit: 100, // 100 requests per 60 seconds
		},
		search: {
			ttl: 60000, // 60 seconds
			limit: 30, // 30 requests per 60 seconds
		},
	},
};

/**
 * Deep merges a partial config with defaults, preserving unspecified defaults
 *
 * @param target The default configuration
 * @param source The override configuration (partial)
 * @returns Merged configuration with overrides applied
 *
 * @internal
 */
function DeepMerge(target: any, source: any): any {
	if (!source) {
		return target;
	}

	const result = { ...target };

	for (const key in source) {
		if (Object.prototype.hasOwnProperty.call(source, key)) {
			const sourceValue = source[key];
			const targetValue = target[key];

			// If source is an object (but not array or null), merge recursively
			if (
				sourceValue &&
				typeof sourceValue === 'object' &&
				!Array.isArray(sourceValue) &&
				sourceValue !== null &&
				targetValue &&
				typeof targetValue === 'object' &&
				!Array.isArray(targetValue)
			) {
				result[key] = DeepMerge(targetValue, sourceValue);
			} else {
				// Otherwise, use source value (overwrite)
				result[key] = sourceValue;
			}
		}
	}

	return result;
}

/**
 * Creates a rate limit configuration with optional overrides
 *
 * Creates a new rate limit configuration by deep merging the provided overrides
 * with sensible defaults. This ensures that all default limits are preserved
 * unless explicitly overridden.
 *
 * @param overrides Optional partial configuration to override defaults
 * @returns Complete rate limit configuration with overrides applied
 *
 * @example
 * ```typescript
 * import { CreateRateLimitConfig } from '@pawells/nestjs-shared';
 *
 * // Use all defaults
 * const config = CreateRateLimitConfig();
 *
 * // Override specific limits
 * const customConfig = CreateRateLimitConfig({
 *   auth: {
 *     login: { ttl: 30000, limit: 3 },
 *   },
 *   api: {},
 *   custom: {
 *     upload: { ttl: 300000, limit: 5 },
 *   },
 * });
 * ```
 */
export function CreateRateLimitConfig(overrides?: Partial<IRateLimitConfig>): IRateLimitConfig {
	return DeepMerge(DEFAULT_CONFIG, overrides) as IRateLimitConfig;
}
