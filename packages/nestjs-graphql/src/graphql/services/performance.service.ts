import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage, getErrorStack } from '@pawells/nestjs-shared/common';
import { Traced } from '@pawells/nestjs-open-telemetry';
import {
	SLOW_OPERATION_THRESHOLD_MS,
	MILLISECONDS_TO_SECONDS,
	DEFAULT_STATS_TIME_RANGE_MS,
	MAX_METRICS_HISTORY,
	DEFAULT_RECENT_METRICS_LIMIT,
	DEFAULT_SLOW_OPERATIONS_LIMIT,
	DEFAULT_ERRORS_LIMIT,
} from '../constants/performance.constants.js';

/**
 * Performance metrics interface
 */
export interface IPerformanceMetrics {
	Operation: string;
	duration: number;
	startTime: Date;
	endTime: Date;
	success: boolean;
	error: string | undefined;
	metadata: Record<string, any> | undefined;
}

/**
 * Performance statistics
 */
export interface IPerformanceStats {
	totalOperations: number;
	averageDuration: number;
	minDuration: number;
	maxDuration: number;
	errorRate: number;
	OperationsPerSecond: number;
}

/**
 * GraphQL Performance Service
 *
 * Tracks and monitors performance metrics for GraphQL Operations.
 * Provides statistics and alerting capabilities for performance issues.
 *
 * @example
 * ```typescript
 * const metrics = await performanceService.measure('userQuery', async () => {
 *   return userService.findById(id);
 * });
 *
 * const stats = performanceService.getStats();
 * ```
 */
@Injectable()
export class GraphQLPerformanceService implements ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get Logger(): IContextualLogger {
		return this.AppLogger.createContextualLogger(GraphQLPerformanceService.name);
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	private readonly Metrics: IPerformanceMetrics[] = [];

	private readonly MaxMetricsHistory = MAX_METRICS_HISTORY;

	/**
	 * Measures execution time of an Operation
	 *
	 * @param Operation - Operation name
	 * @param fn - Function to measure
	 * @param metadata - Additional metadata
	 * @returns Promise<T> - Function result
	 */
	@Traced({ name: 'graphql.performance.measure' })
	public async Measure<T>(
		operation: string,
		fn: () => Promise<T> | T,
		metadata?: Record<string, any>,
	): Promise<T> {
		const StartTime = new Date();

		try {
			const Result = await fn();
			const EndTime = new Date();
			const Duration = EndTime.getTime() - StartTime.getTime();

			this.RecordMetrics({
				Operation: operation,
				duration: Duration,
				startTime: StartTime,
				endTime: EndTime,
				success: true,
				error: undefined,
				metadata,
			});

			// Log slow Operations
			if (Duration > SLOW_OPERATION_THRESHOLD_MS) {
				this.Logger.warn(`Slow operation: ${operation} took ${Duration}ms`);
			}

			return Result;
		} catch (error) {
			const EndTime = new Date();
			const Duration = EndTime.getTime() - StartTime.getTime();

			this.RecordMetrics({
				Operation: operation,
				duration: Duration,
				startTime: StartTime,
				endTime: EndTime,
				success: false,
				error: getErrorMessage(error),
				metadata,
			});

			this.Logger.error(`Operation failed: ${operation} took ${Duration}ms`, getErrorStack(error));
			throw error;
		}
	}

	/**
	 * Records performance metrics
	 */
	private RecordMetrics(metrics: IPerformanceMetrics): void {
		this.Metrics.push(metrics);

		// Maintain history limit
		if (this.Metrics.length > this.MaxMetricsHistory) {
			this.Metrics.shift();
		}
	}

	/**
	 * Gets performance statistics
	 *
	 * @param Operation - Optional Operation filter
	 * @param timeRange - Time range in milliseconds (default: 1 hour)
	 * @returns IPerformanceStats - Statistics for the period
	 */
	public GetStats(operation?: string, timeRange: number = DEFAULT_STATS_TIME_RANGE_MS): IPerformanceStats {
		const Now = Date.now();
		const Cutoff = Now - timeRange;

		const RelevantMetrics = this.Metrics.filter(m =>
			m.startTime.getTime() >= Cutoff &&
			(!operation || m.Operation === operation),
		);

		if (RelevantMetrics.length === 0) {
			return {
				totalOperations: 0,
				averageDuration: 0,
				minDuration: 0,
				maxDuration: 0,
				errorRate: 0,
				OperationsPerSecond: 0,
			};
		}

		const Durations = RelevantMetrics.map(m => m.duration);
		const Errors = RelevantMetrics.filter(m => !m.success).length;

		const TotalDuration = Durations.reduce((sum, d) => sum + d, 0);
		const TimeSpanSeconds = timeRange / MILLISECONDS_TO_SECONDS;

		return {
			totalOperations: RelevantMetrics.length,
			averageDuration: TotalDuration / RelevantMetrics.length,
			minDuration: Math.min(...Durations),
			maxDuration: Math.max(...Durations),
			errorRate: Errors / RelevantMetrics.length,
			OperationsPerSecond: RelevantMetrics.length / TimeSpanSeconds,
		};
	}

	/**
	 * Gets recent metrics
	 *
	 * @param limit - Maximum number of metrics to return
	 * @param operation - Optional operation filter
	 * @returns IPerformanceMetrics[] - Recent metrics
	 */
	public GetRecentMetrics(limit: number = DEFAULT_RECENT_METRICS_LIMIT, operation?: string): IPerformanceMetrics[] {
		return this.Metrics
			.filter(m => !operation || m.Operation === operation)
			.slice(-limit)
			.reverse(); // Most recent first
	}

	/**
	 * Gets slow Operations
	 *
	 * @param threshold - Duration threshold in milliseconds
	 * @param limit - Maximum number to return
	 * @returns IPerformanceMetrics[] - Slow Operations
	 */
	public GetSlowOperations(threshold: number = SLOW_OPERATION_THRESHOLD_MS, limit: number = DEFAULT_SLOW_OPERATIONS_LIMIT): IPerformanceMetrics[] {
		return this.Metrics
			.filter(m => m.duration >= threshold)
			.sort((a, b) => b.duration - a.duration)
			.slice(0, limit);
	}

	/**
	 * Gets error metrics
	 *
	 * @param limit - Maximum number to return
	 * @returns IPerformanceMetrics[] - Failed Operations
	 */
	public GetErrors(limit: number = DEFAULT_ERRORS_LIMIT): IPerformanceMetrics[] {
		return this.Metrics
			.filter(m => !m.success)
			.slice(-limit)
			.reverse(); // Most recent first
	}

	/**
	 * Clears all metrics
	 */
	public ClearMetrics(): void {
		this.Metrics.length = 0;
		this.Logger.info('Performance metrics cleared');
	}

	/**
	 * Gets Operations summary
	 *
	 * @returns Object with Operation counts
	 */
	public GetOperationsSummary(): Record<string, { count: number; avgDuration: number; errorRate: number }> {
		const Summary: Record<string, { durations: number[]; errors: number; count: number }> = {};

		for (const Metric of this.Metrics) {
			const OpSummary = Summary[Metric.Operation] ?? (Summary[Metric.Operation] = { durations: [], errors: 0, count: 0 });

			OpSummary.durations.push(Metric.duration);
			OpSummary.count++;
			if (!Metric.success) {
				OpSummary.errors++;
			}
		}

		const Result: Record<string, { count: number; avgDuration: number; errorRate: number }> = {};

		for (const [Operation, Data] of Object.entries(Summary)) {
			const AvgDuration = Data.durations.length > 0 ? Data.durations.reduce((sum, d) => sum + d, 0) / Data.durations.length : 0;
			Result[Operation] = {
				count: Data.count,
				avgDuration: AvgDuration,
				errorRate: Data.count > 0 ? Data.errors / Data.count : 0,
			};
		}

		return Result;
	}
}
