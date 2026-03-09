import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { PyroscopeService } from '../service.js';
import { IProfileContext } from '../interfaces/profiling.interface.js';

/**
 * HTTP request profiling interceptor
 * Automatically profiles HTTP requests with timing, method, path, and status code
 */
@Injectable()
export class ProfilingInterceptor implements NestInterceptor {
	constructor(private readonly pyroscopeService: PyroscopeService) {}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		if (!this.pyroscopeService.isEnabled()) {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest();
		const response = context.switchToHttp().getResponse();

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
			catchError((error) => {
				// Error case - do not expose error message in tags
				profileContext.tags = {
					...profileContext.tags,
					statusCode: error.status?.toString() ?? '500',
					success: 'false',
					error: 'unknown',
				};
				profileContext.error = error;
				this.pyroscopeService.stopProfiling(profileContext);
				throw error;
			}),
		);
	}
}
