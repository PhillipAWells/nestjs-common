import { Logger } from '@nestjs/common';
import { Counter, Gauge, Histogram } from 'prom-client';
import { MetricsRegistryService } from '../services/metrics-registry.service.js';

/**
 * BaseMetricsCollector
 *
 * Abstract base class for domain-specific metrics collection. Services can extend this class
 * to define custom Prometheus metrics that are registered with the centralized MetricsRegistryService.
 *
 * Usage:
 * ```typescript
 * class StreamMetricsCollector extends BaseMetricsCollector {
 *   protected InitializeMetrics(): void {
 *     this.RegisterCounter('stream_created', 'Total streams created', ['region']);
 *     this.RegisterGauge('active_streams', 'Currently active streams', ['region']);
 *     this.RegisterHistogram('stream_duration', 'Stream duration in seconds', ['region']);
 *   }
 * }
 *
 * const collector = new StreamMetricsCollector(metricsRegistry);
 * ```
 */
export abstract class BaseMetricsCollector {
	protected readonly logger = new Logger(this.constructor.name);

	private readonly metricsRegistry: MetricsRegistryService;

	private readonly metrics: Map<string, Counter<string> | Gauge<string> | Histogram<string>> = new Map();

	constructor(metricsRegistry: MetricsRegistryService) {
		this.metricsRegistry = metricsRegistry;
		this.InitializeMetrics();
		this.logger.log(`${this.constructor.name} initialized with ${this.metrics.size} metrics`);
	}

	/**
	 * Initialize metrics for this collector.
	 * Subclasses must implement this method to register their custom metrics.
	 *
	 * @example
	 * protected InitializeMetrics(): void {
	 *   this.RegisterCounter('events_processed', 'Total events processed');
	 *   this.RegisterGauge('queue_depth', 'Current queue depth');
	 * }
	 */
	protected abstract InitializeMetrics(): void;

	/**
	 * Register a counter metric.
	 *
	 * @param name - The metric name (e.g., 'requests_total')
	 * @param help - Help text describing the metric
	 * @param labelNames - Optional label names for the metric
	 * @returns The registered counter metric
	 */
	protected RegisterCounter(name: string, help: string, labelNames: string[] = []): Counter<string> {
		const counter = this.metricsRegistry.createCounter(name, help, labelNames);
		this.metrics.set(name, counter);
		return counter;
	}

	/**
	 * Register a gauge metric.
	 *
	 * @param name - The metric name (e.g., 'queue_size')
	 * @param help - Help text describing the metric
	 * @param labelNames - Optional label names for the metric
	 * @returns The registered gauge metric
	 */
	protected RegisterGauge(name: string, help: string, labelNames: string[] = []): Gauge<string> {
		const gauge = this.metricsRegistry.createGauge(name, help, labelNames);
		this.metrics.set(name, gauge);
		return gauge;
	}

	/**
	 * Register a histogram metric.
	 *
	 * @param name - The metric name (e.g., 'request_duration')
	 * @param help - Help text describing the metric
	 * @param labelNames - Optional label names for the metric
	 * @param buckets - Optional bucket boundaries for the histogram
	 * @returns The registered histogram metric
	 */
	protected RegisterHistogram(
		name: string,
		help: string,
		labelNames: string[] = [],
		buckets?: number[],
	): Histogram<string> {
		const histogram = this.metricsRegistry.createHistogram(name, help, labelNames, buckets);
		this.metrics.set(name, histogram);
		return histogram;
	}

	/**
	 * Get a registered metric by name.
	 *
	 * @param name - The metric name
	 * @returns The metric instance, or undefined if not found
	 */
	public GetMetric(name: string): Counter<string> | Gauge<string> | Histogram<string> | undefined {
		return this.metrics.get(name);
	}

	/**
	 * Get all registered metrics.
	 *
	 * @returns A Map of all registered metrics keyed by name
	 */
	public GetAllMetrics(): Map<string, Counter<string> | Gauge<string> | Histogram<string>> {
		return new Map(this.metrics);
	}
}
