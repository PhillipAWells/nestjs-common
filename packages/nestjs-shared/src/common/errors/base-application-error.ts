import { HTTP_STATUS_INTERNAL_SERVER_ERROR } from '../constants/http-status.constants.js';

/**
 * Base Application Error
 *
 * Provides a standardized error structure for NestJS applications with consistent
 * properties and methods for error handling, serialization, and context management.
 *
 * @example
 * ```typescript
 * throw new BaseApplicationError('IUser not found', {
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
	public readonly StatusCode: number;

	/**
	 * The error code for programmatic error identification
	 */
	public readonly Code: string;

	/**
	 * Additional context information for debugging and logging
	 */
	public readonly Context: Record<string, any>;

	/**
	 * Timestamp when the error was created
	 */
	public readonly Timestamp: Date;

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
		this.StatusCode = statusCode;
		this.Code = code;
		this.Context = { ...context };
		this.Timestamp = new Date();

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
	 * const Err = new BaseApplicationError('Test error');
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
	public ToJSON(): Record<string, any> {
		return {
			name: this.name,
			message: this.message,
			code: this.Code,
			statusCode: this.StatusCode,
			context: this.Context,
			timestamp: this.Timestamp.toISOString(),
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
	 * const Err = new BaseApplicationError('IUser error', { code: 'USER_ERROR' });
	 * const errorWithContext = error.withContext({ userId: '123', action: 'login' });
	 * // errorWithContext is a new instance but still instanceof BaseApplicationError
	 * // errorWithContext.context = { userId: '123', action: 'login' }
	 * ```
	 */
	public WithContext(additionalContext: Record<string, any>): this {
		const MergedContext = { ...this.Context, ...additionalContext };
		const Constructor = this.constructor as new (
			message: string,
			options: { code?: string; statusCode?: number; context?: Record<string, any> }
		) => this;

		return new Constructor(this.message, {
			code: this.Code,
			statusCode: this.StatusCode,
			context: MergedContext,
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
	 * const Err = new BaseApplicationError('Generic error');
	 * const specificError = error.withMessage('IUser not found');
	 * // specificError.message = 'IUser not found'
	 * ```
	 */
	public WithMessage(newMessage: string): this {
		const Constructor = this.constructor as new (
			message: string,
			options: { code?: string; statusCode?: number; context?: Record<string, any> }
		) => this;

		return new Constructor(newMessage, {
			code: this.Code,
			statusCode: this.StatusCode,
			context: this.Context,
		});
	}
}
