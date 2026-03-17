import type KcAdminClient from '@keycloak/keycloak-admin-client';
import type { Logger } from '@pawells/logger';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
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
import type { KeycloakAdminScope } from '../../permissions/keycloak-admin.permissions.js';
import { KeycloakAdminScopeError } from '../../permissions/keycloak-admin.permissions.js';

const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_REQUEST_TIMEOUT = 408;

/**
 * Base service class for Keycloak client services
 */
export abstract class BaseService {
	private readonly logger: AppLogger;

	protected adminClient: KcAdminClient;

	protected grantedScopes: ReadonlySet<KeycloakAdminScope>;

	protected loggerConfig?: Logger;

	protected retryConfig?: RetryConfig;

	constructor(
		adminClient: KcAdminClient,
		grantedScopes: ReadonlySet<KeycloakAdminScope>,
		loggerConfig?: Logger,
		retryConfig?: RetryConfig,
	) {
		this.adminClient = adminClient;
		this.grantedScopes = grantedScopes;
		this.loggerConfig = loggerConfig;
		this.retryConfig = retryConfig;
		this.logger = new AppLogger(undefined, this.constructor.name);
	}

	/**
	 * Asserts that the given scope is granted. Throws {@link KeycloakAdminScopeError}
	 * synchronously if not, before any network request is made.
	 * All mutation operations ({@link KeycloakAdminScope} ending in `:write`) are
	 * audit-logged at INFO level when the check passes.
	 */
	protected requireScope(scope: KeycloakAdminScope): void {
		if (!this.grantedScopes.has(scope)) {
			this.logger.warn(`Keycloak admin scope blocked: '${scope}' not granted`);
			throw new KeycloakAdminScopeError(scope);
		}

		if (scope.endsWith(':write')) {
			this.logger.info(`Keycloak admin mutation: scope '${scope}' invoked`);
		}
	}

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
			...(this.loggerConfig && { logger: this.loggerConfig }),
		};

		const result = await withRetry(fn, config);
		return result;
	}

	/**
	 * Handle and transform errors from Keycloak admin client
	 */
	protected handleError(error: unknown): never {
		// Re-throw scope errors without wrapping
		if (error instanceof KeycloakAdminScopeError) {
			throw error;
		}

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
			const message = axiosError.message ?? 'Unknown error';
			const data = axiosError.response?.data;

			if (status === HTTP_STATUS_UNAUTHORIZED) {
				throw new AuthenticationError(message, status, data);
			}

			if (status === HTTP_STATUS_FORBIDDEN) {
				throw new AuthorizationError(message, status, data);
			}

			if (status === HTTP_STATUS_NOT_FOUND) {
				throw new NotFoundError(message, data);
			}

			if (status === HTTP_STATUS_BAD_REQUEST) {
				throw new ValidationError(message, data);
			}

			if (status === HTTP_STATUS_REQUEST_TIMEOUT) {
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
		const message = getErrorMessage(error);
		throw new KeycloakClientError(message, undefined, undefined, error instanceof Error ? error : undefined);
	}
}
