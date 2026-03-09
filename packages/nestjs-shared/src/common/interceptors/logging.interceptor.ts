import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AppLogger } from '../services/logger.service.js';

/**
 * Logging Interceptor
 * Logs incoming requests and outgoing responses with timing information
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	constructor(
		@Inject(AppLogger) private readonly logger: AppLogger,
	) {}

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

		const logFn = isHealthOrMetrics ? this.logger.debug.bind(this.logger) : this.logger.info.bind(this.logger);
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
