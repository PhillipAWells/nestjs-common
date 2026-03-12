import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { PyroscopeService } from '../service.js';
import { IProfileContext } from '../interfaces/profiling.interface.js';

interface HttpRequest {
	method: string;
	url: string;
	route?: { path: string };
	get: (header: string) => string | undefined;
}

interface HttpResponse {
	statusCode?: number;
}

/**
 * HTTP request profiling interceptor
 * Automatically profiles HTTP requests with timing, method, path, and status code
 */
@Injectable()
export class ProfilingInterceptor implements NestInterceptor {
	constructor(private readonly pyroscopeService: PyroscopeService) {}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		if (!this.pyroscopeService.isEnabled()) {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest<HttpRequest>();
		const response = context.switchToHttp().getResponse<HttpResponse>();

		const profileContext: IProfileContext = {
			functionName: `HTTP ${request.method} ${request.route?.path ?? request.url}`,
			startTime: Date.now(),
			tags: {
				method: request.method,
				path: request.route?.path ?? request.url,
				userAgent: request.get('User-Agent') ?? 'unknown',
			},
		};

		this.pyroscopeService.startProfiling(profileContext);

		return next.handle().pipe(
			tap(() => {
				// Success case
				profileContext.tags = {
					...profileContext.tags,
					statusCode: response.statusCode?.toString() ?? 'unknown',
					success: 'true',
				};
				this.pyroscopeService.stopProfiling(profileContext);
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
				this.pyroscopeService.stopProfiling(profileContext);
				throw error;
			}),
		);
	}
}
