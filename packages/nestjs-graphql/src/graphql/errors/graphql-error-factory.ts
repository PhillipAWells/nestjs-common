import { GraphQLError } from 'graphql';

/**
 * Base configuration interface for error classes
 */
interface IErrorConfig {
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
 * Extends the base IErrorConfig with GraphQL-specific properties
 */
export interface IGraphQLErrorConfig extends IErrorConfig {
	/** The GraphQL error code used in extensions */
	graphqlCode: string;
}

/**
 * Interface describing a generated GraphQL error instance
 */
export interface IGeneratedGraphQLErrorInstance extends GraphQLError {
	readonly StatusCode: number;
	readonly Code: string;
	readonly Context: Record<string, unknown>;
	readonly Timestamp: Date;
	toPlainObject(): Record<string, unknown>;
	withContext(additionalContext: Record<string, unknown>): this;
	withMessage(newMessage: string): this;
}

/**
 * Type describing the constructor returned by createGraphQLError
 */
export type TGeneratedGraphQLErrorConstructor = new (
	message?: string,
	context?: Record<string, unknown>,
) => IGeneratedGraphQLErrorInstance;

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
export function CreateGraphQLError(config: IGraphQLErrorConfig): TGeneratedGraphQLErrorConstructor {
	const { code, statusCode, defaultMessage, name = `${code}Error`, graphqlCode } = config;

	/**
	 * Dynamically created GraphQL error class
	 * Extends GraphQLError for GraphQL-specific formatting while inheriting from BaseApplicationError
	 */
	class GeneratedGraphQLError extends GraphQLError {
		public readonly StatusCode: number;

		public readonly Code: string;

		public readonly Context: Record<string, unknown>;

		public readonly Timestamp: Date;

		/**
		 * Creates a new GraphQL error instance
		 *
		 * @param message - Custom error message (optional)
		 * @param context - Additional context information (optional)
		 */
		constructor(message = defaultMessage, context?: Record<string, unknown>) {
			const MergedContext = { ...context };

			// Create extensions with error details
			const Extensions = {
				code: graphqlCode,
				statusCode,
				context: MergedContext,
				timestamp: new Date().toISOString(),
			};

			super(message, {
				extensions: Extensions,
			});

			this.StatusCode = statusCode;
			this.Code = code;
			this.Context = MergedContext;
			this.Timestamp = new Date();

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
				code: this.Code,
				statusCode: this.StatusCode,
				graphqlCode: (this.extensions as Record<string, unknown>)['code'],
				context: this.Context,
				timestamp: this.Timestamp.toISOString(),
			};
		}

		/**
		 * Creates a new error instance with additional context merged into the existing context
		 *
		 * @param additionalContext - Additional context to merge
		 * @returns A new error instance with the merged context
		 */
		public withContext(additionalContext: Record<string, unknown>): this {
			const MergedContext = { ...this.Context, ...additionalContext };
			const Constructor = this.constructor as new (message?: string, context?: Record<string, unknown>) => this;

			return new Constructor(this.message, MergedContext);
		}

		/**
		 * Creates a new error instance with a different message
		 *
		 * @param newMessage - The new error message
		 * @returns A new error instance with the updated message
		 */
		public withMessage(newMessage: string): this {
			const Constructor = this.constructor as new (message?: string, context?: Record<string, unknown>) => this;

			return new Constructor(newMessage, this.Context);
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
export type TGraphQLErrorType = keyof typeof GRAPHQL_ERROR_CONFIGS;
