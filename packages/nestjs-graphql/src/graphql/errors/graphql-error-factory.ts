import { GraphQLError } from 'graphql';

/**
 * Base configuration interface for error classes
 */
interface ErrorConfig {
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
 * Configuration interface for creating GraphQL error classes
 * Extends the base ErrorConfig with GraphQL-specific properties
 */
export interface GraphQLErrorConfig extends ErrorConfig {
	/** The GraphQL error code used in extensions */
	graphqlCode: string;
}

/**
 * Factory function to create GraphQL error classes
 *
 * This factory extends the base createError factory to provide GraphQL-specific
 * formatting and extensions while maintaining compatibility with the base error hierarchy.
 *
 * @param config - Configuration for the GraphQL error class
 * @returns A GraphQL error class constructor
 *
 * @example
 * ```typescript
 * export const NotFoundError = createGraphQLError({
 *   code: 'NOT_FOUND',
 *   statusCode: 404,
 *   defaultMessage: 'Resource not found',
 *   graphqlCode: 'NOT_FOUND'
 * });
 * ```
 */
export function createGraphQLError(config: GraphQLErrorConfig) {
	const { code, statusCode, defaultMessage, name = `${code}Error`, graphqlCode } = config;

	/**
	 * Dynamically created GraphQL error class
	 * Extends GraphQLError for GraphQL-specific formatting while inheriting from BaseApplicationError
	 */
	class GeneratedGraphQLError extends GraphQLError {
		public readonly statusCode: number;

		public readonly code: string;

		public readonly context: Record<string, unknown>;

		public readonly timestamp: Date;

		/**
		 * Creates a new GraphQL error instance
		 *
		 * @param message - Custom error message (optional)
		 * @param context - Additional context information (optional)
		 */
		constructor(message = defaultMessage, context?: Record<string, unknown>) {
			const mergedContext = { ...context };

			// Create extensions with error details
			const extensions = {
				code: graphqlCode,
				statusCode,
				context: mergedContext,
				timestamp: new Date().toISOString(),
			};

			super(message, {
				extensions,
			});

			this.statusCode = statusCode;
			this.code = code;
			this.context = mergedContext;
			this.timestamp = new Date();

			// Set the name for better debugging
			this.name = name;
		}

		/**
		 * Serializes the error to a plain object for JSON responses or logging
		 *
		 * @returns A plain object representation of the error
		 */
		public toPlainObject(): Record<string, unknown> {
			return {
				name: this.name,
				message: this.message,
				code: this.code,
				statusCode: this.statusCode,
				graphqlCode: (this.extensions as Record<string, unknown>)['code'],
				context: this.context,
				timestamp: this.timestamp.toISOString(),
				// Include stack trace in development
				...(process.env['NODE_ENV'] !== 'production' ? { stack: this.stack } : {}),
			};
		}

		/**
		 * Creates a new error instance with additional context merged into the existing context
		 *
		 * @param additionalContext - Additional context to merge
		 * @returns A new error instance with the merged context
		 */
		public withContext(additionalContext: Record<string, unknown>): this {
			const mergedContext = { ...this.context, ...additionalContext };
			const Constructor = this.constructor as new (message?: string, context?: Record<string, unknown>) => this;

			return new Constructor(this.message, mergedContext);
		}

		/**
		 * Creates a new error instance with a different message
		 *
		 * @param newMessage - The new error message
		 * @returns A new error instance with the updated message
		 */
		public withMessage(newMessage: string): this {
			const Constructor = this.constructor as new (message?: string, context?: Record<string, unknown>) => this;

			return new Constructor(newMessage, this.context);
		}
	}

	// Set the class name for better debugging
	Object.defineProperty(GeneratedGraphQLError, 'name', {
		value: name,
		writable: false,
	});

	return GeneratedGraphQLError;
}

/**
 * Error configurations for all standard GraphQL error types
 * Extends base HTTP error configs with GraphQL-specific codes
 */
export const GRAPHQL_ERROR_CONFIGS = {
	UNAUTHENTICATED: {
		code: 'UNAUTHORIZED',
		statusCode: 401,
		defaultMessage: 'Authentication required',
		graphqlCode: 'UNAUTHENTICATED',
	},
	FORBIDDEN: {
		code: 'FORBIDDEN',
		statusCode: 403,
		defaultMessage: 'Access forbidden',
		graphqlCode: 'FORBIDDEN',
	},
	NOT_FOUND: {
		code: 'NOT_FOUND',
		statusCode: 404,
		defaultMessage: 'Resource not found',
		graphqlCode: 'NOT_FOUND',
	},
	BAD_USER_INPUT: {
		code: 'BAD_REQUEST',
		statusCode: 400,
		defaultMessage: 'Bad request',
		graphqlCode: 'BAD_USER_INPUT',
	},
	CONFLICT: {
		code: 'CONFLICT',
		statusCode: 409,
		defaultMessage: 'Resource conflict',
		graphqlCode: 'CONFLICT',
	},
	VALIDATION_ERROR: {
		code: 'VALIDATION_ERROR',
		statusCode: 400,
		defaultMessage: 'Validation failed',
		graphqlCode: 'BAD_USER_INPUT',
	},
	INTERNAL_SERVER_ERROR: {
		code: 'INTERNAL_SERVER_ERROR',
		statusCode: 500,
		defaultMessage: 'Internal server error',
		graphqlCode: 'INTERNAL_SERVER_ERROR',
	},
	RATE_LIMIT_EXCEEDED: {
		code: 'RATE_LIMIT_EXCEEDED',
		statusCode: 429,
		defaultMessage: 'Rate limit exceeded',
		graphqlCode: 'RATE_LIMIT_EXCEEDED',
	},
} as const;

/**
 * Type for GraphQL error configuration keys
 */
export type GraphQLErrorType = keyof typeof GRAPHQL_ERROR_CONFIGS;
