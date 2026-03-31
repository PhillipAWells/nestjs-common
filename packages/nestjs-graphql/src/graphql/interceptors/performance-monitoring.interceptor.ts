import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
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

	private get Logger(): IContextualLogger {
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
		const GqlContext = GqlExecutionContext.create(context);
		const Info = GqlContext.getInfo();
		const Operation = `${Info.operation.operation} ${Info.fieldName}`;

		const StartTime = Date.now();

		return next.handle().pipe(
			tap((result) => {
				const Duration = Date.now() - StartTime;

				// Record successful operation (fire-and-forget with error handling)
				this.GraphQLPerformanceService.Measure(Operation, () => result, {
					fieldName: Info.fieldName,
					operationType: Info.operation.operation,
					args: GqlContext.getArgs(),
					userId: GqlContext.getContext().user?.id,
					duration: Duration,
				}).catch((err) => {
					this.Logger?.error(`Failed to record performance metrics: ${getErrorMessage(err)}`);
				});

				// Log performance warnings
				if (Duration > PERFORMANCE_WARNING_THRESHOLD_MS) { // > 5 seconds
					this.Logger?.warn(`Very slow GraphQL operation: ${Operation} took ${Duration}ms`);
				} else if (Duration > SLOW_OPERATION_THRESHOLD_MS) { // > 1 second
					this.Logger?.debug(`Slow GraphQL operation: ${Operation} took ${Duration}ms`);
				}
			}),
			catchError((error) => {
				const Duration = Date.now() - StartTime;

				// Record failed operation (fire-and-forget with error handling)
				this.GraphQLPerformanceService.Measure(
					Operation,
					() => {
						throw error;
					},
					{
						fieldName: Info.fieldName,
						operationType: Info.operation.operation,
						args: GqlContext.getArgs(),
						userId: GqlContext.getContext().user?.id,
						duration: Duration,
						error: getErrorMessage(error),
					},
				).catch((err) => {
					this.Logger?.error(`Failed to record performance metrics: ${getErrorMessage(err)}`);
				});

				this.Logger?.error(`GraphQL operation failed: ${Operation} took ${Duration}ms`, getErrorStack(error));

				throw error;
			}),
		);
	}
}
