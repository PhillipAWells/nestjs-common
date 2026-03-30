import { GraphQLError } from 'graphql';
import { HTTP_STATUS_INTERNAL_SERVER_ERROR } from '@pawells/nestjs-shared/common';

/**
 * Base GraphQL Error Class
 *
 * Extends GraphQLError to provide structured error handling for GraphQL operations.
 * Includes error codes, context information, and proper formatting.
 *
 * @example
 * ```typescript
 * throw new GraphqlError('IUser not found', {
 *   code: 'NOT_FOUND',
 *   statusCode: 404,
 *   context: { userId: '123' }
 * });
 * ```
 */
export class GraphqlError extends GraphQLError {
	/**
	 * Creates a new GraphQL error
	 *
	 * @param message - The error message
	 * @param options - Additional error options
	 */
	constructor(
		message: string,
		options: {
			code?: string;
			statusCode?: number;
			context: Record<string, any> | undefined;
			originalError?: Error;
		} = {
			context: undefined,
		},
	) {
		const { code = 'INTERNAL_SERVER_ERROR', statusCode = HTTP_STATUS_INTERNAL_SERVER_ERROR, context, originalError } = options;

		// Create extensions with error details
		const extensions = {
			code,
			statusCode,
			context: context ?? {},
			timestamp: new Date().toISOString(),
			// Include stack trace in development
			...(process.env['NODE_ENV'] !== 'production' && originalError?.stack
				? { stacktrace: originalError.stack }
				: {}),
		};

		super(message, {
			extensions,
			originalError,
		});
	}

	/**
	 * Gets the error code
	 *
	 * @returns string - The error code
	 */
	public get code(): string {
		return (this.extensions as any)?.code ?? 'INTERNAL_SERVER_ERROR';
	}

	/**
	 * Gets the HTTP status code
	 *
	 * @returns number - The HTTP status code
	 */
	public get statusCode(): number {
		return (this.extensions as any)?.statusCode ?? HTTP_STATUS_INTERNAL_SERVER_ERROR;
	}

	/**
	 * Gets the error context
	 *
	 * @returns Record<string, any> - The error context
	 */
	public get context(): Record<string, any> {
		return (this.extensions as any)?.context ?? {};
	}
}
