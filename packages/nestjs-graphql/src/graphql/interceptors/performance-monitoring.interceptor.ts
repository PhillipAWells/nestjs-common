import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage, getErrorStack } from '@pawells/nestjs-shared/common';
import { GraphQLPerformanceService } from '../services/performance.service.js';
import { SLOW_OPERATION_THRESHOLD_MS, PERFORMANCE_WARNING_THRESHOLD_MS } from '../constants/performance.constants.js';

/**
 * GraphQL Performance Monitoring Interceptor
 *
 * Monitors and tracks performance metrics for GraphQL operations.
 * Measures execution time, tracks errors, and provides insights
 * into resolver performance.
 *
 * @example
 * ```typescript
 * @UseInterceptors(GraphQLPerformanceMonitoringInterceptor)
 * @Query(() => IUser, { name: 'GetUser' })
 * async getUser(@Args('id') id: string): Promise<IUser> {
 *   return this.userService.findById(id);
 * }
 * ```
 */
@Injectable()
export class GraphQLPerformanceMonitoringInterceptor implements NestInterceptor, ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get GraphQLPerformanceService(): GraphQLPerformanceService {
		return this.Module.get(GraphQLPerformanceService, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get Logger(): AppLogger {
		return this.AppLogger.createContextualLogger(GraphQLPerformanceMonitoringInterceptor.name);
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
	 * Intercepts resolver execution to monitor performance
	 *
	 * @param context - Execution context
	 * @param next - Call handler
	 * @returns Observable with performance monitoring
	 */
	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const gqlContext = GqlExecutionContext.create(context);
		const info = gqlContext.getInfo();
		const operation = `${info.operation.operation} ${info.fieldName}`;

		const startTime = Date.now();

		return next.handle().pipe(
			tap((result) => {
				const duration = Date.now() - startTime;

				// Record successful operation (fire-and-forget with error handling)
				this.GraphQLPerformanceService.measure(operation, () => result, {
					fieldName: info.fieldName,
					operationType: info.operation.operation,
					args: gqlContext.getArgs(),
					userId: gqlContext.getContext().user?.id,
					duration,
				}).catch((err) => {
					this.Logger?.error(`Failed to record performance metrics: ${getErrorMessage(err)}`);
				});

				// Log performance warnings
				if (duration > PERFORMANCE_WARNING_THRESHOLD_MS) { // > 5 seconds
					this.Logger?.warn(`Very slow GraphQL operation: ${operation} took ${duration}ms`);
				} else if (duration > SLOW_OPERATION_THRESHOLD_MS) { // > 1 second
					this.Logger?.debug(`Slow GraphQL operation: ${operation} took ${duration}ms`);
				}
			}),
			catchError((error) => {
				const duration = Date.now() - startTime;

				// Record failed operation (fire-and-forget with error handling)
				this.GraphQLPerformanceService.measure(
					operation,
					() => {
						throw error;
					},
					{
						fieldName: info.fieldName,
						operationType: info.operation.operation,
						args: gqlContext.getArgs(),
						userId: gqlContext.getContext().user?.id,
						duration,
						error: getErrorMessage(error),
					},
				).catch((err) => {
					this.Logger?.error(`Failed to record performance metrics: ${getErrorMessage(err)}`);
				});

				this.Logger?.error(`GraphQL operation failed: ${operation} took ${duration}ms`, getErrorStack(error));

				throw error;
			}),
		);
	}
}
