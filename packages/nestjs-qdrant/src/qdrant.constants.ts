/**
 * Qdrant Module Constants
 * Provides injectable tokens for Qdrant client and module options
 */

/**
 * Base token for the default Qdrant client instance.
 * Used for dependency injection when no client name is specified.
 * @internal
 */
export const QDRANT_CLIENT_TOKEN = 'QDRANT_CLIENT';

/**
 * Base token for the Qdrant module options.
 * References the sanitized options (without apiKey) for the default client instance.
 * @internal
 */
export const QDRANT_MODULE_OPTIONS = 'QDRANT_MODULE_OPTIONS';

/**
 * Default name for the Qdrant client instance when no name is specified.
 * Used in token generation functions.
 */
export const DEFAULT_QDRANT_CLIENT_NAME = 'default';

/**
 * Get the injection token for a named Qdrant client instance.
 * Used internally by @InjectQdrantClient() decorator and QdrantService.
 *
 * Token format:
 * - No name provided or name is 'default': returns 'QDRANT_CLIENT'
 * - Name provided: returns 'QDRANT_CLIENT:{name}'
 *
 * @param name - Optional client name for multi-tenant scenarios
 * @returns The injection token for the client
 *
 * @example
 * ```typescript
 * // Default client
 * const token = getQdrantClientToken();        // 'QDRANT_CLIENT'
 *
 * // Named client
 * const namedToken = getQdrantClientToken('archive'); // 'QDRANT_CLIENT:archive'
 * ```
 */
export function getQdrantClientToken(name?: string): string {
	return (!name || name === DEFAULT_QDRANT_CLIENT_NAME) ? QDRANT_CLIENT_TOKEN : `QDRANT_CLIENT:${name}`;
}

/**
 * Get the injection token for Qdrant module options for a named client.
 * Provides access to the sanitized module options (apiKey stripped for security).
 *
 * Token format:
 * - No name provided or name is 'default': returns 'QDRANT_MODULE_OPTIONS'
 * - Name provided: returns 'QDRANT_MODULE_OPTIONS:{name}'
 *
 * Note: In forRootAsync(), the apiKey is not exposed via this token. It is only
 * available to the client factory via an internal raw options token.
 *
 * @param name - Optional client name for multi-tenant scenarios
 * @returns The injection token for the module options
 *
 * @example
 * ```typescript
 * // Default options
 * const token = getQdrantModuleOptionsToken();        // 'QDRANT_MODULE_OPTIONS'
 *
 * // Named options
 * const namedToken = getQdrantModuleOptionsToken('archive'); // 'QDRANT_MODULE_OPTIONS:archive'
 * ```
 */
export function getQdrantModuleOptionsToken(name?: string): string {
	return (!name || name === DEFAULT_QDRANT_CLIENT_NAME) ? QDRANT_MODULE_OPTIONS : `QDRANT_MODULE_OPTIONS:${name}`;
}

/**
 * Maximum length for a Qdrant collection name.
 * Collection names must be <= 255 characters and contain only alphanumeric characters,
 * hyphens, and underscores (starting and ending with alphanumeric).
 */
export const MAX_COLLECTION_NAME_LENGTH = 255;
