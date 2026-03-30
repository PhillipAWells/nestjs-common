import { BaseApplicationError } from './base-application-error.js';

/**
 * Configuration interface for creating error classes
 */
export interface IErrorConfig {
	/** The error code for programmatic identification */
	code: string;
	/** The HTTP status code */
	statusCode: number;
	/** Default error message */
	defaultMessage: string;
	/** Optional error class name (defaults to code + 'Error') */
	name?: string;
}

/**
 * Factory function to create application error classes
 *
 * This factory eliminates code duplication by generating error classes
 * from configuration objects instead of defining each class individually.
 *
 * @param config - Configuration for the error class
 * @returns An application error class constructor
 *
 * @example
 * ```typescript
 * export const NotFoundError = createError({
 *   code: 'NOT_FOUND',
 *   statusCode: 404,
 *   defaultMessage: 'Resource not found'
 * });
 * ```
 */
export function createError(config: IErrorConfig): typeof BaseApplicationError {
	const { code, statusCode, defaultMessage, name = `${code}Error` } = config;

	/**
	 * Dynamically created application error class
	 */
	class GeneratedApplicationError extends BaseApplicationError {
		/**
		 * Creates a new error instance
		 *
		 * @param message - Custom error message (optional)
		 * @param context - Additional context information (optional)
		 */
		constructor(message = defaultMessage, context?: Record<string, any>) {
			const options: any = {
				code,
				statusCode,
			};
			if (context !== undefined) {
				options.context = context;
			}
			super(message, options);
		}
	}

	// Set the class name for better debugging and instanceof checks
	Object.defineProperty(GeneratedApplicationError, 'name', {
		value: name,
		writable: false,
	});

	return GeneratedApplicationError;
}

/**
 * Error configurations for all standard HTTP error types
 */
export const ERROR_CONFIGS = {
	BAD_REQUEST: {
		code: 'BAD_REQUEST',
		statusCode: 400,
		defaultMessage: 'Bad request',
	},
	UNAUTHORIZED: {
		code: 'UNAUTHORIZED',
		statusCode: 401,
		defaultMessage: 'Unauthorized',
	},
	FORBIDDEN: {
		code: 'FORBIDDEN',
		statusCode: 403,
		defaultMessage: 'Forbidden',
	},
	NOT_FOUND: {
		code: 'NOT_FOUND',
		statusCode: 404,
		defaultMessage: 'Not found',
	},
	CONFLICT: {
		code: 'CONFLICT',
		statusCode: 409,
		defaultMessage: 'Conflict',
	},
	UNPROCESSABLE_ENTITY: {
		code: 'UNPROCESSABLE_ENTITY',
		statusCode: 422,
		defaultMessage: 'Unprocessable entity',
	},
	INTERNAL_SERVER_ERROR: {
		code: 'INTERNAL_SERVER_ERROR',
		statusCode: 500,
		defaultMessage: 'Internal server error',
	},
	BAD_GATEWAY: {
		code: 'BAD_GATEWAY',
		statusCode: 502,
		defaultMessage: 'Bad gateway',
	},
	SERVICE_UNAVAILABLE: {
		code: 'SERVICE_UNAVAILABLE',
		statusCode: 503,
		defaultMessage: 'Service unavailable',
	},
	GATEWAY_TIMEOUT: {
		code: 'GATEWAY_TIMEOUT',
		statusCode: 504,
		defaultMessage: 'Gateway timeout',
	},
} as const;

/**
 * Type for error configuration keys
 */
export type TErrorType = keyof typeof ERROR_CONFIGS;
