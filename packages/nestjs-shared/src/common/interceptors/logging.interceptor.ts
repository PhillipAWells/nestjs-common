import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { AppLogger } from '../services/logger.service.js';
import { ILazyModuleRefService } from '../utils/lazy-getter.types.js';
import { EscapeNewlines } from '../utils/sanitization.utils.js';
import { GetErrorMessage } from '../utils/error.utils.js';

/**
 * Logging Interceptor.
 * Logs incoming HTTP requests and outgoing responses with timing information.
 * Uses DEBUG level for health/metrics endpoints to reduce noise.
 * Automatically logs request details: method, URL, IP address, and response time.
 *
 * @remarks
 * - Skips logging for non-HTTP contexts (GraphQL, WebSocket, etc.)
 * - Uses DEBUG level for /health and /metrics endpoints
 * - Uses INFO level for other requests
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor, ILazyModuleRefService {
	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	private get Logger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		// Skip logging for non-HTTP contexts (e.g., GraphQL)
		if (context.getType() !== 'http') {
			return next.handle();
		}

		const Request = context.switchToHttp().getRequest<Request>();
		const { method, url, ip } = Request;
		const StartTime = Date.now();

		// Use DEBUG level for health checks and metrics endpoints to reduce noise
		const IsHealthOrMetrics = url.includes('/health') || url.includes('/metrics');

		// Note: Dynamic profiling tags are not supported by @pyroscope/nodejs
		// Use static tags in config during initialization instead

		const LogFn = IsHealthOrMetrics ? this.Logger.Debug.bind(this.Logger) : this.Logger.info.bind(this.Logger);
		LogFn(`Incoming request: ${EscapeNewlines(method)} ${EscapeNewlines(url)} from ${EscapeNewlines(ip ?? 'unknown')}`, 'LoggingInterceptor');

		return next.handle().pipe(
			tap(() => {
				const Duration = Date.now() - StartTime;
				const Response = context.switchToHttp().getResponse<{ statusCode?: number }>();
				const { statusCode } = Response;

				LogFn(
					`Request completed: ${EscapeNewlines(method)} ${EscapeNewlines(url)} - ${statusCode} - ${Duration}ms`,
					'LoggingInterceptor',
				);
			}),
			catchError((error: unknown) => {
				const Duration = Date.now() - StartTime;
				this.Logger.error(
					`Request failed: ${EscapeNewlines(method)} ${EscapeNewlines(url)} - ${Duration}ms - ${GetErrorMessage(error)}`,
					'LoggingInterceptor',
				);
				return throwError(() => error);
			}),
		);
	}
}
