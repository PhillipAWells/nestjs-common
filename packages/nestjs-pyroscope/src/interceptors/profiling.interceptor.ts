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

	private get pyroscopeService(): PyroscopeService | null {
		try {
			return this.ModuleRef.get(PyroscopeService, { strict: false });
		} catch {
			return null;
		}
	}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const service = this.pyroscopeService;
		if (!service?.isEnabled()) {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest<IHttpRequest>();
		const response = context.switchToHttp().getResponse<IHttpResponse>();

		const profileContext: IProfileContext = {
			functionName: `HTTP ${request.method} ${request.route?.path ?? request.url}`,
			startTime: Date.now(),
			tags: {
				method: request.method,
				path: request.route?.path ?? request.url,
				userAgent: request.get('IUser-Agent') ?? 'unknown',
			},
		};

		service.startProfiling(profileContext);

		return next.handle().pipe(
			tap(() => {
				// Success case
				profileContext.tags = {
					...profileContext.tags,
					statusCode: response.statusCode?.toString() ?? 'unknown',
					success: 'true',
				};
				service.stopProfiling(profileContext);
			}),
			catchError((error: unknown) => {
				// Error case - do not expose error message in tags
				const statusCode = (error as { status?: number }).status?.toString() ?? '500';
				profileContext.tags = {
					...profileContext.tags,
					statusCode,
					success: 'false',
					error: 'unknown',
				};
				profileContext.error = error as Error;
				service.stopProfiling(profileContext);
				throw error;
			}),
		);
	}
}
