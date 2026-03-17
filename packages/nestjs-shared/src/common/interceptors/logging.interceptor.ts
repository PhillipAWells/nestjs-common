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
import { LazyModuleRefService } from '../utils/lazy-getter.types.js';
import { escapeNewlines } from '../utils/sanitization.utils.js';

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
export class LoggingInterceptor implements NestInterceptor, LazyModuleRefService {
	constructor(public readonly Module: ModuleRef) {}

	private get Logger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		// Skip logging for non-HTTP contexts (e.g., GraphQL)
		if (context.getType() !== 'http') {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest<Request>();
		const { method, url, ip } = request;
		const startTime = Date.now();

		// Use DEBUG level for health checks and metrics endpoints to reduce noise
		const isHealthOrMetrics = url.includes('/health') || url.includes('/metrics');

		// Note: Dynamic profiling tags are not supported by @pyroscope/nodejs
		// Use static tags in config during initialization instead

		const logFn = isHealthOrMetrics ? this.Logger.debug.bind(this.Logger) : this.Logger.info.bind(this.Logger);
		logFn(`Incoming request: ${escapeNewlines(method)} ${escapeNewlines(url)} from ${escapeNewlines(ip ?? 'unknown')}`, 'LoggingInterceptor');

		return next.handle().pipe(
			tap(() => {
				const duration = Date.now() - startTime;
				const response = context.switchToHttp().getResponse<{ statusCode?: number }>();
				const { statusCode } = response;

				logFn(
					`Request completed: ${escapeNewlines(method)} ${escapeNewlines(url)} - ${statusCode} - ${duration}ms`,
					'LoggingInterceptor',
				);
			}),
			catchError((error: unknown) => {
				const duration = Date.now() - startTime;
				this.Logger.error(
					`Request failed: ${escapeNewlines(method)} ${escapeNewlines(url)} - ${duration}ms - ${error instanceof Error ? error.message : String(error)}`,
					'LoggingInterceptor',
				);
				return throwError(() => error);
			}),
		);
	}
}
