import type { RetryConfig } from '../utils/index.js';
import type { Logger } from '@pawells/logger';

/**
 * Keycloak client configuration
 */
export interface KeycloakClientConfig {
	/**
	 * Base URL of the Keycloak server
	 * @example 'http://localhost:8080'
	 */
	baseUrl: string;

	/**
	 * Realm name to operate on
	 * @default 'master'
	 */
	realmName?: string;

	/**
	 * Authentication credentials
	 */
	credentials: KeycloakCredentials;

	/**
	 * Request timeout in milliseconds
	 * @default 30000
	 */
	timeout?: number;

	/**
	 * Retry configuration
	 */
	retry?: RetryConfig;

	/**
	 * Logger instance for client logging
	 */
	logger?: Logger;
}

/**
 * Keycloak authentication credentials (username/password or client credentials)
 */
export type KeycloakCredentials =
	| {
		username: string;
		password: string;
	}
	| {
		clientId: string;
		clientSecret: string;
	};

/**
 * Check if credentials are username/password
 */
export function isPasswordCredentials(
	credentials: KeycloakCredentials
): credentials is { username: string; password: string } {
	return 'username' in credentials && 'password' in credentials;
}

/**
 * Check if credentials are client credentials
 */
export function isClientCredentials(
	credentials: KeycloakCredentials
): credentials is { clientId: string; clientSecret: string } {
	return 'clientId' in credentials && 'clientSecret' in credentials;
}
