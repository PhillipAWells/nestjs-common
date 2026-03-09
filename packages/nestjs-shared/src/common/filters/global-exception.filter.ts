import {
	ExceptionFilter,
	Catch,
	ArgumentsHost,
	HttpStatus,
	Inject,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { BaseApplicationError } from '../errors/base-application-error.js';
import { AppLogger } from '../services/logger.service.js';
import { ErrorSanitizerService } from '../services/error-sanitizer.service.js';
import { ErrorCategorizerService, type ErrorCategory } from '../services/error-categorizer.service.js';

/**
 * Global Exception Filter
 * Catches all unhandled exceptions except HttpException (which is handled by HttpExceptionFilter)
 * Standardizes error responses and logs errors with categorization
 */
/**
 * Standard error response structure for all exceptions
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

@Catch(BaseApplicationError, Error)
export class GlobalExceptionFilter implements ExceptionFilter {
	constructor(
		@Inject(AppLogger) private readonly logger: AppLogger,
		private readonly errorSanitizer: ErrorSanitizerService,
		private readonly errorCategorizer: ErrorCategorizerService,
	) {}

	public catch(exception: unknown, host: ArgumentsHost): void {
		// Handle regular HTTP requests
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();

		const DEV_ENVIRONMENTS = new Set(['development', 'dev', 'local', 'test']);
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
			errorCategory = this.errorCategorizer.categorizeError(exception);
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
			errorCategory = this.errorCategorizer.categorizeError(exception);
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
		this.logger.error('Global exception caught', errorTrace, undefined, {
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
		const sanitizedError = this.errorSanitizer.sanitizeErrorResponse(errorResponse, isDevelopment);

		response.status(status).json(sanitizedError);
	}
}
