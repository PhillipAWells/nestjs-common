import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AppLogger } from '../services/logger.service.js';

@Injectable()
export class HttpClientInterceptor implements NestInterceptor {
	private readonly contextualLogger: AppLogger;

	private readonly logger: AppLogger;

	constructor(logger: AppLogger) {
		this.logger = logger;
		this.contextualLogger = this.logger.createContextualLogger(HttpClientInterceptor.name);
	}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const request = context.switchToHttp().getRequest();
		const startTime = Date.now();

		// Log outgoing request
		this.contextualLogger.debug('HTTP request', JSON.stringify({
			method: request.method,
			url: request.url,
			headers: this.sanitizeHeaders(request.headers),
			correlationId: request.correlationId ?? 'unknown',
		}));

		return next.handle().pipe(
			tap((response) => {
				const duration = Date.now() - startTime;
				this.contextualLogger.info('HTTP response', JSON.stringify({
					method: request.method,
					url: request.url,
					statusCode: response.statusCode ?? response.status,
					durationMs: duration,
					correlationId: request.correlationId ?? 'unknown',
				}));
			}),
			catchError((error) => {
				const duration = Date.now() - startTime;
				this.contextualLogger.error('HTTP request failed', JSON.stringify({
					method: request.method,
					url: request.url,
					statusCode: error.status ?? error.response?.status,
					error: error.message,
					durationMs: duration,
					correlationId: request.correlationId ?? 'unknown',
				}));
				throw error;
			}),
		);
	}

	private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
		const sanitized = { ...headers };
		const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

		for (const header of sensitiveHeaders) {
			if (sanitized[header]) {
				sanitized[header] = '[REDACTED]';
			}
		}

		return sanitized;
	}
}
