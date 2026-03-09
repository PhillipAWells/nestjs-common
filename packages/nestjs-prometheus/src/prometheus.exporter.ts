import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import type { IMetricsExporter, MetricDescriptor, MetricValue } from '@pawells/nestjs-shared';

/**
 * Prometheus metrics exporter implementation
 *
 * Implements the IMetricsExporter interface for Prometheus pull-based metrics collection.
 * Uses prom-client library to manage Prometheus instruments (Counter, Gauge, Histogram)
 * and exports metrics in Prometheus text format on demand.
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
	 * This exporter does not support event-based metric recording
	 * Metrics are buffered and flushed on pull (getMetrics)
	 */
	public readonly supportsEventBased = false;

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
	 * Maximum number of pending metric values per metric before culling oldest entries
	 * Prevents unbounded memory growth if metrics are recorded much faster than pulled
	 * @private
	 */
	// eslint-disable-next-line no-magic-numbers
	private readonly MAX_PENDING_PER_METRIC = 1000;

	constructor() {
		this.registry = new Registry();
		this.instruments = new Map();
		this.pending = new Map();

		// Collect Node.js default metrics into our registry
		collectDefaultMetrics({ register: this.registry });
	}

	/**
	 * Called when a metric descriptor is registered in InstrumentationRegistry
	 *
	 * Pre-creates the corresponding prom-client instrument (Counter, Gauge, or Histogram)
	 * based on the descriptor's type. The created instrument is cached for future use.
	 *
	 * @param descriptor - The metric descriptor being registered
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
	 * This method is called when supportsEventBased = false. Values are buffered
	 * and not immediately recorded into prom-client; instead, they are recorded
	 * during the next pull (getMetrics) call.
	 *
	 * @param value - The metric value to buffer
	 *
	 * @example
	 * ```typescript
	 * exporter.onMetricRecorded({
	 *   descriptor: { ... },
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
			if (pendingArray.length > this.MAX_PENDING_PER_METRIC) {
				pendingArray.shift();
			}
		} else {
			// Warn if metric recorded before descriptor registration (data will be lost)
			console.warn(`Metric recorded before descriptor registration: ${metricName}`);
		}
	}

	/**
	 * Retrieve all metrics in Prometheus text format
	 *
	 * Flushes all pending metric values into prom-client instruments, then returns
	 * the complete metrics output in Prometheus text format (version 0.0.4).
	 *
	 * @returns Promise resolving to metrics in Prometheus text format
	 *
	 * @example
	 * ```typescript
	 * const prometheusMetrics = await exporter.getMetrics();
	 * // Returns:
	 * // # HELP http_request_duration_seconds Duration of HTTP requests in seconds
	 * // # TYPE http_request_duration_seconds histogram
	 * // http_request_duration_seconds_bucket{...} ...
	 * ```
	 */
	// eslint-disable-next-line require-await
	public async getMetrics(): Promise<string> {
		// Flush all pending values into prom-client instruments
		for (const [metricName, pendingValues] of this.pending.entries()) {
			if (pendingValues.length === 0) {
				continue;
			}

			const instrument = this.instruments.get(metricName);
			if (!instrument) {
				// Instrument not yet created, skip pending values
				continue;
			}

			const descriptor = pendingValues[0]?.descriptor;
			if (!descriptor) {
				continue;
			}

			// Record all pending values into the appropriate instrument
			for (const metricValue of pendingValues) {
				switch (descriptor.type) {
					case 'counter':
						(instrument as Counter<string>).inc(metricValue.labels, metricValue.value);
						break;

					case 'histogram':
						(instrument as Histogram<string>).observe(metricValue.labels, metricValue.value);
						break;

					case 'gauge':
					case 'updown_counter':
						(instrument as Gauge<string>).set(metricValue.labels, metricValue.value);
						break;
				}
			}

			// Clear pending values after flush
			pendingValues.length = 0;
		}

		// Return metrics in Prometheus text format
		return this.registry.metrics();
	}

	/**
	 * Shutdown the exporter and clean up resources
	 *
	 * Clears the prom-client registry and releases all internal state.
	 * Called during application shutdown.
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
	}
}
