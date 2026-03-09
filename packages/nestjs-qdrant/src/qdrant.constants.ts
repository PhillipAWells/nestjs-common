/**
 * Qdrant Module Constants
 * Provides injectable tokens for Qdrant client and module options
 */

export const QDRANT_CLIENT_TOKEN = 'QDRANT_CLIENT';
export const QDRANT_MODULE_OPTIONS = 'QDRANT_MODULE_OPTIONS';
export const DEFAULT_QDRANT_CLIENT_NAME = 'default';

/**
 * Get the token for a named Qdrant client
 * @param name Optional client name. If not provided, returns the default token.
 * @returns The injection token for the client
 */
export function getQdrantClientToken(name?: string): string {
	return name ? `QDRANT_CLIENT:${name}` : QDRANT_CLIENT_TOKEN;
}

/**
 * Get the token for a named Qdrant module options
 * @param name Optional client name. If not provided, returns the default token.
 * @returns The injection token for the module options
 */
export function getQdrantModuleOptionsToken(name?: string): string {
	return name ? `QDRANT_MODULE_OPTIONS:${name}` : QDRANT_MODULE_OPTIONS;
}
