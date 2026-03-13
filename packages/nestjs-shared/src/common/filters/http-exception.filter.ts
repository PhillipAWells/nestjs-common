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
import { LazyModuleRefService } from '../utils/lazy-getter.types.js';

/**
 * HTTP Exception Filter
 * Handles all HTTP exceptions and formats error responses consistently
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter, LazyModuleRefService {
	constructor(public readonly Module: ModuleRef) {}

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
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const status = exception.getStatus();

		const DEV_ENVIRONMENTS = new Set(['development', 'dev', 'local', 'test']);
		const isProduction = !DEV_ENVIRONMENTS.has(process.env['NODE_ENV'] ?? '');
		const isDevelopment = !isProduction;

		// Sanitize error response
		const sanitizedError = this.ErrorSanitizer.sanitizeErrorResponse(
			exception.getResponse(),
			isDevelopment,
		);

		// Categorize and log error
		const errorCategory = this.ErrorCategorizer.categorizeError(exception);
		this.Logger.error('HTTP Exception caught', undefined, undefined, {
			message: exception.message,
			status,
			errorType: errorCategory.type,
			retryable: errorCategory.retryable,
			strategy: errorCategory.strategy,
			backoffMs: errorCategory.backoffMs,
			stack: isDevelopment ? exception.stack : undefined,
		});

		response.status(status).json(sanitizedError);
	}
}
