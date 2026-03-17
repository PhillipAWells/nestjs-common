import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import type { IMetricsExporter, MetricDescriptor, MetricValue } from '@pawells/nestjs-shared';

/**
 * Prometheus metrics exporter implementation
 *
 * Implements the IMetricsExporter interface for Prometheus pull-based metrics collection.
 * Uses prom-client library to manage Prometheus instruments (Counter, Gauge, Histogram)
 * and exports metrics in Prometheus text format on demand.
 *
 * Architecture:
 * - **Event-based buffering**: Metric values are buffered as they are recorded
 * - **Pull-based export**: Flushes all pending values when `/metrics` endpoint is scraped
 * - **Atomic swaps**: Uses atomic array swaps during flush to prevent concurrent data loss
 * - **Bounded memory**: Limits pending values to 1000 per metric to prevent unbounded growth
 * - **Node.js defaults**: Automatically collects Node.js process metrics (CPU, memory, GC, etc.)
 *
 * Type mapping:
 * - `counter` → prom-client Counter (monotonically increasing)
 * - `gauge` → prom-client Gauge (point-in-time value)
 * - `updown_counter` → prom-client Gauge (can increase or decrease)
 * - `histogram` → prom-client Histogram (distribution with buckets)
 *
 * @example
 * ```typescript
 * const exporter = new PrometheusExporter();
 * registry.registerExporter(exporter);
 *
 * // Later, get metrics for Prometheus scrape endpoint
 * const prometheusMetrics = await exporter.getMetrics();
 * ```
 */
@Injectable()
export class PrometheusExporter implements IMetricsExporter {
	/**
	 * This exporter buffers metric values as they are recorded and flushes
	 * them into prom-client instruments on each pull (getMetrics)
	 */
	public readonly supportsEventBased = true;

	/**
	 * This exporter supports pull-based metric retrieval
	 */
	public readonly supportsPull = true;

	/**
	 * Prom-client Registry instance for managing instruments
	 * @private
	 */
	private readonly registry: Registry;

	/**
	 * Cache of created prom-client instruments (Counter, Histogram, Gauge)
	 * Keyed by metric name
	 * @private
	 */
	private readonly instruments: Map<string, Counter<string> | Histogram<string> | Gauge<string>>;

	/**
	 * Pending metric values to be flushed into prom-client instruments on next getMetrics()
	 * Keyed by metric name
	 * @private
	 */
	private readonly pending: Map<string, MetricValue[]>;

	/**
	 * Running totals for updown_counter metrics (persistent across scrapes)
	 * Keyed by metric name, then by normalized label key
	 * @private
	 */
	private readonly gaugeValues: Map<string, Map<string, number>>;

	/**
	 * Maximum number of pending metric values per metric before culling oldest entries
	 * Prevents unbounded memory growth if metrics are recorded much faster than pulled
	 * @private
	 */
	// eslint-disable-next-line no-magic-numbers
	private static readonly MAX_PENDING_PER_METRIC = 1000;

	/**
	 * Logger instance for warnings and errors
	 */
	private readonly logger: AppLogger;

	/**
	 * Normalize label keys to handle consistent ordering regardless of insertion order
	 * @private
	 */
	private static normalizeLabelKey(labels: Record<string, string | number>): string {
		const sortedEntries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
		return JSON.stringify(Object.fromEntries(sortedEntries));
	}

	/**
	 * Create a new PrometheusExporter instance
	 *
	 * Initializes a prom-client Registry and starts collecting Node.js default metrics
	 * (process CPU, memory, event loop, garbage collection, etc.).
	 */
	constructor() {
		this.registry = new Registry();
		this.instruments = new Map();
		this.pending = new Map();
		this.gaugeValues = new Map();
		this.logger = new AppLogger(undefined, PrometheusExporter.name);

		// Collect Node.js default metrics into our registry
		collectDefaultMetrics({ register: this.registry });
	}

	/**
	 * Called when a metric descriptor is registered in InstrumentationRegistry
	 *
	 * Pre-creates the corresponding prom-client instrument (Counter, Gauge, or Histogram)
	 * based on the descriptor's type. The created instrument is cached for future use.
	 * Initializes an empty pending array for the metric to buffer future recorded values.
	 *
	 * Type mapping:
	 * - `counter` → Counter (incremented by value via inc())
	 * - `histogram` → Histogram (observed via observe())
	 * - `gauge` or `updown_counter` → Gauge (set via set())
	 *
	 * @param descriptor - The metric descriptor being registered
	 * @throws Error if descriptor type is not supported
	 *
	 * @example
	 * ```typescript
	 * exporter.onDescriptorRegistered({
	 *   name: 'http_request_duration_seconds',
	 *   type: 'histogram',
	 *   help: 'Request duration in seconds',
	 *   labelNames: ['method', 'route', 'status_code'],
	 *   buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
	 * });
	 * ```
	 */
	public onDescriptorRegistered(descriptor: MetricDescriptor): void {
		const { name, type, help, labelNames, buckets } = descriptor;

		// Guard against duplicate registration
		if (this.instruments.has(name)) {
			return;
		}

		// Validate required fields
		if (!name) {
			this.logger.warn('Metric descriptor registered with empty name');
			return;
		}

		if (!help) {
			this.logger.warn(`Metric descriptor "${name}" registered with empty help text`);
			return;
		}

		let instrument: Counter<string> | Histogram<string> | Gauge<string>;

		switch (type) {
			case 'counter':
				instrument = new Counter({
					name,
					help,
					labelNames,
					registers: [this.registry],
				});
				break;

			case 'histogram':
				instrument = new Histogram({
					name,
					help,
					labelNames,
					buckets,
					registers: [this.registry],
				});
				break;

			case 'gauge':
			case 'updown_counter':
				// Both gauge and updown_counter map to prom-client Gauge
				instrument = new Gauge({
					name,
					help,
					labelNames,
					registers: [this.registry],
				});
				// Initialize running totals map for this metric
				if (type === 'updown_counter') {
					this.gaugeValues.set(name, new Map());
				}
				break;

			default:
				throw new Error(`Unsupported metric type "${type}" for descriptor "${name}"`);
		}

		this.instruments.set(name, instrument);
		this.pending.set(name, []);
	}

	/**
	 * Buffer a metric value to be flushed on next getMetrics() call
	 *
	 * Values are buffered rather than immediately recorded into prom-client.
	 * They are applied to the appropriate instrument during the next pull (getMetrics) call.
	 *
	 * Buffering behavior:
	 * - Values are appended to the pending array for the metric
	 * - If the pending array exceeds MAX_PENDING_PER_METRIC (1000), oldest entries are culled
	 * - If the metric descriptor was not registered first, a warning is logged and value is dropped
	 *
	 * @param value - The metric value to buffer
	 *
	 * @example
	 * ```typescript
	 * exporter.onMetricRecorded({
	 *   descriptor: { name: 'http_request_duration_seconds' },
	 *   value: 0.125,
	 *   labels: { method: 'GET', status_code: '200' },
	 *   timestamp: performance.now(),
	 * });
	 * ```
	 */
	public onMetricRecorded(value: MetricValue): void {
		const metricName = value.descriptor.name;
		const pendingArray = this.pending.get(metricName);

		if (pendingArray) {
			pendingArray.push(value);

			// Cap pending array to prevent unbounded memory growth
			if (pendingArray.length > PrometheusExporter.MAX_PENDING_PER_METRIC) {
				pendingArray.shift();
			}
		} else {
			// Warn if metric recorded before descriptor registration (data will be lost)
			this.logger.warn(`Metric recorded before descriptor registration: ${metricName}`);
		}
	}

	/**
	 * Retrieve all metrics in Prometheus text format
	 *
	 * Flushes all pending metric values into prom-client instruments, then returns
	 * the complete metrics output in Prometheus text format (version 0.0.4).
	 *
	 * Flush process:
	 * 1. For each metric, atomically swap the pending array with a fresh empty array
	 * 2. Apply all pending values to the corresponding instrument:
	 *    - Counter: increment by value
	 *    - Histogram: observe value
	 *    - Gauge: set to value
	 * 3. Skip any values where the instrument was not pre-created (shouldn't happen)
	 * 4. Return the serialized metrics from the registry
	 *
	 * Includes Node.js default metrics and all custom metrics registered with descriptors.
	 *
	 * @returns Promise resolving to metrics in Prometheus text format (version 0.0.4)
	 * @throws Error if metrics generation fails (logged but re-thrown)
	 *
	 * @example
	 * ```typescript
	 * const prometheusMetrics = await exporter.getMetrics();
	 * // Returns:
	 * // # HELP http_request_duration_seconds Duration of HTTP requests in seconds
	 * // # TYPE http_request_duration_seconds histogram
	 * // http_request_duration_seconds_bucket{le="0.001",...} 0
	 * // http_request_duration_seconds_bucket{le="0.01",...} 5
	 * ```
	 */
	public async getMetrics(): Promise<string> {
		// Flush all pending values into prom-client instruments
		// Use atomic swap pattern: capture current values and replace with empty array
		// to prevent loss of metrics recorded concurrently during flush
		for (const [metricName, pendingValues] of this.pending.entries()) {
			// Atomically swap pending array with a fresh one
			this.pending.set(metricName, []);

			if (pendingValues.length === 0) {
				continue;
			}

			const instrument = this.instruments.get(metricName);
			if (!instrument) {
				// Instrument not yet created, skip pending values
				continue;
			}

			// Record all pending values into the appropriate instrument
			if (instrument instanceof Counter) {
				// Counter: increment by value for each pending entry
				for (const metricValue of pendingValues) {
					try {
						instrument.inc(metricValue.labels, metricValue.value);
					} catch (recordError) {
						this.logger.warn(
							`Failed to record metric value for "${metricName}": ${getErrorMessage(recordError)}`,
						);
					}
				}
			} else if (instrument instanceof Histogram) {
				// Histogram: observe value for each pending entry
				for (const metricValue of pendingValues) {
					try {
						instrument.observe(metricValue.labels, metricValue.value);
					} catch (recordError) {
						this.logger.warn(
							`Failed to record metric value for "${metricName}": ${getErrorMessage(recordError)}`,
						);
					}
				}
			} else if (instrument instanceof Gauge) {
				// Gauge: set values directly per label set
				// updown_counter: accumulate values per label set and maintain running total
				const accumulatedValues = new Map<string, { labels: Record<string, string | number>; value: number }>();

				for (const metricValue of pendingValues) {
					const labelKey = PrometheusExporter.normalizeLabelKey(metricValue.labels);
					if (accumulatedValues.has(labelKey)) {
						const existing = accumulatedValues.get(labelKey);
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						existing!.value += metricValue.value;
					} else {
						accumulatedValues.set(labelKey, {
							labels: metricValue.labels,
							value: metricValue.value,
						});
					}
				}

				// Get running totals map for this metric (if it exists, it's an updown_counter)
				const runningTotals = this.gaugeValues.get(metricName);

				// Apply accumulated values to the gauge (iterate only through unique label sets)
				for (const { labels, value: accumulatedValue } of accumulatedValues.values()) {
					try {
						let finalValue = accumulatedValue;

						// For updown_counters, add to running total; for regular gauges, use value directly
						if (runningTotals) {
							const normalizedKey = PrometheusExporter.normalizeLabelKey(labels);
							const currentTotal = runningTotals.get(normalizedKey) ?? 0;
							finalValue = currentTotal + accumulatedValue;
							runningTotals.set(normalizedKey, finalValue);
						}

						// Convert number values to strings if needed for prom-client
						const labelsForProm: Record<string, string> = {};
						for (const [key, val] of Object.entries(labels)) {
							labelsForProm[key] = String(val);
						}

						instrument.set(labelsForProm, finalValue);
					} catch (recordError) {
						this.logger.warn(
							`Failed to record metric value for "${metricName}": ${getErrorMessage(recordError)}`,
						);
					}
				}
			}
		}

		// Return metrics in Prometheus text format
		try {
			return await this.registry.metrics();
		} catch (error) {
			const message = getErrorMessage(error);
			this.logger.error(`Failed to generate Prometheus metrics: ${message}`);
			throw error;
		}
	}

	/**
	 * Shutdown the exporter and clean up resources
	 *
	 * Clears the prom-client registry and releases all internal state:
	 * - registry.clear() — removes all instruments
	 * - instruments.clear() — removes cached instrument references
	 * - pending.clear() — discards any buffered but unflushed metric values
	 *
	 * Called by PrometheusModule during application shutdown (onApplicationShutdown).
	 *
	 * @returns Promise that resolves when shutdown is complete
	 *
	 * @example
	 * ```typescript
	 * await exporter.shutdown();
	 * ```
	 */
	// eslint-disable-next-line require-await
	public async shutdown(): Promise<void> {
		this.registry.clear();
		this.instruments.clear();
		this.pending.clear();
		this.gaugeValues.clear();
	}
}
