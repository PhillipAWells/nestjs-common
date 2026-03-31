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
	protected readonly Logger: AppLogger = new AppLogger(undefined, this.constructor.name);

	private readonly MetricsRegistry: MetricsRegistryService;

	private readonly Metrics: Map<string, Counter<string> | Gauge<string> | Histogram<string>> = new Map();

	constructor(metricsRegistry: MetricsRegistryService) {
		this.MetricsRegistry = metricsRegistry;
		this.InitializeMetrics();
		this.Logger.info(`${this.constructor.name} initialized with ${this.Metrics.size} metrics`);
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
		const Counter = this.MetricsRegistry.CreateCounter(name, help, labelNames);
		this.Metrics.set(name, Counter);
		return Counter;
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
		const Gauge = this.MetricsRegistry.CreateGauge(name, help, labelNames);
		this.Metrics.set(name, Gauge);
		return Gauge;
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
		const Histogram = this.MetricsRegistry.CreateHistogram(name, help, labelNames, buckets);
		this.Metrics.set(name, Histogram);
		return Histogram;
	}

	/**
	 * Get a registered metric by name.
	 *
	 * @param name - The metric name
	 * @returns The metric instance, or undefined if not found
	 */
	public GetMetric(name: string): Counter<string> | Gauge<string> | Histogram<string> | undefined {
		return this.Metrics.get(name);
	}

	/**
	 * Get all registered metrics.
	 *
	 * @returns A Map of all registered metrics keyed by name
	 */
	public GetAllMetrics(): Map<string, Counter<string> | Gauge<string> | Histogram<string>> {
		return new Map(this.Metrics);
	}
}
