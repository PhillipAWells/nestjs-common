/**
 * Base error class for Keycloak client errors
 */
export class KeycloakClientError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number,
		public readonly response?: unknown,
		public override readonly cause?: Error
	) {
		super(message);
		this.name = 'KeycloakClientError';
		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * Authentication error - failed to authenticate with Keycloak
 */
export class AuthenticationError extends KeycloakClientError {
	constructor(message: string, statusCode?: number, response?: unknown) {
		super(message, statusCode, response);
		this.name = 'AuthenticationError';
	}
}

/**
 * Authorization error - authenticated but not authorized for the operation
 */
export class AuthorizationError extends KeycloakClientError {
	constructor(message: string, statusCode?: number, response?: unknown) {
		super(message, statusCode, response);
		this.name = 'AuthorizationError';
	}
}

/**
 * Resource not found error
 */
export class NotFoundError extends KeycloakClientError {
	constructor(message: string, response?: unknown) {
		super(message, 404, response);
		this.name = 'NotFoundError';
	}
}

/**
 * Validation error - invalid request data
 */
export class ValidationError extends KeycloakClientError {
	constructor(message: string, response?: unknown) {
		super(message, 400, response);
		this.name = 'ValidationError';
	}
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends KeycloakClientError {
	constructor(message: string, response?: unknown) {
		super(message, 429, response);
		this.name = 'RateLimitError';
	}
}

/**
 * Timeout error - request took too long
 */
export class TimeoutError extends KeycloakClientError {
	constructor(message: string) {
		super(message, 408);
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
		super(message, 409, response);
		this.name = 'ConflictError';
	}
}
