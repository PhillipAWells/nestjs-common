import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
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
 * @Query(() => User)
 * async getUser(@Args('id') id: string): Promise<User> {
 *   return this.userService.findById(id);
 * }
 * ```
 */
@Injectable()
export class GraphQLPerformanceMonitoringInterceptor implements NestInterceptor, LazyModuleRefService {
	public get GraphQLPerformanceService(): GraphQLPerformanceService {
		return this.Module.get(GraphQLPerformanceService, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get logger(): AppLogger {
		return this.AppLogger.createContextualLogger(GraphQLPerformanceMonitoringInterceptor.name);
	}

	constructor(public readonly Module: ModuleRef) {}

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
			tap(async (result) => {
				const duration = Date.now() - startTime;

				// Record successful operation
				await this.GraphQLPerformanceService.measure(operation, () => result, {
					fieldName: info.fieldName,
					operationType: info.operation.operation,
					args: gqlContext.getArgs(),
					userId: gqlContext.getContext().user?.id,
					duration,
				});

				// Log performance warnings
				if (duration > PERFORMANCE_WARNING_THRESHOLD_MS) { // > 5 seconds
					this.logger.warn(`Very slow GraphQL operation: ${operation} took ${duration}ms`);
				} else if (duration > SLOW_OPERATION_THRESHOLD_MS) { // > 1 second
					this.logger.debug(`Slow GraphQL operation: ${operation} took ${duration}ms`);
				}
			}),
			catchError(async (error) => {
				const duration = Date.now() - startTime;

				// Record failed operation
				await this.GraphQLPerformanceService.measure(
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
						error: error instanceof Error ? error.message : String(error),
					},
				);

				this.logger.error(`GraphQL operation failed: ${operation} took ${duration}ms`, error instanceof Error ? error.stack : String(error));

				throw error;
			}),
		);
	}
}
