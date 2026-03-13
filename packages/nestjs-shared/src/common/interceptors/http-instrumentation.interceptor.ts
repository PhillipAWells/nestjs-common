import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	HttpException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { performance } from 'node:perf_hooks';
import { Request, Response } from 'express';
import { InstrumentationRegistry } from '../registry/instrumentation-registry.js';
import { LazyModuleRefService } from '../utils/lazy-getter.types.js';

/**
 * HTTP Instrumentation Interceptor
 *
 * Backend-agnostic HTTP request metrics collection using InstrumentationRegistry.
 * Records request duration, status code, and request size for all HTTP requests.
 * Skips metrics collection for non-HTTP contexts (GraphQL, WebSocket, RPC, etc.).
 *
 * Metrics recorded:
 * - `http_request_duration_seconds` — Request duration in seconds (histogram)
 * - `http_requests_total` — Total HTTP requests (counter)
 * - `http_request_size_bytes` — Request body size in bytes (histogram, when available)
 *
 * @injectable
 *
 * @example
 * ```typescript
 * // Register in your module
 * @Module({
 *   providers: [HTTPInstrumentationInterceptor],
 * })
 * export class MyModule {}
 *
 * // Apply globally in main.ts
 * app.useGlobalInterceptors(app.get(HTTPInstrumentationInterceptor));
 * ```
 */
@Injectable()
export class HTTPInstrumentationInterceptor implements NestInterceptor, LazyModuleRefService {
	constructor(public readonly Module: ModuleRef) {}

	private get Registry(): InstrumentationRegistry {
		return this.Module.get(InstrumentationRegistry);
	}

	/**
	 * Intercept HTTP requests and record instrumentation metrics.
	 * Records request duration, status code, and content length.
	 * Skips metrics collection for non-HTTP contexts.
	 *
	 * @param context - The execution context containing request/response
	 * @param next - The next handler in the chain
	 * @returns Observable of the response
	 */
	public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		// Skip metrics for non-HTTP contexts (GraphQL, WebSocket, RPC, etc.)
		if (context.getType() !== 'http') {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();
		const start = performance.now();
		const { method } = request;
		const contentLength = this.getContentLength(request);
		 
		const millisecondsPerSecond = 1000;

		return next.handle().pipe(
			tap(() => {
				const route = this.getRoute(request);
				const statusCode = String(response.statusCode);
				const duration = (performance.now() - start) / millisecondsPerSecond; // Convert to seconds

				this.Registry.recordMetric('http_request_duration_seconds', duration, {
					method,
					route,
					status_code: statusCode,
				});
				this.Registry.recordMetric('http_requests_total', 1, {
					method,
					route,
					status_code: statusCode,
				});
				if (contentLength !== undefined) {
					this.Registry.recordMetric('http_request_size_bytes', contentLength, {
						method,
						route,
					});
				}
			}),
			catchError((err: unknown) => {
				const route = this.getRoute(request);
				const statusCode = err instanceof HttpException
					? String(err.getStatus())
					: '500';
				const duration = (performance.now() - start) / millisecondsPerSecond; // Convert to seconds

				this.Registry.recordMetric('http_request_duration_seconds', duration, {
					method,
					route,
					status_code: statusCode,
				});
				this.Registry.recordMetric('http_requests_total', 1, {
					method,
					route,
					status_code: statusCode,
				});

				return throwError(() => err);
			}),
		);
	}

	/**
	 * Extract route path from request
	 * Tries to get the route from Express first, then falls back to URL path
	 *
	 * @private
	 * @param request - The Express request object
	 * @returns The route path or fallback value
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
	 * Get request content length from headers
	 * Parses the content-length header and returns it as a number
	 *
	 * @private
	 * @param request - The Express request object
	 * @returns The content length in bytes, or undefined if not available
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
