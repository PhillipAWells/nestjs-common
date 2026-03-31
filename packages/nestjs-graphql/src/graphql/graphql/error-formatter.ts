import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { GraphQLErrorCode } from './error-codes.js';

/**
 * GraphQL Error Formatter
 *
 * Formats GraphQL errors for consistent client responses.
 * Removes sensitive internal information and provides user-friendly messages.
 */
export class GraphQLErrorFormatter {
	private static readonly Logger: AppLogger = new AppLogger(undefined, GraphQLErrorFormatter.name);

	/**
	 * Formats a GraphQL error for client response
	 *
	 * @param error - The original GraphQL error
	 * @param context - Optional request context with user and operation information
	 * @returns Formatted error object
	 */
	public static FormatError(error: GraphQLError, context?: any): GraphQLFormattedError {
		const { originalError } = error;

		// Handle custom application errors
		if (originalError && this.IsApplicationError(originalError)) {
			return this.FormatApplicationError(error, originalError, context);
		}

		// Handle validation errors
		if (originalError && this.IsValidationError(originalError)) {
			return this.FormatValidationError(error, originalError, context);
		}

		// Handle authentication errors
		if (originalError && this.IsAuthenticationError(originalError)) {
			return this.FormatAuthenticationError(error, context);
		}

		// Handle authorization errors
		if (originalError && this.IsAuthorizationError(originalError)) {
			return this.FormatAuthorizationError(error, context);
		}

		// Handle rate limiting errors
		if (originalError && this.IsRateLimitError(originalError)) {
			return this.FormatRateLimitError(error, context);
		}

		// Default error formatting
		return this.FormatGenericError(error, context);
	}

	/**
	 * Checks if error is an application-specific error
	 */
	private static IsApplicationError(error: any): boolean {
		return error.code && Object.values(GraphQLErrorCode).includes(error.code);
	}

	/**
	 * Checks if error is a validation error
	 */
	private static IsValidationError(error: any): boolean {
		return error.name === 'IValidationError' ||
			   Boolean(error.message?.includes('validation')) ||
			   Boolean(error.errors);
	}

	/**
	 * Checks if error is an authentication error
	 */
	private static IsAuthenticationError(error: any): boolean {
		return error.name === 'UnauthorizedException' ||
			   Boolean(error.message?.includes('authentication')) ||
			   Boolean(error.message?.includes('token'));
	}

	/**
	 * Checks if error is an authorization error
	 */
	private static IsAuthorizationError(error: any): boolean {
		return error.name === 'ForbiddenException' ||
			   Boolean(error.message?.includes('permission')) ||
			   Boolean(error.message?.includes('forbidden'));
	}

	/**
	 * Checks if error is a rate limit error
	 */
	private static IsRateLimitError(error: any): boolean {
		return error.name === 'RateLimitException' ||
			   Boolean(error.message?.includes('rate limit')) ||
			   Boolean(error.message?.includes('too many requests'));
	}

	/**
	 * Formats application-specific errors
	 */
	private static FormatApplicationError(_error: GraphQLError, originalError: any, context?: any): GraphQLFormattedError {
		this.Logger.warn(`Application error: ${originalError.message}`, originalError.stack);

		return {
			message: originalError.message ?? 'An error occurred',
			extensions: {
				code: originalError.code ?? GraphQLErrorCode.INTERNAL_ERROR,
				timestamp: new Date().toISOString(),
				...(originalError.details && { details: originalError.details }),
				...(context?.operationName && { operationName: context.operationName }),
			},
		};
	}

	/**
	 * Formats validation errors
	 */
	private static FormatValidationError(_error: GraphQLError, originalError: any, context?: any): GraphQLFormattedError {
		const ValidationErrors = this.ExtractValidationErrors(originalError);

		return {
			message: 'Validation failed',
			extensions: {
				code: GraphQLErrorCode.BAD_USER_INPUT,
				timestamp: new Date().toISOString(),
				validationErrors: ValidationErrors,
				...(context?.operationName && { operationName: context.operationName }),
			},
		};
	}

	/**
	 * Formats authentication errors
	 */
	private static FormatAuthenticationError(_error: GraphQLError, context?: any): GraphQLFormattedError {
		return {
			message: 'Authentication required',
			extensions: {
				code: GraphQLErrorCode.UNAUTHENTICATED,
				timestamp: new Date().toISOString(),
				...(context?.operationName && { operationName: context.operationName }),
			},
		};
	}

	/**
	 * Formats authorization errors
	 */
	private static FormatAuthorizationError(_error: GraphQLError, context?: any): GraphQLFormattedError {
		return {
			message: 'Access denied',
			extensions: {
				code: GraphQLErrorCode.FORBIDDEN,
				timestamp: new Date().toISOString(),
				...(context?.operationName && { operationName: context.operationName }),
			},
		};
	}

	/**
	 * Formats rate limit errors
	 */
	private static FormatRateLimitError(_error: GraphQLError, context?: any): GraphQLFormattedError {
		return {
			message: 'Rate limit exceeded',
			extensions: {
				code: GraphQLErrorCode.RATE_LIMIT_EXCEEDED,
				timestamp: new Date().toISOString(),
				...(context?.operationName && { operationName: context.operationName }),
			},
		};
	}

	/**
	 * Formats generic/unexpected errors
	 */
	private static FormatGenericError(error: GraphQLError, context?: any): GraphQLFormattedError {
		// Log internal errors for debugging
		this.Logger.error(`GraphQL Error: ${error.message}`, error.stack);

		const OriginalError = error.originalError as any;
		const StatusCode = OriginalError?.getStatus?.() ?? OriginalError?.status ?? OriginalError?.statusCode;

		// Don't expose internal error details to client
		return {
			message: 'An unexpected error occurred',
			extensions: {
				code: GraphQLErrorCode.INTERNAL_ERROR,
				timestamp: new Date().toISOString(),
				...(StatusCode !== undefined && { statusCode: StatusCode }),
				...(context?.user?.id && { userId: context.user.id }),
				...(context?.operationName && { operationName: context.operationName }),
			},
		};
	}

	/**
	 * Extracts validation errors from various formats
	 */
	private static ExtractValidationErrors(error: any): any[] {
		if (error.errors) {
			// Class-validator errors
			return Object.values(error.errors).map((fieldErrors: any) => ({
				field: fieldErrors.property,
				constraints: fieldErrors.constraints,
			}));
		}

		if (Array.isArray(error)) {
			return error;
		}

		return [{
			message: error.message ?? 'Validation failed',
		}];
	}
}
