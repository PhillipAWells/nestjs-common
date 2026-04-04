import { Injectable } from '@nestjs/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import {
	METRICS_STATUS_OK,
	METRICS_STATUS_CLIENT_ERROR_MIN,
	PROFILING_RESPONSE_TIME_PRECISION,
} from '../constants/profiling.constants.js';

/**
 * Metrics response interface for profiling data.
 *
 * Contains aggregated profiling metrics including CPU samples, memory allocations,
 * and HTTP request statistics.
 */
export interface IMetricsResponse {
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
 * this.Metrics.recordCPUSample(125);
 * this.Metrics.recordMemorySample(1024000);
 * this.Metrics.recordRequest(200, 45);
 *
 * // Retrieve aggregated metrics
 * const stats = this.Metrics.getMetrics();
 * const prometheus = this.Metrics.getPrometheusMetrics();
 * ```
 */
@Injectable()
export class MetricsService {
	private readonly Logger = new AppLogger(undefined, MetricsService.name);

	// CPU metrics
	private CpuSamples = 0;

	private TotalCpuDuration = 0;

	// Memory metrics
	private MemorySamples = 0;

	private TotalMemoryAllocations = 0;

	// Request metrics
	private TotalRequests = 0;

	private SuccessfulRequests = 0;

	private FailedRequests = 0;

	private TotalResponseTime = 0;

	constructor() {}

	/**
	 * Record CPU profiling sample
	 * @param duration Duration of CPU sample in milliseconds
	 */
	public RecordCPUSample(duration: number): void {
		if (duration < 0) {
			this.Logger.warn('Invalid CPU duration provided, ignoring sample');
			return;
		}

		this.CpuSamples++;
		this.TotalCpuDuration += duration;
	}

	/**
	 * Record memory profiling sample
	 * @param bytes Memory allocation in bytes
	 */
	public RecordMemorySample(bytes: number): void {
		if (bytes < 0) {
			this.Logger.warn('Invalid memory allocation provided, ignoring sample');
			return;
		}

		this.MemorySamples++;
		this.TotalMemoryAllocations += bytes;
	}

	/**
	 * Record request metrics
	 * @param statusCode HTTP status code
	 * @param duration Response time in milliseconds
	 */
	public RecordRequest(statusCode: number, duration: number): void {
		if (duration < 0) {
			this.Logger.warn('Invalid request duration provided, ignoring sample');
			return;
		}

		this.TotalRequests++;
		this.TotalResponseTime += duration;

		if (statusCode >= METRICS_STATUS_OK && statusCode < METRICS_STATUS_CLIENT_ERROR_MIN) {
			this.SuccessfulRequests++;
		} else {
			this.FailedRequests++;
		}
	}

	/**
	 * Get current metrics snapshot.
	 *
	 * Returns aggregated metrics from all recorded samples since service creation
	 * or last reset.
	 *
	 * @returns IMetricsResponse with current aggregated metrics
	 *
	 * @example
	 * ```typescript
	 * const metrics = this.MetricsService.getMetrics();
	 * console.log(`Processed ${metrics.requests.total} requests`);
	 * console.log(`CPU time: ${metrics.cpu.duration}ms across ${metrics.cpu.samples} samples`);
	 * ```
	 */
	public GetMetrics(): IMetricsResponse {
		const AverageResponseTime = this.TotalRequests > 0
			? this.TotalResponseTime / this.TotalRequests
			: 0;

		return {
			timestamp: Date.now(),
			cpu: {
				samples: this.CpuSamples,
				duration: this.TotalCpuDuration,
			},
			memory: {
				samples: this.MemorySamples,
				allocations: this.TotalMemoryAllocations,
			},
			requests: {
				total: this.TotalRequests,
				successful: this.SuccessfulRequests,
				failed: this.FailedRequests,

				averageResponseTime: Math.round(AverageResponseTime * PROFILING_RESPONSE_TIME_PRECISION) / PROFILING_RESPONSE_TIME_PRECISION, // Round to 2 decimal places
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
	 * const prometheusMetrics = this.MetricsService.getPrometheusMetrics();
	 * // Returns:
	 * // # HELP profiling_cpu_samples_total Total number of CPU profiling samples collected
	 * // # TYPE profiling_cpu_samples_total counter
	 * // profiling_cpu_samples_total 1250
	 * // ...
	 * ```
	 */
	public GetPrometheusMetrics(): string {
		const Metrics = this.GetMetrics();

		return `# HELP profiling_cpu_samples_total Total number of CPU profiling samples collected
# TYPE profiling_cpu_samples_total counter
profiling_cpu_samples_total ${Metrics.cpu.samples}

# HELP profiling_cpu_duration_total Total CPU profiling duration in milliseconds
# TYPE profiling_cpu_duration_total counter
profiling_cpu_duration_total ${Metrics.cpu.duration}

# HELP profiling_memory_samples_total Total number of memory profiling samples collected
# TYPE profiling_memory_samples_total counter
profiling_memory_samples_total ${Metrics.memory.samples}

# HELP profiling_memory_allocations_total Total memory allocations in bytes
# TYPE profiling_memory_allocations_total counter
profiling_memory_allocations_total ${Metrics.memory.allocations}

# HELP profiling_requests_total Total number of requests profiled
# TYPE profiling_requests_total counter
profiling_requests_total ${Metrics.requests.total}

# HELP profiling_requests_successful_total Total number of successful requests
# TYPE profiling_requests_successful_total counter
profiling_requests_successful_total ${Metrics.requests.successful}

# HELP profiling_requests_failed_total Total number of failed requests
# TYPE profiling_requests_failed_total counter
profiling_requests_failed_total ${Metrics.requests.failed}

# HELP profiling_requests_average_response_time_ms Average response time in milliseconds
# TYPE profiling_requests_average_response_time_ms gauge
profiling_requests_average_response_time_ms ${Metrics.requests.averageResponseTime}
`;
	}

	/**
	 * Reset all metrics to zero.
	 *
	 * Clears all accumulated metrics, useful for testing or periodic metric resets.
	 *
	 * @example
	 * ```typescript
	 * this.MetricsService.reset();
	 * // All metrics are now zero
	 * ```
	 */
	public Reset(): void {
		this.CpuSamples = 0;
		this.TotalCpuDuration = 0;
		this.MemorySamples = 0;
		this.TotalMemoryAllocations = 0;
		this.TotalRequests = 0;
		this.SuccessfulRequests = 0;
		this.FailedRequests = 0;
		this.TotalResponseTime = 0;

		this.Logger.debug('All profiling metrics have been reset');
	}
}
