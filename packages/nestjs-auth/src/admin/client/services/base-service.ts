import type KcAdminClient from '@keycloak/keycloak-admin-client';
import type { Logger } from '@pawells/logger';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import type { IRetryConfig } from '../utils/index.js';
import { withRetry } from '../utils/index.js';
import {
	KeycloakClientError,
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	IValidationError,
	TimeoutError,
	NetworkError,
} from '../errors/index.js';
import type { TKeycloakAdminScope } from '../../permissions/keycloak-admin.permissions.js';
import { KeycloakAdminScopeError } from '../../permissions/keycloak-admin.permissions.js';

const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_REQUEST_TIMEOUT = 408;

/**
 * Base service class for Keycloak admin API client services.
 *
 * Provides shared functionality for all admin sub-services: error handling with classified
 * exceptions, retry logic for transient failures, and scope-based access control.
 * All Keycloak admin operations (user, role, client, group management, etc.) inherit from this class.
 *
 * Subclasses must call {@link requireScope} before API operations to enforce permission control.
 *
 * @abstract
 */
export abstract class BaseService {
	private readonly Logger: AppLogger;

	protected AdminClient: KcAdminClient;

	protected GrantedScopes: ReadonlySet<TKeycloakAdminScope>;

	protected LoggerConfig?: Logger;

	protected RetryConfig?: IRetryConfig;

	constructor(
		adminClient: KcAdminClient,
		grantedScopes: ReadonlySet<TKeycloakAdminScope>,
		loggerConfig?: Logger,
		retryConfig?: IRetryConfig,
	) {
		this.AdminClient = adminClient;
		this.GrantedScopes = grantedScopes;
		this.LoggerConfig = loggerConfig;
		this.RetryConfig = retryConfig;
		this.Logger = new AppLogger(undefined, this.constructor.name);
	}

	/**
	 * Asserts that the given scope is granted. Throws {@link KeycloakAdminScopeError}
	 * synchronously if not, before any network request is made.
	 * All mutation operations ({@link TKeycloakAdminScope} ending in `:write`) are
	 * audit-logged at INFO level when the check passes.
	 */
	protected requireScope(scope: TKeycloakAdminScope): void {
		if (!this.GrantedScopes.has(scope)) {
			this.Logger.warn(`Keycloak admin scope blocked: '${scope}' not granted`);
			throw new KeycloakAdminScopeError(scope);
		}

		if (scope.endsWith(':write')) {
			this.Logger.info(`Keycloak admin mutation: scope '${scope}' invoked`);
		}
	}

	/**
	 * Execute a function with retry logic
	 */
	protected async withRetry<T>(
		fn: () => Promise<T>,
		options?: IRetryConfig,
	): Promise<T> {
		const config = {
			...this.RetryConfig,
			...options,
			...(this.LoggerConfig && { logger: this.LoggerConfig }),
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
				throw new IValidationError(message, data);
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
