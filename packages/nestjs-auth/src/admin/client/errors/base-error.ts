import { BaseApplicationError } from '@pawells/nestjs-shared/common';

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_REQUEST_TIMEOUT = 408;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_RATE_LIMIT = 429;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

/**
 * Base error class for Keycloak client errors
 */
export class KeycloakClientError extends BaseApplicationError {
	public readonly Response?: unknown;
	public readonly Cause?: Error;

	constructor(
		message: string,
		statusCode?: number,
		response?: unknown,
		cause?: Error,
	) {
		const errorCode = `KEYCLOAK_${statusCode ? 'HTTP_' + statusCode : 'CLIENT_ERROR'}`;
		super(message, {
			code: errorCode,
			statusCode: statusCode ?? HTTP_STATUS_INTERNAL_SERVER_ERROR,
			context: { response, cause },
		});
		this.name = 'KeycloakClientError';
		this.Response = response;
		this.Cause = cause;
	}
}

/**
 * Authentication error - failed to authenticate with Keycloak
 */
export class AuthenticationError extends KeycloakClientError {
	constructor(message: string, statusCode?: number, response?: unknown) {
		super(message, statusCode ?? HTTP_STATUS_UNAUTHORIZED, response);
		this.name = 'AuthenticationError';
	}
}

/**
 * Authorization error - authenticated but not authorized for the operation
 */
export class AuthorizationError extends KeycloakClientError {
	constructor(message: string, statusCode?: number, response?: unknown) {
		super(message, statusCode ?? HTTP_STATUS_FORBIDDEN, response);
		this.name = 'AuthorizationError';
	}
}

/**
 * Resource not found error
 */
export class NotFoundError extends KeycloakClientError {
	constructor(message: string, response?: unknown) {
		super(message, HTTP_STATUS_NOT_FOUND, response);
		this.name = 'NotFoundError';
	}
}

/**
 * Validation error - invalid request data
 */
export class IValidationError extends KeycloakClientError {
	constructor(message: string, response?: unknown) {
		super(message, HTTP_STATUS_BAD_REQUEST, response);
		this.name = 'IValidationError';
	}
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends KeycloakClientError {
	constructor(message: string, response?: unknown) {
		super(message, HTTP_STATUS_RATE_LIMIT, response);
		this.name = 'RateLimitError';
	}
}

/**
 * Timeout error - request took too long
 */
export class TimeoutError extends KeycloakClientError {
	constructor(message: string) {
		super(message, HTTP_STATUS_REQUEST_TIMEOUT);
		this.name = 'TimeoutError';
	}
}

/**
 * Network error - connection failed
 */
export class NetworkError extends KeycloakClientError {
	constructor(message: string, cause?: Error) {
		super(message, undefined, undefined, cause);
		this.name = 'NetworkError';
	}
}

/**
 * Conflict error - resource already exists or conflicting operation
 */
export class ConflictError extends KeycloakClientError {
	constructor(message: string, response?: unknown) {
		super(message, HTTP_STATUS_CONFLICT, response);
		this.name = 'ConflictError';
	}
}
