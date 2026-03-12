import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
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
			tap(() => {
				const duration = Date.now() - startTime;
				const contentLength = this.getContentLength(request);
				const { statusCode } = response;

				// Record metrics
				this.metricsService.recordHttpRequest(method, route, statusCode, duration, contentLength);
			}),
			catchError((error: unknown) => {
				const duration = Date.now() - startTime;
				const contentLength = this.getContentLength(request);
				const statusCode = response.statusCode ?? DEFAULT_ERROR_STATUS_CODE;

				// Record metrics even on error (use captured statusCode or default)
				this.metricsService.recordHttpRequest(method, route, statusCode, duration, contentLength);
				return throwError(() => error);
			}),
		);
	}

	/**
	 * Extract route path from request.
	 * Prefers the Express route pattern (e.g., /users/:id) over the raw URL path
	 * to prevent unbounded metric cardinality from dynamic path parameters.
	 */
	private getRoute(request: Request): string {
		// Try to get route pattern from Express (e.g., /users/:id instead of /users/123)
		const { route } = (request as unknown as { route?: { path?: string } });
		if (route?.path) {
			return route.path;
		}

		// Fallback: normalize the path to collapse UUIDs, ObjectIDs, and numeric IDs
		// to prevent unbounded metric label cardinality
		const rawPath = request.path || request.url || '/unknown';
		return this.normalizePath(rawPath);
	}

	/**
	 * Normalize a URL path by replacing dynamic segments (UUIDs, ObjectIDs, numeric IDs)
	 * with placeholder tokens to prevent unbounded metric cardinality.
	 */
	private normalizePath(path: string): string {
		return path
			// Replace UUIDs (v1-v5)
			.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
			// Replace MongoDB ObjectIDs (24 hex chars)
			.replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id')
			// Replace purely numeric path segments
			.replace(/\/\d+(?=\/|$)/g, '/:id');
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
