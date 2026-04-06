/**
 * Metrics exporter interface types for @pawells/nestjs-shared
 *
 * Provides standardized interfaces for exporting metrics to different backends
 * (Prometheus, OpenTelemetry, etc.)
 */

/**
 * Supported metric instrument types
 *
 * @example
 * ```typescript
 * type CounterType = 'counter'; // Always incrementing
 * type HistogramType = 'histogram'; // Distribution of values
 * type GaugeType = 'gauge'; // Instantaneous value
 * type CounterWithDownType = 'updown_counter'; // Can increment or decrement
 * ```
 */
export type TMetricType = 'counter' | 'histogram' | 'gauge' | 'updown_counter';

/**
 * Metric descriptor — registered once per metric, defines the shape of the metric
 *
 * A descriptor uniquely identifies a metric and specifies its properties. Descriptors
 * are typically registered once during application startup and reused for all
 * subsequent metric recordings.
 *
 * @property name - Unique identifier for the metric (e.g., 'http_request_duration_seconds')
 * @property type - The kind of metric instrument
 * @property help - Human-readable description of what the metric measures
 * @property labelNames - Names of labels/tags associated with this metric
 *   (e.g., ['method', 'route', 'status_code'])
 * @property buckets - Histogram bucket boundaries (histogram type only).
 *   Defaults to exponential buckets if not specified.
 * @property unit - Optional unit of measurement (e.g., 'seconds', 'bytes', 'requests')
 *
 * @example
 * ```typescript
 * const httpDurationDescriptor: IMetricDescriptor = {
 *   name: 'http_request_duration_seconds',
 *   type: 'histogram',
 *   help: 'Duration of HTTP requests in seconds',
 *   labelNames: ['method', 'route', 'status_code'],
 *   buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
 *   unit: 'seconds',
 * };
 * ```
 */
export interface IMetricDescriptor {
	/**
	 * Unique identifier for the metric
	 * Convention: snake_case with unit suffix (e.g., 'request_duration_seconds')
	 */
	name: string;

	/**
	 * Type of metric instrument
	 */
	type: TMetricType;

	/**
	 * Human-readable description
	 */
	help: string;

	/**
	 * Names of labels/tags for this metric
	 * Labels provide dimensions for filtering and aggregating metric values
	 */
	labelNames: string[];

	/**
	 * Histogram bucket boundaries
	 * Only used for 'histogram' type metrics.
	 * Buckets should be in ascending order.
	 */
	buckets?: number[];

	/**
	 * Unit of measurement
	 * Used by exporters for formatting and can be included in metric names
	 */
	unit?: string;
}

/**
 * Metric value — emitted each time a metric is recorded
 *
 * Represents a single data point for a metric at a specific point in time.
 * Each value includes the descriptor, numeric value, labels (tag values),
 * and a timestamp.
 *
 * @property descriptor - The metric descriptor that defines this value's shape
 * @property value - The numeric value of the metric (always a number)
 * @property labels - Label values paired with the metric. Keys must match
 *   the descriptor's labelNames. Values are typically strings but can be
 *   numbers for performance.
 * @property timestamp - Performance timestamp (milliseconds since start, from performance.now())
 *   Used for ordering and time-series analysis.
 *
 * @example
 * ```typescript
 * const httpDurationValue: IMetricValue = {
 *   descriptor: httpDurationDescriptor,
 *   value: 0.125,  // seconds
 *   labels: {
 *     method: 'GET',
 *     route: '/api/users',
 *     status_code: '200',
 *   },
 *   timestamp: performance.now(),
 * };
 * ```
 */
export interface IMetricValue {
	/**
	 * Descriptor that defines this metric's structure
	 */
	descriptor: IMetricDescriptor;

	/**
	 * Numeric value of the metric
	 * Range depends on metric type:
	 * - counter: >= 0 (always increasing)
	 * - gauge: any number
	 * - histogram: any number (typically distribution measure)
	 * - updown_counter: any number (can increase or decrease)
	 */
	value: number;

	/**
	 * Label values paired with the metric
	 * Keys correspond to descriptor.labelNames
	 * Values are typically strings but can be numbers
	 */
	labels: Record<string, string | number>;

	/**
	 * Performance timestamp in milliseconds (from performance.now())
	 * Used for ordering, trending, and time-series analysis
	 */
	timestamp: number;
}

/**
 * Metrics exporter interface
 *
 * Implemented by exporters that handle metric collection and export to external systems
 * (Prometheus, OpenTelemetry, CloudWatch, etc.).
 *
 * An exporter can support two modes:
 * - **Event-based** (`SupportsEventBased`): Receives metrics as they're recorded
 * - **Pull-based** (`SupportsPull`): Provides metrics on-demand during scrape/pull requests
 *
 * @example
 * ```typescript
 * // Prometheus exporter (event-based push + pull-based scrape)
 * class PrometheusExporter implements IMetricsExporter {
 *   readonly SupportsEventBased = true;
 *   readonly SupportsPull = true;
 *
 *   onMetricRecorded(value: IMetricValue) {
 *     // Update Prometheus registry
 *     this.Registry.observe(value);
 *   }
 *
 *   getMetrics(): string {
 *     // Return Prometheus text format
 *     return this.Registry.metrics();
 *   }
 * }
 *
 * // OpenTelemetry exporter (event-based only)
 * class OTelExporter implements IMetricsExporter {
 *   readonly SupportsEventBased = true;
 *   readonly SupportsPull = false;
 *
 *   onMetricRecorded(value: IMetricValue) {
 *     // Send to OTEL collector
 *     this.Client.send(value);
 *   }
 * }
 * ```
 */
export interface IMetricsExporter {
	/**
	 * Whether this exporter wants to be called synchronously on each metric recording
	 *
	 * If true, onMetricRecorded() will be called for every metric value recorded.
	 * Used for active/eager exporters like Prometheus that maintain in-memory registries.
	 *
	 * @readonly
	 */
	readonly SupportsEventBased: boolean;

	/**
	 * Whether this exporter supports pull-based reads (e.g., Prometheus scrape endpoint)
	 *
	 * If true, getMetrics() can be called to retrieve current metric values on-demand.
	 * Used for Prometheus-style scrape endpoints.
	 *
	 * @readonly
	 */
	readonly SupportsPull: boolean;

	/**
	 * Called when a metric value is recorded
	 *
	 * Only called if SupportsEventBased = true.
	 * Implementations should process the metric quickly to avoid blocking the request.
	 * If processing needs to be async, implementations should queue work and return immediately.
	 *
	 * @param value - The metric value being recorded
	 *
	 * @example
	 * ```typescript
	 * onMetricRecorded(value: IMetricValue): void {
	 *   // Update in-memory registry
	 *   const Key = this.buildKey(value);
	 *   this.Registry.update(key, value);
	 *
	 *   // If async work needed, queue it
	 *   this.queue.push(value);
	 * }
	 * ```
	 */
	onMetricRecorded?(value: IMetricValue): void;

	/**
	 * Called when a new metric descriptor is registered
	 *
	 * Exporters can use this hook to pre-create instruments or validate that
	 * they support the metric type. Implementations should be fast.
	 *
	 * @param descriptor - The metric descriptor being registered
	 *
	 * @example
	 * ```typescript
	 * onDescriptorRegistered(descriptor: IMetricDescriptor): void {
	 *   // Pre-create Prometheus gauge/counter/histogram
	 *   this.Registry.register(descriptor);
	 * }
	 * ```
	 */
	onDescriptorRegistered?(descriptor: IMetricDescriptor): void;

	/**
	 * Retrieve all current metric values (pull-based)
	 *
	 * Only required if SupportsPull = true.
	 * Called by scrape endpoints or pull-based collectors to fetch metrics.
	 * Should return metrics in the format expected by the external system
	 * (e.g., Prometheus text format, JSON, etc.).
	 *
	 * @returns Current metrics in the exporter's format (string, or Promise<string>)
	 *
	 * @example
	 * ```typescript
	 * // Prometheus exporter
	 * getMetrics(): string {
	 *   return this.Registry.metrics(); // Returns Prometheus text format
	 * }
	 *
	 * // Async exporter
	 * getMetrics(): Promise<string> {
	 *   return this.Client.fetchMetrics(); // Fetch from remote backend
	 * }
	 * ```
	 */
	getMetrics?(): Promise<string> | string;

	/**
	 * Called on application shutdown
	 *
	 * Exporters should use this hook to flush buffered metrics, close connections,
	 * and clean up resources.
	 *
	 * @returns Optional promise (for async cleanup)
	 *
	 * @example
	 * ```typescript
	 * shutdown(): Promise<void> {
	 *   return Promise.all([
	 *     this.Client.flush(),
	 *     this.Client.close(),
	 *   ]);
	 * }
	 * ```
	 */
	shutdown?(): Promise<void> | void;
}
