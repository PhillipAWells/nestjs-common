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
import { ErrorCategorizerService, type IErrorCategory } from '../services/error-categorizer.service.js';
import { ILazyModuleRefService } from '../utils/lazy-getter.types.js';

/**
 * Standard error response structure for all exceptions.
 */
export interface IErrorResponseBody {
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
 *     message: 'IUser with ID 123 not found',
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
 *     message: 'IUser with ID 123 not found',
 *     timestamp: '2024-01-01T12:00:00.000Z'
 *   }
 * }
 * ```
 */
@Catch(BaseApplicationError, Error)
export class GlobalExceptionFilter implements ExceptionFilter, ILazyModuleRefService {
	private _Logger: AppLogger | undefined;
	private _ErrorSanitizer: ErrorSanitizerService | undefined;
	private _ErrorCategorizer: ErrorCategorizerService | undefined;
	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	private get Logger(): AppLogger {
		this._Logger ??= this.Module.get<AppLogger>(AppLogger);
		return this._Logger;
	}

	private get ErrorSanitizer(): ErrorSanitizerService {
		this._ErrorSanitizer ??= this.Module.get<ErrorSanitizerService>(ErrorSanitizerService);
		return this._ErrorSanitizer;
	}

	private get ErrorCategorizer(): ErrorCategorizerService {
		this._ErrorCategorizer ??= this.Module.get<ErrorCategorizerService>(ErrorCategorizerService);
		return this._ErrorCategorizer;
	}

	public catch(exception: unknown, host: ArgumentsHost): void {
		// Handle regular HTTP requests
		const Ctx = host.switchToHttp();
		const Response = Ctx.getResponse<Response>();
		const Request = Ctx.getRequest<Request>();

		const IsProduction = !DEV_ENVIRONMENTS.has(process.env['NODE_ENV'] ?? '');
		const IsDevelopment = !IsProduction;

		let Status: number;
		let ErrorResponse: IErrorResponseBody;
		let ErrorCategory: IErrorCategory;
		let ErrorTrace: string | undefined;

		// Standardize error response structure for all exception types
		if (exception instanceof BaseApplicationError) {
			// Standardized application error
			Status = exception.StatusCode;
			ErrorResponse = {
				success: false,
				error: {
					code: exception.Code,
					message: exception.message,
					timestamp: exception.Timestamp.toISOString(),
					...(IsDevelopment ? {
						context: exception.Context,
						stack: exception.stack,
					} : {}),
				},
			};
			ErrorCategory = this.ErrorCategorizer.CategorizeError(exception);
			ErrorTrace = IsDevelopment ? exception.stack : undefined;
		} else if (exception instanceof Error) {
			// Generic Error
			Status = HttpStatus.INTERNAL_SERVER_ERROR;
			ErrorResponse = {
				success: false,
				error: {
					code: 'INTERNAL_SERVER_ERROR',
					message: IsDevelopment ? exception.message : 'An unexpected error occurred',
					timestamp: new Date().toISOString(),
					...(IsDevelopment ? { stack: exception.stack } : {}),
				},
			};
			ErrorCategory = this.ErrorCategorizer.CategorizeError(exception);
			ErrorTrace = IsDevelopment ? exception.stack : undefined;
		} else {
			// Unknown exception type
			Status = HttpStatus.INTERNAL_SERVER_ERROR;
			ErrorResponse = {
				success: false,
				error: {
					code: 'UNKNOWN_ERROR',
					message: IsDevelopment ? String(exception) : 'An unexpected error occurred',
					timestamp: new Date().toISOString(),
				},
			};
			ErrorCategory = {
				type: 'permanent',
				retryable: false,
				strategy: 'fail',
			};
		}

		// Log the error with categorization
		this.Logger.error('Global exception caught', ErrorTrace, undefined, {
			message: ErrorResponse.error.message,
			status: Status,
			errorType: ErrorCategory.type,
			retryable: ErrorCategory.retryable,
			strategy: ErrorCategory.strategy,
			backoffMs: ErrorCategory.backoffMs,
			url: Request.url,
			method: Request.method,
			userAgent: Request.get('User-Agent'),
			ip: Request.ip,
		});

		// Sanitize error response for production
		// Pass the nested error object (which has .message, .stack, .context) to the sanitizer,
		// then reconstruct the full response envelope with the sanitized inner object.
		const SanitizedInner = this.ErrorSanitizer.SanitizeErrorResponse(
			{
				message: ErrorResponse.error.message,
				statusCode: Status,
				stack: ErrorResponse.error.stack,
				context: ErrorResponse.error.context,
			},
			IsDevelopment,
		);
		const SanitizedError: IErrorResponseBody = {
			success: false,
			error: {
				code: ErrorResponse.error.code,
				message: SanitizedInner.message as string,
				timestamp: ErrorResponse.error.timestamp,
				...(IsDevelopment && SanitizedInner.context ? { context: SanitizedInner.context as Record<string, any> } : {}),
				...(IsDevelopment && SanitizedInner.stack ? { stack: SanitizedInner.stack as string } : {}),
			},
		};

		Response.status(Status).json(SanitizedError);
	}
}
