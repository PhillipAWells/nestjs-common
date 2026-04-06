import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsRegistryService } from '../services/metrics-registry.service.js';
import { ILazyModuleRefService } from '../utils/lazy-getter.types.js';

const DEFAULT_ERROR_STATUS_CODE = 500;

/**
 * HTTP Metrics Interceptor.
 * Automatically collects and records HTTP request metrics for Prometheus.
 *
 * Metrics collected:
 * - Request duration histogram (in seconds)
 * - Request count counter (total requests)
 * - Request size histogram (in bytes)
 *
 * Labels for all metrics:
 * - method: HTTP method (GET, POST, etc.)
 * - route: URL path (normalized to collapse dynamic segments like UUIDs)
 * - status_code: HTTP status code
 * - status_class: Status class (2xx, 4xx, 5xx)
 *
 * @remarks
 * - Skips non-HTTP contexts (GraphQL, WebSocket, RPC, etc.)
 * - Normalizes dynamic path segments (UUIDs, ObjectIDs, numeric IDs) to :id to prevent unbounded cardinality
 * - Records metrics even when requests fail or throw errors
 */

@Injectable()
export class HTTPMetricsInterceptor implements NestInterceptor, ILazyModuleRefService {
	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	private get MetricsService(): MetricsRegistryService {
		return this.Module.get(MetricsRegistryService);
	}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		// Skip metrics for non-HTTP contexts (GraphQL, WebSocket, RPC, etc.)
		if (context.getType() !== 'http') {
			return next.handle();
		}

		const Request = context.switchToHttp().getRequest<Request>();
		const Response = context.switchToHttp().getResponse<Response>();

		// Additional safety check for request object
		if (!Request?.method) {
			return next.handle();
		}

		const StartTime = Date.now();

		// Extract route information
		const { method } = Request;
		const Route = this.GetRoute(Request);

		return next.handle().pipe(
			tap(() => {
				const Duration = Date.now() - StartTime;
				const ContentLength = this.GetContentLength(Request);
				const StatusCode = Response.statusCode ?? DEFAULT_ERROR_STATUS_CODE;

				// Record metrics
				this.MetricsService.RecordHttpRequest(method, Route, StatusCode, Duration, ContentLength);
			}),
			catchError((error: unknown) => {
				const Duration = Date.now() - StartTime;
				const ContentLength = this.GetContentLength(Request);
				const StatusCode = (error instanceof HttpException ? error.getStatus() : undefined) ?? Response.statusCode ?? DEFAULT_ERROR_STATUS_CODE;

				// Record metrics even on error (use status code from HttpException if available, then response, then default)
				this.MetricsService.RecordHttpRequest(method, Route, StatusCode, Duration, ContentLength);
				return throwError(() => error);
			}),
		);
	}

	/**
	 * Extract route path from request.
	 * Prefers the Express route pattern (e.g., /users/:id) over the raw URL path
	 * to prevent unbounded metric cardinality from dynamic path parameters.
	 */
	private GetRoute(request: Request): string {
		// Try to get route pattern from Express (e.g., /users/:id instead of /users/123)
		const { route } = (request as unknown as { route?: { path?: string } });
		if (route?.path) {
			return route.path;
		}

		// Fallback: normalize the path to collapse UUIDs, ObjectIDs, and numeric IDs
		// to prevent unbounded metric label cardinality
		const RawPath = request.path || request.url || '/unknown';
		return this.NormalizePath(RawPath);
	}

	/**
	 * Normalize a URL path by replacing dynamic segments (UUIDs, ObjectIDs, numeric IDs)
	 * with placeholder tokens to prevent unbounded metric cardinality.
	 */
	private NormalizePath(path: string): string {
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
	private GetContentLength(request: Request): number | undefined {
		const ContentLength = request.headers['content-length'];
		if (ContentLength) {
			const Length = parseInt(ContentLength, 10);
			return isNaN(Length) ? undefined : Length;
		}
		return undefined;
	}
}
