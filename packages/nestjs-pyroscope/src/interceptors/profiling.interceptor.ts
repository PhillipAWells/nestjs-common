import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable, tap, catchError } from 'rxjs';
import { PyroscopeService } from '../service.js';
import { IProfileContext } from '../interfaces/profiling.interface.js';

interface IHttpRequest {
	method: string;
	url: string;
	route?: { path: string };
	get: (header: string) => string | undefined;
}

interface IHttpResponse {
	statusCode?: number;
}

/**
 * HTTP request profiling interceptor.
 *
 * Automatically profiles all HTTP requests that pass through it with timing,
 * method, path, and status code information. Useful for collecting performance
 * metrics across all endpoints.
 *
 * Features:
 * - Automatic timing of HTTP request lifecycle
 * - Captures HTTP method, path, and status code
 * - Records IUser-Agent header
 * - Distinguishes between successful and failed requests
 * - Properly handles both sync and async responses
 *
 * When to use:
 * - You want automatic profiling of all HTTP requests
 * - You need comprehensive request performance metrics
 * - You want global observability without per-method decoration
 *
 * @example
 * ```typescript
 * // Register globally in AppModule
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_INTERCEPTOR,
 *       useClass: ProfilingInterceptor,
 *     },
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * @remarks
 * - Returns request unmodified if profiling is disabled
 * - Captures profiles with names like 'HTTP GET /users/:id'
 * - Error case distinguishes success/failure in tags
 * - Error messages are not exposed in tags for security
 */
@Injectable()
export class ProfilingInterceptor implements NestInterceptor {
	private readonly ModuleRef: ModuleRef;

	constructor(moduleRef: ModuleRef) {
		this.ModuleRef = moduleRef;
	}

	private get PyroscopeService(): PyroscopeService | null {
		try {
			return this.ModuleRef.get(PyroscopeService, { strict: false });
		} catch {
			return null;
		}
	}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const Service = this.PyroscopeService;
		if (!Service?.IsEnabled()) {
			return next.handle();
		}

		const Request = context.switchToHttp().getRequest<IHttpRequest>();
		const Response = context.switchToHttp().getResponse<IHttpResponse>();

		const ProfileContext: IProfileContext = {
			functionName: `HTTP ${Request.method} ${Request.route?.path ?? Request.url}`,
			startTime: Date.now(),
			tags: {
				method: Request.method,
				path: Request.route?.path ?? Request.url,
				userAgent: Request.get('IUser-Agent') ?? 'unknown',
			},
		};

		Service.StartProfiling(ProfileContext);

		return next.handle().pipe(
			tap(() => {
				// Success case
				ProfileContext.tags = {
					...ProfileContext.tags,
					statusCode: Response.statusCode?.toString() ?? 'unknown',
					success: 'true',
				};
				Service.StopProfiling(ProfileContext);
			}),
			catchError((error: unknown) => {
				// Error case - do not expose error message in tags
				const StatusCode = (error as { status?: number }).status?.toString() ?? '500';
				ProfileContext.tags = {
					...ProfileContext.tags,
					statusCode: StatusCode,
					success: 'false',
					error: 'unknown',
				};
				ProfileContext.error = error as Error;
				Service.StopProfiling(ProfileContext);
				throw error;
			}),
		);
	}
}
