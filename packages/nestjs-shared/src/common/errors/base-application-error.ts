import { HTTP_STATUS_INTERNAL_SERVER_ERROR } from '../constants/http-status.constants.js';

/**
 * Base Application Error
 *
 * Provides a standardized error structure for NestJS applications with consistent
 * properties and methods for error handling, serialization, and context management.
 *
 * @example
 * ```typescript
 * throw new BaseApplicationError('User not found', {
 *   code: 'USER_NOT_FOUND',
 *   statusCode: 404,
 *   context: { userId: '123' }
 * });
 * ```
 */
export class BaseApplicationError extends Error {
	/**
	 * The HTTP status code associated with this error
	 */
	public readonly statusCode: number;

	/**
	 * The error code for programmatic error identification
	 */
	public readonly code: string;

	/**
	 * Additional context information for debugging and logging
	 */
	public readonly context: Record<string, any>;

	/**
	 * Timestamp when the error was created
	 */
	public readonly timestamp: Date;

	/**
	 * Creates a new BaseApplicationError instance
	 *
	 * @param message - The error message
	 * @param options - Configuration options for the error
	 * @param options.code - The error code (defaults to 'INTERNAL_SERVER_ERROR')
	 * @param options.statusCode - The HTTP status code (defaults to 500)
	 * @param options.context - Additional context information (defaults to empty object)
	 */
	constructor(
		message: string,
		options: {
			code?: string;
			statusCode?: number;
			context?: Record<string, any>;
		} = {},
	) {
		super(message);

		const { code = 'INTERNAL_SERVER_ERROR', statusCode = HTTP_STATUS_INTERNAL_SERVER_ERROR, context = {} } = options;

		this.name = this.constructor.name;
		this.statusCode = statusCode;
		this.code = code;
		this.context = { ...context };
		this.timestamp = new Date();

		// Capture stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	/**
	 * Serializes the error to a plain object for JSON responses or logging
	 *
	 * @returns A plain object representation of the error
	 *
	 * @example
	 * ```typescript
	 * const error = new BaseApplicationError('Test error');
	 * console.log(error.toJSON());
	 * // {
	 * //   name: 'BaseApplicationError',
	 * //   message: 'Test error',
	 * //   code: 'INTERNAL_SERVER_ERROR',
	 * //   statusCode: 500,
	 * //   context: {},
	 * //   timestamp: '2023-01-01T00:00:00.000Z'
	 * // }
	 * ```
	 */
	public toJSON(): Record<string, any> {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			statusCode: this.statusCode,
			context: this.context,
			timestamp: this.timestamp.toISOString(),
			// Include stack trace in development
			...(process.env['NODE_ENV'] !== 'production' ? { stack: this.stack } : {}),
		};
	}

	/**
	 * Creates a new error instance with additional context merged into the existing context.
	 * Note: Returns a new instance, not the same instance, so instanceof checks will still work.
	 *
	 * @param additionalContext - Additional context to merge
	 * @returns A new error instance of the same type with merged context
	 *
	 * @example
	 * ```typescript
	 * const error = new BaseApplicationError('User error', { code: 'USER_ERROR' });
	 * const errorWithContext = error.withContext({ userId: '123', action: 'login' });
	 * // errorWithContext is a new instance but still instanceof BaseApplicationError
	 * // errorWithContext.context = { userId: '123', action: 'login' }
	 * ```
	 */
	public withContext(additionalContext: Record<string, any>): this {
		const mergedContext = { ...this.context, ...additionalContext };
		const Constructor = this.constructor as new (
			message: string,
			options: { code?: string; statusCode?: number; context?: Record<string, any> }
		) => this;

		return new Constructor(this.message, {
			code: this.code,
			statusCode: this.statusCode,
			context: mergedContext,
		});
	}

	/**
	 * Creates a new error instance with a different message
	 *
	 * @param newMessage - The new error message
	 * @returns A new error instance with the updated message
	 *
	 * @example
	 * ```typescript
	 * const error = new BaseApplicationError('Generic error');
	 * const specificError = error.withMessage('User not found');
	 * // specificError.message = 'User not found'
	 * ```
	 */
	public withMessage(newMessage: string): this {
		const Constructor = this.constructor as new (
			message: string,
			options: { code?: string; statusCode?: number; context?: Record<string, any> }
		) => this;

		return new Constructor(newMessage, {
			code: this.code,
			statusCode: this.statusCode,
			context: this.context,
		});
	}
}
