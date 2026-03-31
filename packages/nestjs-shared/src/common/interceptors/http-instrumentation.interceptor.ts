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
import { ILazyModuleRefService } from '../utils/lazy-getter.types.js';

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
export class HTTPInstrumentationInterceptor implements NestInterceptor, ILazyModuleRefService {
	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

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

		const Request = context.switchToHttp().getRequest<Request>();
		const Response = context.switchToHttp().getResponse<Response>();
		const Start = performance.now();
		const { method } = Request;
		const ContentLength = this.GetContentLength(Request);
		const MillisecondsPerSecond = 1000;

		return next.handle().pipe(
			tap(() => {
				const Route = this.GetRoute(Request);
				const StatusCode = String(Response.statusCode);
				const Duration = (performance.now() - Start) / MillisecondsPerSecond; // Convert to seconds

				this.Registry.RecordMetric('http_request_duration_seconds', Duration, {
					method,
					route: Route,
					status_code: StatusCode,
				});
				this.Registry.RecordMetric('http_requests_total', 1, {
					method,
					route: Route,
					status_code: StatusCode,
				});
				if (ContentLength !== undefined) {
					this.Registry.RecordMetric('http_request_size_bytes', ContentLength, {
						method,
						route: Route,
					});
				}
			}),
			catchError((err: unknown) => {
				const Route = this.GetRoute(Request);
				const StatusCode = err instanceof HttpException
					? String(err.getStatus())
					: '500';
				const Duration = (performance.now() - Start) / MillisecondsPerSecond; // Convert to seconds

				this.Registry.RecordMetric('http_request_duration_seconds', Duration, {
					method,
					route: Route,
					status_code: StatusCode,
				});
				this.Registry.RecordMetric('http_requests_total', 1, {
					method,
					route: Route,
					status_code: StatusCode,
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
	private GetRoute(request: Request): string {
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
	private GetContentLength(request: Request): number | undefined {
		const ContentLength = request.headers['content-length'];
		if (ContentLength) {
			const Length = parseInt(ContentLength, 10);
			return isNaN(Length) ? undefined : Length;
		}
		return undefined;
	}
}
