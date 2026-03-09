/**
 * Dependency Injection tokens for Auth module
 *
 * Centralizes all DI tokens used in the auth module to:
 * - Avoid magic strings scattered throughout code
 * - Enable IDE autocompletion
 * - Simplify test fixture creation
 * - Prevent typos that fail silently
 */

/**
 * Token for injecting user repository implementation
 * Applications should provide their own implementation
 */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

/**
 * Token for injecting user lookup function
 * Used during JWT validation to fetch user data
 * Type: (userId: string) => Promise<User | null>
 */
export const USER_LOOKUP_FN = Symbol('USER_LOOKUP_FN');

/**
 * Cache provider token (defined in nestjs-shared)
 * Injected to enable token blacklisting and session management
 * Optional: auth module works without cache (degraded mode)
 */
export { CACHE_PROVIDER } from '@pawells/nestjs-shared/common';

/**
 * Auth module tokens enum for IDE discoverability
 * Useful for finding all available tokens
 */
export const AuthTokens = {
	USER_REPOSITORY,
	USER_LOOKUP_FN,
} as const;
