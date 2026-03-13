import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { Logger } from '@nestjs/common';
import { GraphQLErrorCode } from './error-codes.js';

/**
 * GraphQL Error Formatter
 *
 * Formats GraphQL errors for consistent client responses.
 * Removes sensitive internal information and provides user-friendly messages.
 */
export class GraphQLErrorFormatter {
	private static readonly logger = new Logger(GraphQLErrorFormatter.name);

	/**
	 * Formats a GraphQL error for client response
	 *
	 * @param error - The original GraphQL error
	 * @param context - Optional request context with user and operation information
	 * @returns Formatted error object
	 */
	public static formatError(error: GraphQLError, context?: any): GraphQLFormattedError {
		const { originalError } = error;

		// Handle custom application errors
		if (originalError && this.isApplicationError(originalError)) {
			return this.formatApplicationError(error, originalError, context);
		}

		// Handle validation errors
		if (originalError && this.isValidationError(originalError)) {
			return this.formatValidationError(error, originalError, context);
		}

		// Handle authentication errors
		if (originalError && this.isAuthenticationError(originalError)) {
			return this.formatAuthenticationError(error, context);
		}

		// Handle authorization errors
		if (originalError && this.isAuthorizationError(originalError)) {
			return this.formatAuthorizationError(error, context);
		}

		// Handle rate limiting errors
		if (originalError && this.isRateLimitError(originalError)) {
			return this.formatRateLimitError(error, context);
		}

		// Default error formatting
		return this.formatGenericError(error, context);
	}

	/**
	 * Checks if error is an application-specific error
	 */
	private static isApplicationError(error: any): boolean {
		return error.code && Object.values(GraphQLErrorCode).includes(error.code);
	}

	/**
	 * Checks if error is a validation error
	 */
	private static isValidationError(error: any): boolean {
		return error.name === 'ValidationError' ||
			   Boolean(error.message?.includes('validation')) ||
			   Boolean(error.errors);
	}

	/**
	 * Checks if error is an authentication error
	 */
	private static isAuthenticationError(error: any): boolean {
		return error.name === 'UnauthorizedException' ||
			   Boolean(error.message?.includes('authentication')) ||
			   Boolean(error.message?.includes('token'));
	}

	/**
	 * Checks if error is an authorization error
	 */
	private static isAuthorizationError(error: any): boolean {
		return error.name === 'ForbiddenException' ||
			   Boolean(error.message?.includes('permission')) ||
			   Boolean(error.message?.includes('forbidden'));
	}

	/**
	 * Checks if error is a rate limit error
	 */
	private static isRateLimitError(error: any): boolean {
		return error.name === 'RateLimitException' ||
			   Boolean(error.message?.includes('rate limit')) ||
			   Boolean(error.message?.includes('too many requests'));
	}

	/**
	 * Formats application-specific errors
	 */
	private static formatApplicationError(_error: GraphQLError, originalError: any, context?: any): GraphQLFormattedError {
		this.logger.warn(`Application error: ${originalError.message}`, originalError.stack);

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
	private static formatValidationError(_error: GraphQLError, originalError: any, context?: any): GraphQLFormattedError {
		const validationErrors = this.extractValidationErrors(originalError);

		return {
			message: 'Validation failed',
			extensions: {
				code: GraphQLErrorCode.BAD_USER_INPUT,
				timestamp: new Date().toISOString(),
				validationErrors,
				...(context?.operationName && { operationName: context.operationName }),
			},
		};
	}

	/**
	 * Formats authentication errors
	 */
	private static formatAuthenticationError(_error: GraphQLError, context?: any): GraphQLFormattedError {
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
	private static formatAuthorizationError(_error: GraphQLError, context?: any): GraphQLFormattedError {
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
	private static formatRateLimitError(_error: GraphQLError, context?: any): GraphQLFormattedError {
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
	private static formatGenericError(error: GraphQLError, context?: any): GraphQLFormattedError {
		// Log internal errors for debugging
		this.logger.error(`GraphQL Error: ${error.message}`, error.stack);

		const originalError = error.originalError as any;
		const statusCode = originalError?.getStatus?.() ?? originalError?.status ?? originalError?.statusCode;

		// Don't expose internal error details to client
		return {
			message: 'An unexpected error occurred',
			extensions: {
				code: GraphQLErrorCode.INTERNAL_ERROR,
				timestamp: new Date().toISOString(),
				...(statusCode !== undefined && { statusCode }),
				...(context?.user?.id && { userId: context.user.id }),
				...(context?.operationName && { operationName: context.operationName }),
			},
		};
	}

	/**
	 * Extracts validation errors from various formats
	 */
	private static extractValidationErrors(error: any): any[] {
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
