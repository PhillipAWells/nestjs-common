import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AppLogger } from '../services/logger.service.js';
import { LazyModuleRefService } from '../utils/lazy-getter.types.js';

/**
 * Logging Interceptor
 * Logs incoming requests and outgoing responses with timing information
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
		logFn(`Incoming request: ${method} ${url} from ${ip}`, 'LoggingInterceptor');

		return next.handle().pipe(
			tap(() => {
				const duration = Date.now() - startTime;
				const response = context.switchToHttp().getResponse<{ statusCode?: number }>();
				const { statusCode } = response;

				logFn(
					`Request completed: ${method} ${url} - ${statusCode} - ${duration}ms`,
					'LoggingInterceptor',
				);
			}),
		);
	}
}
