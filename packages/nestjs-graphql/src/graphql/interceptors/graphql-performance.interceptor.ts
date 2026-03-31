import { Injectable, NestInterceptor } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { SLOW_OPERATION_THRESHOLD_MS, PERFORMANCE_WARNING_THRESHOLD_MS } from '../constants/performance.constants.js';

/**
 * GraphQL Performance Interceptor
 *
 * Tracks execution time for GraphQL operations and resolvers.
 * Logs warnings for slow operations and collects performance metrics.
 *
 * @example
 * ```typescript
 * @UseInterceptors(GraphQLPerformanceInterceptor)
 * @Query(() => [IUser], { name: 'GetUsers' })
 * async getUsers(): Promise<IUser[]> {
 *   // This operation's performance will be monitored
 * }
 * ```
 */
@Injectable()
export class GraphQLPerformanceInterceptor implements NestInterceptor, ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get Logger(): IContextualLogger {
		return this.AppLogger.createContextualLogger(GraphQLPerformanceInterceptor.name);
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	private readonly SlowOperationThreshold = SLOW_OPERATION_THRESHOLD_MS; // 1 second

	private readonly VerySlowOperationThreshold = PERFORMANCE_WARNING_THRESHOLD_MS; // 5 seconds

	/**
	 * Intercepts GraphQL operations for performance monitoring
	 *
	 * @param context - The execution context
	 * @param next - The call handler
	 * @returns Observable - The intercepted operation
	 */
	@ProfileMethod({ tags: { operation: 'graphql_intercept' } })
	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const StartTime = Date.now();

		// Extract GraphQL context
		const GqlContext = GqlExecutionContext.create(context);
		const Info = GqlContext.getInfo();

		// Extract operation details
		const OperationName = Info?.operation?.name?.value ?? 'Anonymous';
		const OperationType = Info?.operation?.operation ?? 'unknown';
		const FieldName = Info?.fieldName ?? 'unknown';

		return next.handle().pipe(
			tap({
				next: () => {
					const Duration = Date.now() - StartTime;

					// Log performance metrics
					this.LogPerformance(OperationType, OperationName, FieldName, Duration);

					// Check for slow operations
					this.CheckSlowOperation(OperationType, OperationName, FieldName, Duration);
				},
				error: () => {
					const Duration = Date.now() - StartTime;
					this.Logger?.warn(
						`GraphQL ${OperationType} failed after ${Duration}ms: ${OperationName}.${FieldName}`,
					);
				},
			}),
		);
	}

	/**
	 * Logs performance metrics for the operation
	 *
	 * @param operationType - The GraphQL operation type
	 * @param operationName - The operation name
	 * @param fieldName - The field name
	 * @param duration - Execution duration in milliseconds
	 */
	private LogPerformance(
		operationType: string,
		operationName: string,
		fieldName: string,
		duration: number,
	): void {
		// Log performance data for monitoring
		this.Logger?.debug(
			`GraphQL ${operationType} performance: ${operationName}.${fieldName} took ${duration}ms`,
		);

		// In a real application, you might send this to a metrics service
		// this.MetricsService.recordGraphQLOperation(operationType, duration);
	}

	/**
	 * Checks for slow operations and logs warnings
	 *
	 * @param operationType - The GraphQL operation type
	 * @param operationName - The operation name
	 * @param fieldName - The field name
	 * @param duration - Execution duration in milliseconds
	 */
	private CheckSlowOperation(
		operationType: string,
		operationName: string,
		fieldName: string,
		duration: number,
	): void {
		if (duration >= this.VerySlowOperationThreshold) {
			this.Logger?.error(
				`VERY SLOW GraphQL ${operationType}: ${operationName}.${fieldName} took ${duration}ms (threshold: ${this.VerySlowOperationThreshold}ms)`,
			);
		} else if (duration >= this.SlowOperationThreshold) {
			this.Logger?.warn(
				`Slow GraphQL ${operationType}: ${operationName}.${fieldName} took ${duration}ms (threshold: ${this.SlowOperationThreshold}ms)`,
			);
		}
	}
}
