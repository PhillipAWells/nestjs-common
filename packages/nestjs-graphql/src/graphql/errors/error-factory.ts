import { GraphqlError } from './graphql-error.js';

/**
 * Configuration for creating GraphQL error classes
 */
export interface IGraphQLErrorConfig {
	/** The error code used in GraphQL extensions */
	code: string;
	/** The HTTP status code */
	statusCode: number;
	/** Default error message */
	defaultMessage: string;
}

/**
 * Factory function to create GraphQL error classes
 *
 * This factory eliminates code duplication by generating error classes
 * from configuration objects instead of defining each class individually.
 *
 * @param config - Configuration for the error class
 * @returns A GraphQL error class constructor
 *
 * @example
 * ```typescript
 * export const UnauthorizedError = createGraphQLError({
 *   code: 'UNAUTHORIZED',
 *   statusCode: 401,
 *   defaultMessage: 'Unauthorized'
 * });
 * ```
 */
export function createGraphQLError(config: IGraphQLErrorConfig): typeof GraphqlError {
	const { code, statusCode, defaultMessage } = config;

	/**
	 * Dynamically created GraphQL error class
	 */
	class GeneratedGraphQLError extends GraphqlError {
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

	// Set the class name for better debugging
	Object.defineProperty(GeneratedGraphQLError, 'name', {
		value: `${code}Error`,
		writable: false,
	});

	return GeneratedGraphQLError;
}

/**
 * Error configurations for all standard GraphQL error types
 */
export const ERROR_CONFIGS = {
	UNAUTHORIZED: {
		code: 'UNAUTHORIZED',
		statusCode: 401,
		defaultMessage: 'Authentication required',
	},
	NOT_FOUND: {
		code: 'NOT_FOUND',
		statusCode: 404,
		defaultMessage: 'Resource not found',
	},
	FORBIDDEN: {
		code: 'FORBIDDEN',
		statusCode: 403,
		defaultMessage: 'Access forbidden',
	},
	BAD_REQUEST: {
		code: 'BAD_REQUEST',
		statusCode: 400,
		defaultMessage: 'Bad request',
	},
	CONFLICT: {
		code: 'CONFLICT',
		statusCode: 409,
		defaultMessage: 'Resource conflict',
	},
	INTERNAL_SERVER_ERROR: {
		code: 'INTERNAL_SERVER_ERROR',
		statusCode: 500,
		defaultMessage: 'Internal server error',
	},
	RATE_LIMIT_EXCEEDED: {
		code: 'RATE_LIMIT_EXCEEDED',
		statusCode: 429,
		defaultMessage: 'Rate limit exceeded',
	},
} as const;

/**
 * Type for error configuration keys
 */
export type TGraphQLErrorType = keyof typeof ERROR_CONFIGS;
