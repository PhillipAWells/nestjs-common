import {
	ExceptionFilter,
	Catch,
	ArgumentsHost,
	HttpException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Response } from 'express';
import { AppLogger } from '../services/logger.service.js';
import { ErrorSanitizerService } from '../services/error-sanitizer.service.js';
import { ErrorCategorizerService } from '../services/error-categorizer.service.js';
import { ILazyModuleRefService } from '../utils/lazy-getter.types.js';

/**
 * Development environments where stack traces and full error details are shown
 */
const DEV_ENVIRONMENTS = new Set(['development', 'dev', 'local', 'test']);

/**
 * HTTP Exception Filter.
 * Handles all HTTP exceptions (400, 401, 403, 404, etc.) and formats error responses consistently.
 * Complements GlobalExceptionFilter by handling NestJS built-in and thrown HTTP exceptions.
 *
 * Error Response Format:
 * - Preserves original HTTP status code and response body
 * - Sanitizes sensitive information before sending to client
 * - Categorizes error for logging (transient vs permanent)
 *
 * @remarks
 * - Automatically redacts sensitive data via ErrorSanitizerService
 * - Logs error with categorization for monitoring
 * - Preserves original exception response structure
 * - Works in conjunction with GlobalExceptionFilter (processes first)
 *
 * @example
 * ```typescript
 * // Handled exceptions
 * throw new BadRequestException('Invalid input'); // 400
 * throw new UnauthorizedException('Invalid token'); // 401
 * throw new ForbiddenException('Access denied'); // 403
 * throw new NotFoundException('IUser not found'); // 404
 * ```
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter, ILazyModuleRefService {
	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	private get Logger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	private get ErrorSanitizer(): ErrorSanitizerService {
		return this.Module.get(ErrorSanitizerService);
	}

	private get ErrorCategorizer(): ErrorCategorizerService {
		return this.Module.get(ErrorCategorizerService);
	}

	public catch(exception: HttpException, host: ArgumentsHost): void {
		// Handle regular HTTP requests
		const Ctx = host.switchToHttp();
		const Response = Ctx.getResponse<Response>();
		const Status = exception.getStatus();

		const IsProduction = !DEV_ENVIRONMENTS.has(process.env['NODE_ENV'] ?? '');
		const IsDevelopment = !IsProduction;

		// Normalize response to object for sanitization
		const ExceptionResponse = exception.getResponse();
		const ErrorObj = typeof ExceptionResponse === 'string'
			? { message: ExceptionResponse, statusCode: Status }
			: ExceptionResponse;

		// Sanitize error response
		const SanitizedError = this.ErrorSanitizer.SanitizeErrorResponse(
			ErrorObj as Record<string, any>,
			IsDevelopment,
		);

		// Categorize and log error
		const ErrorCategory = this.ErrorCategorizer.CategorizeError(exception);
		this.Logger.error('HTTP Exception caught', undefined, undefined, {
			message: exception.message,
			status: Status,
			errorType: ErrorCategory.type,
			retryable: ErrorCategory.retryable,
			strategy: ErrorCategory.strategy,
			backoffMs: ErrorCategory.backoffMs,
			stack: IsDevelopment ? exception.stack : undefined,
		});

		Response.status(Status).json(SanitizedError);
	}
}
