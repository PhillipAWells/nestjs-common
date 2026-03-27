import { Counter, Gauge, Histogram } from 'prom-client';
import { AppLogger } from '../services/logger.service.js';
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
 *   protected initializeMetrics(): void {
 *     this.registerCounter('stream_created', 'Total streams created', ['region']);
 *     this.registerGauge('active_streams', 'Currently active streams', ['region']);
 *     this.registerHistogram('stream_duration', 'Stream duration in seconds', ['region']);
 *   }
 * }
 *
 * const collector = new StreamMetricsCollector(metricsRegistry);
 * ```
 */
export abstract class BaseMetricsCollector {
	protected readonly logger: AppLogger = new AppLogger(undefined, this.constructor.name);

	private readonly metricsRegistry: MetricsRegistryService;

	private readonly metrics: Map<string, Counter<string> | Gauge<string> | Histogram<string>> = new Map();

	constructor(metricsRegistry: MetricsRegistryService) {
		this.metricsRegistry = metricsRegistry;
		this.initializeMetrics();
		this.logger.info(`${this.constructor.name} initialized with ${this.metrics.size} metrics`);
	}

	/**
	 * Initialize metrics for this collector.
	 * Subclasses must implement this method to register their custom metrics.
	 *
	 * @example
	 * protected initializeMetrics(): void {
	 *   this.registerCounter('events_processed', 'Total events processed');
	 *   this.registerGauge('queue_depth', 'Current queue depth');
	 * }
	 */
	protected abstract initializeMetrics(): void;

	/**
	 * Register a counter metric.
	 *
	 * @param name - The metric name (e.g., 'requests_total')
	 * @param help - Help text describing the metric
	 * @param labelNames - Optional label names for the metric
	 * @returns The registered counter metric
	 */
	protected registerCounter(name: string, help: string, labelNames: string[] = []): Counter<string> {
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
	protected registerGauge(name: string, help: string, labelNames: string[] = []): Gauge<string> {
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
	protected registerHistogram(
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
	public getMetric(name: string): Counter<string> | Gauge<string> | Histogram<string> | undefined {
		return this.metrics.get(name);
	}

	/**
	 * Get all registered metrics.
	 *
	 * @returns A Map of all registered metrics keyed by name
	 */
	public getAllMetrics(): Map<string, Counter<string> | Gauge<string> | Histogram<string>> {
		return new Map(this.metrics);
	}
}
