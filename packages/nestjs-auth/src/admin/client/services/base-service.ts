import type KcAdminClient from '@keycloak/keycloak-admin-client';
import type { Logger } from '@pawells/logger';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import type { IRetryConfig } from '../utils/index.js';
import { WithRetry } from '../utils/index.js';
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
 * Subclasses must call {@link RequireScope} before API operations to enforce permission control.
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
	protected RequireScope(scope: TKeycloakAdminScope): void {
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
	protected async WithRetry<T>(
		fn: () => Promise<T>,
		options?: IRetryConfig,
	): Promise<T> {
		const Config = {
			...this.RetryConfig,
			...options,
			...(this.LoggerConfig && { logger: this.LoggerConfig }),
		};

		const Result = await WithRetry(fn, Config);
		return Result;
	}

	/**
	 * Handle and transform errors from Keycloak admin client
	 */
	protected HandleError(error: unknown): never {
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
			const AxiosError = error as {
				response?: { status?: number; data?: unknown };
				message?: string;
				code?: string;
			};

			const Status = AxiosError.response?.status;
			const Message = AxiosError.message ?? 'Unknown error';
			const Data = AxiosError.response?.data;

			if (Status === HTTP_STATUS_UNAUTHORIZED) {
				throw new AuthenticationError(Message, Status, Data);
			}

			if (Status === HTTP_STATUS_FORBIDDEN) {
				throw new AuthorizationError(Message, Status, Data);
			}

			if (Status === HTTP_STATUS_NOT_FOUND) {
				throw new NotFoundError(Message, Data);
			}

			if (Status === HTTP_STATUS_BAD_REQUEST) {
				throw new IValidationError(Message, Data);
			}

			if (Status === HTTP_STATUS_REQUEST_TIMEOUT) {
				throw new TimeoutError(Message);
			}

			if (AxiosError.code === 'ECONNREFUSED' || AxiosError.code === 'ETIMEDOUT') {
				throw new NetworkError(Message, error instanceof Error ? error : undefined);
			}

			// Generic error with status code
			if (Status) {
				throw new KeycloakClientError(Message, Status, Data);
			}
		}

		// Generic error
		const Message = getErrorMessage(error);
		throw new KeycloakClientError(Message, undefined, undefined, error instanceof Error ? error : undefined);
	}
}
