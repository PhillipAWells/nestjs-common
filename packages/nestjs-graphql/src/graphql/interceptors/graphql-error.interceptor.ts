import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, catchError, throwError } from 'rxjs';
import { GraphQLError } from 'graphql';
import { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_FORBIDDEN, HTTP_STATUS_NOT_FOUND, HTTP_STATUS_INTERNAL_SERVER_ERROR } from '@pawells/nestjs-shared/common';

/**
 * GraphQL Error Interceptor
 *
 * Catches and formats errors from GraphQL operations.
 * Adds error codes, context information, and proper error logging.
 *
 * @example
 * ```typescript
 * @UseInterceptors(GraphQLErrorInterceptor)
 * @Query(() => User)
 * async getUser(): Promise<User> {
 *   // Errors from this resolver will be properly formatted
 * }
 * ```
 */
@Injectable()
export class GraphQLErrorInterceptor implements NestInterceptor {
	private readonly logger = new Logger(GraphQLErrorInterceptor.name);

	/**
	 * Intercepts GraphQL operations for error handling
	 *
	 * @param context - The execution context
	 * @param next - The call handler
	 * @returns Observable - The intercepted operation
	 */
	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		// Extract GraphQL context
		const gqlContext = GqlExecutionContext.create(context);
		const info = gqlContext.getInfo();

		// Extract operation details for error context
		const operationName = info?.operation?.name?.value ?? 'Anonymous';
		const operationType = info?.operation?.operation ?? 'unknown';
		const fieldName = info?.fieldName ?? 'unknown';

		return next.handle().pipe(
			catchError((error) => {
				// Log the error with context
				this.logger.error(
					`GraphQL ${operationType} error in ${operationName}.${fieldName}: ${error instanceof Error ? error.message : String(error)}`
				);

				// Format the error for GraphQL response
				const formattedError = this.formatError(error, operationType, operationName, fieldName);

				// Re-throw as GraphQLError
				return throwError(() => formattedError);
			})
		);
	}

	/**
	 * Formats errors for GraphQL responses
	 *
	 * @param error - The original error
	 * @param operationType - The GraphQL operation type
	 * @param operationName - The operation name
	 * @param fieldName - The field name
	 * @returns GraphQLError - The formatted GraphQL error
	 */
	private formatError(
		error: any,
		operationType: string,
		operationName: string,
		fieldName: string
	): GraphQLError {
		// If it's already a GraphQLError, return it
		if (error instanceof GraphQLError) {
			return error;
		}

		// Determine error code and message
		const { code, message, statusCode } = this.categorizeError(error);

		// Create extensions with additional context
		const extensions = {
			code,
			statusCode,
			operation: {
				type: operationType,
				name: operationName,
				field: fieldName
			},
			timestamp: new Date().toISOString(),
			// Include stack trace in development
			...(process.env['NODE_ENV'] !== 'production' && error instanceof Error
				? { stacktrace: error.stack }
				: {})
		};

		// Create new GraphQLError with formatted message
		return new GraphQLError(message, {
			extensions,
			originalError: error
		});
	}

	/**
	 * Categorizes errors and determines appropriate codes and messages
	 *
	 * @param error - The original error
	 * @returns object - Error categorization result
	 */
	private categorizeError(error: any): { code: string; message: string; statusCode: number } {
		// MongoDB duplicate key error code
		const MONGODB_DUPLICATE_KEY_ERROR = 11_000;
		// HTTP status for conflict
		const HTTP_STATUS_CONFLICT = 409;

		// Handle specific error types
		if (error.name === 'ValidationError' || error.message?.includes('validation')) {
			return {
				code: 'VALIDATION_ERROR',
				message: 'Input validation failed',
				statusCode: HTTP_STATUS_BAD_REQUEST
			};
		}

		if (error.name === 'CastError' || error.message?.includes('cast')) {
			return {
				code: 'VALIDATION_ERROR',
				message: 'Invalid input format',
				statusCode: HTTP_STATUS_BAD_REQUEST
			};
		}

		if (error.name === 'UnauthorizedError' || error.status === HTTP_STATUS_UNAUTHORIZED) {
			return {
				code: 'AUTHENTICATION_REQUIRED',
				message: 'Authentication required',
				statusCode: HTTP_STATUS_UNAUTHORIZED
			};
		}

		if (error.name === 'ForbiddenError' || error.status === HTTP_STATUS_FORBIDDEN) {
			return {
				code: 'AUTHORIZATION_FAILED',
				message: 'Access denied',
				statusCode: HTTP_STATUS_FORBIDDEN
			};
		}

		if (error.status === HTTP_STATUS_NOT_FOUND || error.message?.includes('not found')) {
			return {
				code: 'NOT_FOUND',
				message: 'Resource not found',
				statusCode: HTTP_STATUS_NOT_FOUND
			};
		}

		if (error.code === MONGODB_DUPLICATE_KEY_ERROR || error.message?.includes('duplicate')) {
			return {
				code: 'CONFLICT',
				message: 'Resource already exists',
				statusCode: HTTP_STATUS_CONFLICT
			};
		}

		// Default to internal server error
		return {
			code: 'INTERNAL_SERVER_ERROR',
			message: process.env['NODE_ENV'] === 'production'
				? 'An unexpected error occurred'
				: (error instanceof Error ? error.message : 'An unexpected error occurred'),
			statusCode: HTTP_STATUS_INTERNAL_SERVER_ERROR
		};
	}
}
