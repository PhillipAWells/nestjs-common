import type KcAdminClient from '@keycloak/keycloak-admin-client';
import type { Logger } from '@pawells/logger';
import type { RetryConfig } from '../utils/index.js';
import { withRetry } from '../utils/index.js';
import {
	KeycloakClientError,
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	ValidationError,
	TimeoutError,
	NetworkError,
} from '../errors/index.js';

/**
 * Base service class for Keycloak client services
 */
export abstract class BaseService {
	constructor(
		protected adminClient: KcAdminClient,
		protected logger?: Logger,
		protected retryConfig?: RetryConfig,
	) {}

	/**
	 * Execute a function with retry logic
	 */
	protected async withRetry<T>(
		fn: () => Promise<T>,
		options?: RetryConfig,
	): Promise<T> {
		const config = {
			...this.retryConfig,
			...options,
			...(this.logger && { logger: this.logger }),
		};

		return withRetry(fn, config);
	}

	/**
	 * Handle and transform errors from Keycloak admin client
	 */
	protected handleError(error: unknown): never {
		// If already our error type, re-throw
		if (error instanceof KeycloakClientError) {
			throw error;
		}

		// Handle axios errors from admin client
		if (error && typeof error === 'object' && 'response' in error) {
			const axiosError = error as {
				response?: { status?: number; data?: unknown };
				message?: string;
				code?: string;
			};

			const status = axiosError.response?.status;
			const message = axiosError.message || 'Unknown error';
			const data = axiosError.response?.data;

			if (status === 401) {
				throw new AuthenticationError(message, status, data);
			}

			if (status === 403) {
				throw new AuthorizationError(message, status, data);
			}

			if (status === 404) {
				throw new NotFoundError(message, data);
			}

			if (status === 400) {
				throw new ValidationError(message, data);
			}

			if (status === 408) {
				throw new TimeoutError(message);
			}

			if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ETIMEDOUT') {
				throw new NetworkError(message, error instanceof Error ? error : undefined);
			}

			// Generic error with status code
			if (status) {
				throw new KeycloakClientError(message, status, data);
			}
		}

		// Generic error
		const message = error instanceof Error ? error.message : String(error);
		throw new KeycloakClientError(message, undefined, undefined, error instanceof Error ? error : undefined);
	}
}
