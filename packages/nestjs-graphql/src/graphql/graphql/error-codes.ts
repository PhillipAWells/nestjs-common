/**
 * GraphQL Error Codes
 *
 * Standardized error codes for GraphQL operations.
 * These codes are used in error extensions to provide consistent
 * error identification for client applications.
 */
export enum GraphQLErrorCode {
	// Authentication & Authorization Errors
	UNAUTHENTICATED = 'UNAUTHENTICATED',
	FORBIDDEN = 'FORBIDDEN',

	// Input Validation Errors
	BAD_USER_INPUT = 'BAD_USER_INPUT',
	VALIDATION_ERROR = 'VALIDATION_ERROR',

	// Business Logic Errors
	CONFLICT = 'CONFLICT',
	NOT_FOUND = 'NOT_FOUND',

	// Rate Limiting Errors
	RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

	// System Errors
	INTERNAL_ERROR = 'INTERNAL_ERROR',
	SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * GraphQL Error Extensions Interface
 *
 * Defines the structure of error extensions returned to clients
 */
export interface IGraphQLErrorExtensions {
	code: GraphQLErrorCode;
	timestamp: string;
	details?: any;
	validationErrors?: IValidationError[];
}

/**
 * Validation Error Interface
 *
 * Structure for individual validation errors
 */
export interface IValidationError {
	field?: string;
	message?: string;
	constraints?: Record<string, string>;
}
