import {
	ExceptionFilter,
	Catch,
	ArgumentsHost,
	HttpStatus,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Response, Request } from 'express';
import { BaseApplicationError } from '../errors/base-application-error.js';
import { AppLogger } from '../services/logger.service.js';
import { ErrorSanitizerService } from '../services/error-sanitizer.service.js';
import { ErrorCategorizerService, type ErrorCategory } from '../services/error-categorizer.service.js';
import { LazyModuleRefService } from '../utils/lazy-getter.types.js';

/**
 * Standard error response structure for all exceptions.
 */
export interface ErrorResponseBody {
	success: false;
	error: {
		code: string;
		message: string;
		timestamp: string;
		context?: Record<string, any>;
		stack?: string;
	};
}

/**
 * Development environments where stack traces and full error details are shown
 */
const DEV_ENVIRONMENTS = new Set(['development', 'dev', 'local', 'test']);

/**
 * Global Exception Filter.
 * Catches all unhandled exceptions except HttpException (which is handled by HttpExceptionFilter).
 * Standardizes error responses with consistent structure and logs all errors with categorization.
 *
 * Handles:
 * - BaseApplicationError: Standardized application errors with code, status, context
 * - Error: Generic JavaScript errors
 * - Unknown: Unclassified exceptions
 *
 * Error Response Format:
 * - success: false
 * - error.code: Error code for programmatic handling
 * - error.message: Human-readable error message
 * - error.timestamp: ISO timestamp of error occurrence
 * - error.context: Additional context (development only)
 * - error.stack: Stack trace (development only)
 *
 * @remarks
 * - Automatically redacts sensitive information via ErrorSanitizerService
 * - Categorizes errors for logging (transient vs permanent, retryable, strategy)
 * - Development mode includes full context and stack traces
 * - Production mode shows generic error messages for security
 * - Logs request details: method, URL, IP, user-agent
 *
 * @example
 * ```typescript
 * // Development response
 * {
 *   success: false,
 *   error: {
 *     code: 'USER_NOT_FOUND',
 *     message: 'User with ID 123 not found',
 *     timestamp: '2024-01-01T12:00:00.000Z',
 *     context: { userId: '123' },
 *     stack: '...'
 *   }
 * }
 *
 * // Production response
 * {
 *   success: false,
 *   error: {
 *     code: 'USER_NOT_FOUND',
 *     message: 'User with ID 123 not found',
 *     timestamp: '2024-01-01T12:00:00.000Z'
 *   }
 * }
 * ```
 */
@Catch(BaseApplicationError, Error)
export class GlobalExceptionFilter implements ExceptionFilter, LazyModuleRefService {
	private _logger: AppLogger | undefined;
	private _errorSanitizer: ErrorSanitizerService | undefined;
	private _errorCategorizer: ErrorCategorizerService | undefined;

	constructor(public readonly Module: ModuleRef) {}

	private get Logger(): AppLogger {
		this._logger ??= this.Module.get(AppLogger);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return this._logger!;
	}

	private get ErrorSanitizer(): ErrorSanitizerService {
		this._errorSanitizer ??= this.Module.get(ErrorSanitizerService);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return this._errorSanitizer!;
	}

	private get ErrorCategorizer(): ErrorCategorizerService {
		this._errorCategorizer ??= this.Module.get(ErrorCategorizerService);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return this._errorCategorizer!;
	}

	public catch(exception: unknown, host: ArgumentsHost): void {
		// Handle regular HTTP requests
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();

		const isProduction = !DEV_ENVIRONMENTS.has(process.env['NODE_ENV'] ?? '');
		const isDevelopment = !isProduction;

		let status: number;
		let errorResponse: ErrorResponseBody;
		let errorCategory: ErrorCategory;
		let errorTrace: string | undefined;

		// Standardize error response structure for all exception types
		if (exception instanceof BaseApplicationError) {
			// Standardized application error
			status = exception.statusCode;
			errorResponse = {
				success: false,
				error: {
					code: exception.code,
					message: exception.message,
					timestamp: exception.timestamp.toISOString(),
					...(isDevelopment ? {
						context: exception.context,
						stack: exception.stack,
					} : {}),
				},
			};
			errorCategory = this.ErrorCategorizer.categorizeError(exception);
			errorTrace = isDevelopment ? exception.stack : undefined;
		} else if (exception instanceof Error) {
			// Generic Error
			status = HttpStatus.INTERNAL_SERVER_ERROR;
			errorResponse = {
				success: false,
				error: {
					code: 'INTERNAL_SERVER_ERROR',
					message: isDevelopment ? exception.message : 'An unexpected error occurred',
					timestamp: new Date().toISOString(),
					...(isDevelopment ? { stack: exception.stack } : {}),
				},
			};
			errorCategory = this.ErrorCategorizer.categorizeError(exception);
			errorTrace = isDevelopment ? exception.stack : undefined;
		} else {
			// Unknown exception type
			status = HttpStatus.INTERNAL_SERVER_ERROR;
			errorResponse = {
				success: false,
				error: {
					code: 'UNKNOWN_ERROR',
					message: isDevelopment ? String(exception) : 'An unexpected error occurred',
					timestamp: new Date().toISOString(),
				},
			};
			errorCategory = {
				type: 'permanent',
				retryable: false,
				strategy: 'fail',
			};
		}

		// Log the error with categorization
		this.Logger.error('Global exception caught', errorTrace, undefined, {
			message: errorResponse.error.message,
			status,
			errorType: errorCategory.type,
			retryable: errorCategory.retryable,
			strategy: errorCategory.strategy,
			backoffMs: errorCategory.backoffMs,
			url: request.url,
			method: request.method,
			userAgent: request.get('User-Agent'),
			ip: request.ip,
		});

		// Sanitize error response for production
		// Pass the nested error object (which has .message, .stack, .context) to the sanitizer,
		// then reconstruct the full response envelope with the sanitized inner object.
		const sanitizedInner = this.ErrorSanitizer.sanitizeErrorResponse(
			{
				message: errorResponse.error.message,
				statusCode: status,
				stack: errorResponse.error.stack,
				context: errorResponse.error.context,
			},
			isDevelopment,
		);
		const sanitizedError: ErrorResponseBody = {
			success: false,
			error: {
				code: errorResponse.error.code,
				message: sanitizedInner.message as string,
				timestamp: errorResponse.error.timestamp,
				...(isDevelopment && sanitizedInner.context ? { context: sanitizedInner.context as Record<string, any> } : {}),
				...(isDevelopment && sanitizedInner.stack ? { stack: sanitizedInner.stack as string } : {}),
			},
		};

		response.status(status).json(sanitizedError);
	}
}
