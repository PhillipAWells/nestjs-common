import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import type { IMetricsExporter, IMetricDescriptor, IMetricValue } from '@pawells/nestjs-shared';

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
	public readonly SupportsEventBased = true;

	/**
	 * This exporter supports pull-based metric retrieval
	 */
	public readonly SupportsPull = true;

	/**
	 * Prom-client Registry instance for managing instruments
	 * @private
	 */
	private readonly Registry: Registry;

	/**
	 * Cache of created prom-client instruments (Counter, Histogram, Gauge)
	 * Keyed by metric name
	 * @private
	 */
	private readonly Instruments: Map<string, Counter<string> | Histogram<string> | Gauge<string>>;

	/**
	 * Pending metric values to be flushed into prom-client instruments on next getMetrics()
	 * Keyed by metric name
	 * @private
	 */
	private readonly Pending: Map<string, IMetricValue[]>;

	/**
	 * Running totals for updown_counter metrics (persistent across scrapes)
	 * Keyed by metric name, then by normalized label key
	 * @private
	 */
	private readonly GaugeValues: Map<string, Map<string, number>>;

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
	private readonly Logger: AppLogger;

	/**
	 * Normalize label keys to handle consistent ordering regardless of insertion order
	 * @private
	 */
	private static NormalizeLabelKey(labels: Record<string, string | number>): string {
		const SortedEntries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
		return JSON.stringify(Object.fromEntries(SortedEntries));
	}

	/**
	 * Create a new PrometheusExporter instance
	 *
	 * Initializes a prom-client Registry and starts collecting Node.js default metrics
	 * (process CPU, memory, event loop, garbage collection, etc.).
	 */
	constructor() {
		this.Registry = new Registry();
		this.Instruments = new Map();
		this.Pending = new Map();
		this.GaugeValues = new Map();
		this.Logger = new AppLogger(undefined, PrometheusExporter.name);

		// Collect Node.js default metrics into our registry
		collectDefaultMetrics({ register: this.Registry });
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
	public OnDescriptorRegistered(descriptor: IMetricDescriptor): void {
		const { name, type, help, labelNames, buckets } = descriptor;

		// Guard against duplicate registration
		if (this.Instruments.has(name)) {
			return;
		}

		// Validate required fields
		if (!name) {
			this.Logger.warn('Metric descriptor registered with empty name');
			return;
		}

		if (!help) {
			this.Logger.warn(`Metric descriptor "${name}" registered with empty help text`);
			return;
		}

		let Instrument: Counter<string> | Histogram<string> | Gauge<string>;

		switch (type) {
			case 'counter':
				Instrument = new Counter({
					name,
					help,
					labelNames,
					registers: [this.Registry],
				});
				break;

			case 'histogram':
				Instrument = new Histogram({
					name,
					help,
					labelNames,
					buckets,
					registers: [this.Registry],
				});
				break;

			case 'gauge':
			case 'updown_counter':
				// Both gauge and updown_counter map to prom-client Gauge
				Instrument = new Gauge({
					name,
					help,
					labelNames,
					registers: [this.Registry],
				});
				// Initialize running totals map for this metric
				if (type === 'updown_counter') {
					this.GaugeValues.set(name, new Map());
				}
				break;

			default:
				throw new Error(`Unsupported metric type "${type}" for descriptor "${name}"`);
		}

		this.Instruments.set(name, Instrument);
		this.Pending.set(name, []);
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
	public OnMetricRecorded(value: IMetricValue): void {
		const MetricName = value.descriptor.name;
		const PendingArray = this.Pending.get(MetricName);

		if (PendingArray) {
			PendingArray.push(value);

			// Cap pending array to prevent unbounded memory growth
			if (PendingArray.length > PrometheusExporter.MAX_PENDING_PER_METRIC) {
				PendingArray.shift();
			}
		} else {
			// Warn if metric recorded before descriptor registration (data will be lost)
			this.Logger.warn(`Metric recorded before descriptor registration: ${MetricName}`);
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
	public async GetMetrics(): Promise<string> {
		// Flush all pending values into prom-client instruments
		// Use atomic swap pattern: capture current values and replace with empty array
		// to prevent loss of metrics recorded concurrently during flush
		for (const [MetricName, PendingValues] of this.Pending.entries()) {
			// Atomically swap pending array with a fresh one
			this.Pending.set(MetricName, []);

			if (PendingValues.length === 0) {
				continue;
			}

			const Instrument = this.Instruments.get(MetricName);
			if (!Instrument) {
				// Instrument not yet created, skip pending values
				continue;
			}

			// Record all pending values into the appropriate instrument
			if (Instrument instanceof Counter) {
				// Counter: increment by value for each pending entry
				for (const MetricValue of PendingValues) {
					try {
						Instrument.inc(MetricValue.labels, MetricValue.value);
					} catch (recordError) {
						this.Logger.warn(
							`Failed to record metric value for "${MetricName}": ${getErrorMessage(recordError)}`,
						);
					}
				}
			} else if (Instrument instanceof Histogram) {
				// Histogram: observe value for each pending entry
				for (const MetricValue of PendingValues) {
					try {
						Instrument.observe(MetricValue.labels, MetricValue.value);
					} catch (recordError) {
						this.Logger.warn(
							`Failed to record metric value for "${MetricName}": ${getErrorMessage(recordError)}`,
						);
					}
				}
			} else if (Instrument instanceof Gauge) {
				// Gauge: set values directly per label set
				// updown_counter: accumulate values per label set and maintain running total
				const AccumulatedValues = new Map<string, { labels: Record<string, string | number>; value: number }>();

				for (const MetricValue of PendingValues) {
					const LabelKey = PrometheusExporter.NormalizeLabelKey(MetricValue.labels);
					const Existing = AccumulatedValues.get(LabelKey);
					if (Existing) {
						Existing.value += MetricValue.value;
					} else {
						AccumulatedValues.set(LabelKey, {
							labels: MetricValue.labels,
							value: MetricValue.value,
						});
					}
				}

				// Get running totals map for this metric (if it exists, it's an updown_counter)
				const RunningTotals = this.GaugeValues.get(MetricName);

				// Apply accumulated values to the gauge (iterate only through unique label sets)
				for (const { labels, value: AccumulatedValue } of AccumulatedValues.values()) {
					try {
						let FinalValue = AccumulatedValue;

						// For updown_counters, add to running total; for regular gauges, use value directly
						if (RunningTotals) {
							const NormalizedKey = PrometheusExporter.NormalizeLabelKey(labels);
							const CurrentTotal = RunningTotals.get(NormalizedKey) ?? 0;
							FinalValue = CurrentTotal + AccumulatedValue;
							RunningTotals.set(NormalizedKey, FinalValue);
						}

						// Convert number values to strings if needed for prom-client
						const LabelsForProm: Record<string, string> = {};
						for (const [Key, Val] of Object.entries(labels)) {
							LabelsForProm[Key] = String(Val);
						}

						Instrument.set(LabelsForProm, FinalValue);
					} catch (recordError) {
						this.Logger.warn(
							`Failed to record metric value for "${MetricName}": ${getErrorMessage(recordError)}`,
						);
					}
				}
			}
		}

		// Return metrics in Prometheus text format
		try {
			return await this.Registry.metrics();
		} catch (error) {
			const Message = getErrorMessage(error);
			this.Logger.error(`Failed to generate Prometheus metrics: ${Message}`);
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
	public async Shutdown(): Promise<void> {
		this.Registry.clear();
		this.Instruments.clear();
		this.Pending.clear();
		this.GaugeValues.clear();
	}
}
