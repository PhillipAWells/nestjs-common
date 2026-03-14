import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
	METRICS_STATUS_OK,
	METRICS_STATUS_REDIRECT_MIN,
	PROFILING_RESPONSE_TIME_PRECISION,
} from '../constants/profiling.constants.js';

/**
 * Metrics response interface for profiling data.
 *
 * Contains aggregated profiling metrics including CPU samples, memory allocations,
 * and HTTP request statistics.
 */
export interface MetricsResponse {
	timestamp: number;
	cpu: {
		samples: number;
		duration: number;
	};
	memory: {
		samples: number;
		allocations: number;
	};
	requests: {
		total: number;
		successful: number;
		failed: number;
		averageResponseTime: number;
	};
}

/**
 * Service for tracking profiling metrics.
 *
 * Provides thread-safe metric aggregation and export functionality for CPU samples,
 * memory allocations, and HTTP request performance statistics. Metrics are accumulated
 * and can be exported in both JSON and Prometheus exposition formats.
 *
 * Features:
 * - CPU and memory sample recording
 * - Request metrics with status code classification
 * - Prometheus format metrics export
 * - Metric reset capability
 *
 * @example
 * ```typescript
 * // Record individual metrics
 * this.metrics.recordCPUSample(125);
 * this.metrics.recordMemorySample(1024000);
 * this.metrics.recordRequest(200, 45);
 *
 * // Retrieve aggregated metrics
 * const stats = this.metrics.getMetrics();
 * const prometheus = this.metrics.getPrometheusMetrics();
 * ```
 */
@Injectable()
export class MetricsService {
	constructor(public readonly Module: ModuleRef) {}

	private readonly logger = new Logger(MetricsService.name);

	// CPU metrics
	private cpuSamples = 0;

	private totalCpuDuration = 0;

	// Memory metrics
	private memorySamples = 0;

	private totalMemoryAllocations = 0;

	// Request metrics
	private totalRequests = 0;

	private successfulRequests = 0;

	private failedRequests = 0;

	private totalResponseTime = 0;

	/**
	 * Record CPU profiling sample
	 * @param duration Duration of CPU sample in milliseconds
	 */
	public recordCPUSample(duration: number): void {
		if (duration < 0) {
			this.logger.warn('Invalid CPU duration provided, ignoring sample');
			return;
		}

		this.cpuSamples++;
		this.totalCpuDuration += duration;
	}

	/**
	 * Record memory profiling sample
	 * @param bytes Memory allocation in bytes
	 */
	public recordMemorySample(bytes: number): void {
		if (bytes < 0) {
			this.logger.warn('Invalid memory allocation provided, ignoring sample');
			return;
		}

		this.memorySamples++;
		this.totalMemoryAllocations += bytes;
	}

	/**
	 * Record request metrics
	 * @param statusCode HTTP status code
	 * @param duration Response time in milliseconds
	 */
	public recordRequest(statusCode: number, duration: number): void {
		if (duration < 0) {
			this.logger.warn('Invalid request duration provided, ignoring sample');
			return;
		}

		this.totalRequests++;
		this.totalResponseTime += duration;

		if (statusCode >= METRICS_STATUS_OK && statusCode < METRICS_STATUS_REDIRECT_MIN) {
			this.successfulRequests++;
		} else {
			this.failedRequests++;
		}
	}

	/**
	 * Get current metrics snapshot.
	 *
	 * Returns aggregated metrics from all recorded samples since service creation
	 * or last reset.
	 *
	 * @returns MetricsResponse with current aggregated metrics
	 *
	 * @example
	 * ```typescript
	 * const metrics = this.metricsService.getMetrics();
	 * console.log(`Processed ${metrics.requests.total} requests`);
	 * console.log(`CPU time: ${metrics.cpu.duration}ms across ${metrics.cpu.samples} samples`);
	 * ```
	 */
	public getMetrics(): MetricsResponse {
		const averageResponseTime = this.totalRequests > 0
			? this.totalResponseTime / this.totalRequests
			: 0;

		return {
			timestamp: Date.now(),
			cpu: {
				samples: this.cpuSamples,
				duration: this.totalCpuDuration,
			},
			memory: {
				samples: this.memorySamples,
				allocations: this.totalMemoryAllocations,
			},
			requests: {
				total: this.totalRequests,
				successful: this.successfulRequests,
				failed: this.failedRequests,

				averageResponseTime: Math.round(averageResponseTime * PROFILING_RESPONSE_TIME_PRECISION) / PROFILING_RESPONSE_TIME_PRECISION, // Round to 2 decimal places
			},
		};
	}

	/**
	 * Export metrics in Prometheus format.
	 *
	 * Formats aggregated metrics as Prometheus exposition format (text-based format)
	 * suitable for ingestion by Prometheus servers.
	 *
	 * @returns String containing metrics in Prometheus exposition format
	 *
	 * @example
	 * ```typescript
	 * const prometheusMetrics = this.metricsService.getPrometheusMetrics();
	 * // Returns:
	 * // # HELP profiling_cpu_samples_total Total number of CPU profiling samples collected
	 * // # TYPE profiling_cpu_samples_total counter
	 * // profiling_cpu_samples_total 1250
	 * // ...
	 * ```
	 */
	public getPrometheusMetrics(): string {
		const metrics = this.getMetrics();

		return `# HELP profiling_cpu_samples_total Total number of CPU profiling samples collected
# TYPE profiling_cpu_samples_total counter
profiling_cpu_samples_total ${metrics.cpu.samples}

# HELP profiling_cpu_duration_total Total CPU profiling duration in milliseconds
# TYPE profiling_cpu_duration_total counter
profiling_cpu_duration_total ${metrics.cpu.duration}

# HELP profiling_memory_samples_total Total number of memory profiling samples collected
# TYPE profiling_memory_samples_total counter
profiling_memory_samples_total ${metrics.memory.samples}

# HELP profiling_memory_allocations_total Total memory allocations in bytes
# TYPE profiling_memory_allocations_total counter
profiling_memory_allocations_total ${metrics.memory.allocations}

# HELP profiling_requests_total Total number of requests profiled
# TYPE profiling_requests_total counter
profiling_requests_total ${metrics.requests.total}

# HELP profiling_requests_successful_total Total number of successful requests
# TYPE profiling_requests_successful_total counter
profiling_requests_successful_total ${metrics.requests.successful}

# HELP profiling_requests_failed_total Total number of failed requests
# TYPE profiling_requests_failed_total counter
profiling_requests_failed_total ${metrics.requests.failed}

# HELP profiling_requests_average_response_time_ms Average response time in milliseconds
# TYPE profiling_requests_average_response_time_ms gauge
profiling_requests_average_response_time_ms ${metrics.requests.averageResponseTime}
`;
	}

	/**
	 * Reset all metrics to zero.
	 *
	 * Clears all accumulated metrics, useful for testing or periodic metric resets.
	 *
	 * @example
	 * ```typescript
	 * this.metricsService.reset();
	 * // All metrics are now zero
	 * ```
	 */
	public reset(): void {
		this.cpuSamples = 0;
		this.totalCpuDuration = 0;
		this.memorySamples = 0;
		this.totalMemoryAllocations = 0;
		this.totalRequests = 0;
		this.successfulRequests = 0;
		this.failedRequests = 0;
		this.totalResponseTime = 0;

		this.logger.debug('All profiling metrics have been reset');
	}
}
