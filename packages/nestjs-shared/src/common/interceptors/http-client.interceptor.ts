import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AppLogger } from '../services/logger.service.js';

@Injectable()
export class HttpClientInterceptor implements NestInterceptor {
	private readonly ContextualLogger: AppLogger;

	private readonly Logger: AppLogger;

	constructor(logger: AppLogger) {
		this.Logger = logger;
		this.ContextualLogger = this.Logger.CreateContextualLogger(HttpClientInterceptor.name);
	}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const Request = context.switchToHttp().getRequest();
		const StartTime = Date.now();

		// Log outgoing request
		this.ContextualLogger.Debug('HTTP request', JSON.stringify({
			method: Request.method,
			url: Request.url,
			headers: this.SanitizeHeaders(Request.headers),
			correlationId: Request.correlationId ?? 'unknown',
		}));

		return next.handle().pipe(
			tap((response) => {
				const Duration = Date.now() - StartTime;
				this.ContextualLogger.info('HTTP response', JSON.stringify({
					method: Request.method,
					url: Request.url,
					statusCode: response.statusCode ?? response.status,
					durationMs: Duration,
					correlationId: Request.correlationId ?? 'unknown',
				}));
			}),
			catchError((error) => {
				const Duration = Date.now() - StartTime;
				this.ContextualLogger.error('HTTP request failed', JSON.stringify({
					method: Request.method,
					url: Request.url,
					statusCode: error.status ?? error.response?.status,
					error: error.message,
					durationMs: Duration,
					correlationId: Request.correlationId ?? 'unknown',
				}));
				throw error;
			}),
		);
	}

	private SanitizeHeaders(headers: Record<string, string>): Record<string, string> {
		const Sanitized = { ...headers };
		const SensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

		for (const Header of SensitiveHeaders) {
			if (Sanitized[Header]) {
				Sanitized[Header] = '[REDACTED]';
			}
		}

		return Sanitized;
	}
}
