import { Injectable } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
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
export interface PerformanceMetrics {
	operation: string;
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
export interface PerformanceStats {
	totalOperations: number;
	averageDuration: number;
	minDuration: number;
	maxDuration: number;
	errorRate: number;
	operationsPerSecond: number;
}

/**
 * GraphQL Performance Service
 *
 * Tracks and monitors performance metrics for GraphQL operations.
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
export class GraphQLPerformanceService implements LazyModuleRefService {
	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get logger(): AppLogger {
		return this.AppLogger.createContextualLogger(GraphQLPerformanceService.name);
	}

	constructor(public readonly Module: ModuleRef) {}

	private readonly metrics: PerformanceMetrics[] = [];

	private readonly maxMetricsHistory = MAX_METRICS_HISTORY;

	/**
	 * Measures execution time of an operation
	 *
	 * @param operation - Operation name
	 * @param fn - Function to measure
	 * @param metadata - Additional metadata
	 * @returns Promise<T> - Function result
	 */
	@Traced({ name: 'graphql.performance.measure' })
	public async measure<T>(
		operation: string,
		fn: () => Promise<T> | T,
		metadata?: Record<string, any>,
	): Promise<T> {
		const startTime = new Date();

		try {
			const result = await fn();
			const endTime = new Date();
			const duration = endTime.getTime() - startTime.getTime();

			this.recordMetrics({
				operation,
				duration,
				startTime,
				endTime,
				success: true,
				error: undefined,
				metadata,
			});

			// Log slow operations
			if (duration > SLOW_OPERATION_THRESHOLD_MS) {
				this.logger.warn(`Slow operation: ${operation} took ${duration}ms`);
			}

			return result;
		} catch (error) {
			const endTime = new Date();
			const duration = endTime.getTime() - startTime.getTime();

			this.recordMetrics({
				operation,
				duration,
				startTime,
				endTime,
				success: false,
				error: error instanceof Error ? error.message : String(error),
				metadata,
			});

			this.logger.error(`Operation failed: ${operation} took ${duration}ms`, error instanceof Error ? error.stack : String(error));
			throw error;
		}
	}

	/**
	 * Records performance metrics
	 */
	private recordMetrics(metrics: PerformanceMetrics): void {
		this.metrics.push(metrics);

		// Maintain history limit
		if (this.metrics.length > this.maxMetricsHistory) {
			this.metrics.shift();
		}
	}

	/**
	 * Gets performance statistics
	 *
	 * @param operation - Optional operation filter
	 * @param timeRange - Time range in milliseconds (default: 1 hour)
	 * @returns PerformanceStats - Statistics for the period
	 */
	public getStats(operation?: string, timeRange: number = DEFAULT_STATS_TIME_RANGE_MS): PerformanceStats {
		const now = Date.now();
		const cutoff = now - timeRange;

		const relevantMetrics = this.metrics.filter(m =>
			m.startTime.getTime() >= cutoff &&
			(!operation || m.operation === operation),
		);

		if (relevantMetrics.length === 0) {
			return {
				totalOperations: 0,
				averageDuration: 0,
				minDuration: 0,
				maxDuration: 0,
				errorRate: 0,
				operationsPerSecond: 0,
			};
		}

		const durations = relevantMetrics.map(m => m.duration);
		const errors = relevantMetrics.filter(m => !m.success).length;

		const totalDuration = durations.reduce((sum, d) => sum + d, 0);
		const timeSpanSeconds = timeRange / MILLISECONDS_TO_SECONDS;

		return {
			totalOperations: relevantMetrics.length,
			averageDuration: totalDuration / relevantMetrics.length,
			minDuration: Math.min(...durations),
			maxDuration: Math.max(...durations),
			errorRate: errors / relevantMetrics.length,
			operationsPerSecond: relevantMetrics.length / timeSpanSeconds,
		};
	}

	/**
	 * Gets recent metrics
	 *
	 * @param limit - Maximum number of metrics to return
	 * @param operation - Optional operation filter
	 * @returns PerformanceMetrics[] - Recent metrics
	 */
	public getRecentMetrics(limit: number = DEFAULT_RECENT_METRICS_LIMIT, operation?: string): PerformanceMetrics[] {
		return this.metrics
			.filter(m => !operation || m.operation === operation)
			.slice(-limit)
			.reverse(); // Most recent first
	}

	/**
	 * Gets slow operations
	 *
	 * @param threshold - Duration threshold in milliseconds
	 * @param limit - Maximum number to return
	 * @returns PerformanceMetrics[] - Slow operations
	 */
	public getSlowOperations(threshold: number = SLOW_OPERATION_THRESHOLD_MS, limit: number = DEFAULT_SLOW_OPERATIONS_LIMIT): PerformanceMetrics[] {
		return this.metrics
			.filter(m => m.duration >= threshold)
			.sort((a, b) => b.duration - a.duration)
			.slice(0, limit);
	}

	/**
	 * Gets error metrics
	 *
	 * @param limit - Maximum number to return
	 * @returns PerformanceMetrics[] - Failed operations
	 */
	public getErrors(limit: number = DEFAULT_ERRORS_LIMIT): PerformanceMetrics[] {
		return this.metrics
			.filter(m => !m.success)
			.slice(-limit)
			.reverse(); // Most recent first
	}

	/**
	 * Clears all metrics
	 */
	public clearMetrics(): void {
		this.metrics.length = 0;
		this.logger.info('Performance metrics cleared');
	}

	/**
	 * Gets operations summary
	 *
	 * @returns Object with operation counts
	 */
	public getOperationsSummary(): Record<string, { count: number; avgDuration: number; errorRate: number }> {
		const summary: Record<string, { durations: number[]; errors: number; count: number }> = {};

		for (const metric of this.metrics) {
			const opSummary = summary[metric.operation] ?? (summary[metric.operation] = { durations: [], errors: 0, count: 0 });

			opSummary.durations.push(metric.duration);
			opSummary.count++;
			if (!metric.success) {
				opSummary.errors++;
			}
		}

		const result: Record<string, { count: number; avgDuration: number; errorRate: number }> = {};

		for (const [operation, data] of Object.entries(summary)) {
			const avgDuration = data.durations.length > 0 ? data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length : 0;
			result[operation] = {
				count: data.count,
				avgDuration,
				errorRate: data.count > 0 ? data.errors / data.count : 0,
			};
		}

		return result;
	}
}
