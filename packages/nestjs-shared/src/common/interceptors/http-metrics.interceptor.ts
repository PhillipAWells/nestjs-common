import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsRegistryService } from '../services/metrics-registry.service.js';

/**
 * HTTP Metrics Interceptor
 *
 * Automatically collects HTTP request metrics including:
 * - Request duration histogram
 * - Request count counter
 * - Request size histogram
 */
const DEFAULT_ERROR_STATUS_CODE = 500;

@Injectable()
export class HTTPMetricsInterceptor implements NestInterceptor {
	constructor(private readonly metricsService: MetricsRegistryService) {}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		// Skip metrics for non-HTTP contexts (GraphQL, WebSocket, RPC, etc.)
		if (context.getType() !== 'http') {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();

		// Additional safety check for request object
		if (!request?.method) {
			return next.handle();
		}

		const startTime = Date.now();

		// Extract route information
		const { method } = request;
		const route = this.getRoute(request);

		return next.handle().pipe(
			tap(
				() => {
					const duration = Date.now() - startTime;
					const contentLength = this.getContentLength(request);
					const { statusCode } = response;

					// Record metrics
					this.metricsService.recordHttpRequest(method, route, statusCode, duration, contentLength);
				},
				(error) => {
					const duration = Date.now() - startTime;
					const contentLength = this.getContentLength(request);
					const statusCode = response.statusCode ?? DEFAULT_ERROR_STATUS_CODE;

					// Record metrics even on error (use captured statusCode or default)
					this.metricsService.recordHttpRequest(method, route, statusCode, duration, contentLength);
					// Re-throw the error to propagate it
					throw error;
				},
			),
		);
	}

	/**
	 * Extract route path from request
	 */
	private getRoute(request: Request): string {
		// Try to get route from Express
		const { route } = (request as unknown as { route?: { path?: string } });
		if (route?.path) {
			return route.path;
		}

		// Fallback to URL path
		return request.path || request.url || '/unknown';
	}

	/**
	 * Get request content length
	 */
	private getContentLength(request: Request): number | undefined {
		const contentLength = request.headers['content-length'];
		if (contentLength) {
			const length = parseInt(contentLength, 10);
			return isNaN(length) ? undefined : length;
		}
		return undefined;
	}
}
