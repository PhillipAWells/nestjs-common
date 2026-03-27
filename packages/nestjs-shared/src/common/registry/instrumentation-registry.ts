import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { performance } from 'node:perf_hooks';
import { AppLogger } from '../services/logger.service.js';
import type { IContextualLogger } from '../interfaces/logger.interface.js';
import type { IMetricsExporter, MetricDescriptor, MetricValue } from '../interfaces/metrics-exporter.interface.js';
import { LazyModuleRefService } from '../utils/lazy-getter.types.js';
import { getErrorMessage } from '../utils/error.utils.js';

/**
 * Central registry for metrics collection and export
 *
 * Stores metric descriptors and recorded values, manages event-based and pull-based
 * exporters, and provides both push (event) and pull (query) patterns for metric access.
 *
 * @injectable
 *
 * @example
 * ```typescript
 * // Register a metric descriptor
 * registry.registerDescriptor({
 *   name: 'http_request_duration_seconds',
 *   type: 'histogram',
 *   help: 'Request duration in seconds',
 *   labelNames: ['method', 'route', 'status_code'],
 *   buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
 *   unit: 'seconds',
 * });
 *
 * // Record a metric value
 * registry.recordMetric('http_request_duration_seconds', 0.125, {
 *   method: 'GET',
 *   route: '/api/users',
 *   status_code: '200',
 * });
 *
 * // Subscribe to metric events
 * const unsubscribe = registry.on('http_request_duration_seconds', (value) => {
 *   console.log('Recorded:', value);
 * });
 * ```
 */
@Injectable()
export class InstrumentationRegistry implements OnModuleInit, LazyModuleRefService {
	/**
	 * Maximum number of metric values to store per metric.
	 * Prevents unbounded memory growth when recording values continuously.
	 * Older values are discarded in a rolling window approach.
	 */
	// eslint-disable-next-line no-magic-numbers
	private static readonly MAX_VALUES_PER_METRIC = 1000;

	/**
	 * Map of metric descriptors by name
	 * @private
	 */
	private readonly descriptors = new Map<string, MetricDescriptor>();

	/**
	 * Map of recorded metric values by metric name
	 * @private
	 */
	private readonly values = new Map<string, MetricValue[]>();

	/**
	 * List of registered exporters
	 * @private
	 */
	private readonly exporters: IMetricsExporter[] = [];

	/**
	 * Map of event listeners by metric name
	 * @private
	 */
	private readonly listeners = new Map<string, Array<(value: MetricValue) => void>>();

	/**
	 * Lazy-loaded contextual logger
	 * @private
	 */
	private _logger: IContextualLogger | undefined;

	/**
	 * Getter for contextual logger (lazy initialization)
	 * @private
	 */
	private get logger(): IContextualLogger {
		this._logger ??= this.AppLogger.createContextualLogger(InstrumentationRegistry.name);
		return this._logger;
	}

	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	public onModuleInit(): void {
		this.registerHttpMetrics();
	}

	/**
	 * Register standard HTTP metrics that are always available
	 * @private
	 */
	private registerHttpMetrics(): void {
		this.registerDescriptor({
			name: 'http_request_duration_seconds',
			type: 'histogram',
			help: 'Duration of HTTP requests in seconds',
			labelNames: ['method', 'route', 'status_code'],
			// eslint-disable-next-line no-magic-numbers
			buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10],
			unit: 'seconds',
		});

		this.registerDescriptor({
			name: 'http_requests_total',
			type: 'counter',
			help: 'Total number of HTTP requests',
			labelNames: ['method', 'route', 'status_code'],
		});

		this.registerDescriptor({
			name: 'http_request_size_bytes',
			type: 'histogram',
			help: 'Size of HTTP request bodies in bytes',
			labelNames: ['method', 'route'],
			// eslint-disable-next-line no-magic-numbers
			buckets: [100, 1000, 10000, 100000, 1000000],
			unit: 'bytes',
		});
	}

	/**
	 * Register a metric descriptor
	 *
	 * Registers a metric descriptor once during initialization. Throws an error if the
	 * descriptor name already exists with a different configuration. Idempotent when
	 * called with the exact same descriptor.
	 *
	 * @param descriptor - The metric descriptor to register
	 * @throws Error if metric name already registered with different configuration
	 *
	 * @example
	 * ```typescript
	 * registry.registerDescriptor({
	 *   name: 'custom_metric_seconds',
	 *   type: 'histogram',
	 *   help: 'Custom metric',
	 *   labelNames: ['service'],
	 *   buckets: [0.1, 0.5, 1],
	 * });
	 * ```
	 */
	public registerDescriptor(descriptor: MetricDescriptor): void {
		const existing = this.descriptors.get(descriptor.name);

		if (existing) {
			// Check if descriptors are identical
			if (this.descriptorsAreEqual(existing, descriptor)) {
				// Idempotent: same descriptor already registered
				return;
			}

			// Conflict: different descriptor with same name
			throw new Error(
				`Metric descriptor conflict: descriptor with name "${descriptor.name}" is already registered with different configuration`,
			);
		}

		// Register new descriptor
		this.descriptors.set(descriptor.name, descriptor);
		this.values.set(descriptor.name, []);

		// Notify all registered exporters
		for (const exporter of this.exporters) {
			try {
				if (exporter.onDescriptorRegistered) {
					exporter.onDescriptorRegistered(descriptor);
				}
			} catch (error) {
				this.logger.error('Error notifying exporter of descriptor registration', 'InstrumentationRegistry', {
					exporterIndex: this.exporters.indexOf(exporter),
					metricName: descriptor.name,
					error: getErrorMessage(error),
				});
			}
		}
	}

	/**
	 * Check if two metric descriptors are equal
	 * @private
	 */
	private descriptorsAreEqual(a: MetricDescriptor, b: MetricDescriptor): boolean {
		return (
			a.name === b.name &&
			a.type === b.type &&
			a.help === b.help &&
			JSON.stringify(a.labelNames) === JSON.stringify(b.labelNames) &&
			JSON.stringify(a.buckets) === JSON.stringify(b.buckets) &&
			a.unit === b.unit
		);
	}

	/**
	 * Record a metric value
	 *
	 * Records a metric value with the given name, numeric value, and optional labels.
	 * Timestamp is automatically set to `performance.now()`. Emits to all event-based
	 * exporters and to named listeners.
	 *
	 * @param name - The metric name (must be registered via registerDescriptor)
	 * @param value - The numeric value to record
	 * @param labels - Optional label/tag values for the metric
	 * @throws Error if metric descriptor is not registered
	 *
	 * @example
	 * ```typescript
	 * registry.recordMetric('http_request_duration_seconds', 0.025, {
	 *   method: 'POST',
	 *   route: '/api/create',
	 *   status_code: '201',
	 * });
	 * ```
	 */
	public recordMetric(name: string, value: number, labels?: Record<string, string | number>): void {
		const descriptor = this.descriptors.get(name);
		if (!descriptor) {
			throw new Error(`Metric descriptor not found: "${name}". Register the descriptor first using registerDescriptor().`);
		}

		const metricValue: MetricValue = {
			descriptor,
			value,
			labels: labels ?? {},
			timestamp: performance.now(),
		};

		// Store in-memory values with rolling window
		const valuesArray = this.values.get(name);
		if (valuesArray) {
			valuesArray.push(metricValue);
			// Enforce rolling window: discard oldest values if we exceed the limit
			if (valuesArray.length > InstrumentationRegistry.MAX_VALUES_PER_METRIC) {
				valuesArray.shift();
			}
		}

		// Notify event-based exporters
		for (const exporter of this.exporters) {
			try {
				if (exporter.supportsEventBased && exporter.onMetricRecorded) {
					exporter.onMetricRecorded(metricValue);
				}
			} catch (error) {
				this.logger.error('Error in event-based exporter onMetricRecorded', 'InstrumentationRegistry', {
					exporterIndex: this.exporters.indexOf(exporter),
					metricName: name,
					error: getErrorMessage(error),
				});
			}
		}

		// Notify named listeners
		const namedListeners = this.listeners.get(name);
		if (namedListeners) {
			for (const handler of namedListeners) {
				try {
					handler(metricValue);
				} catch (error) {
					this.logger.error('Error in metric listener', 'InstrumentationRegistry', {
						metricName: name,
						error: getErrorMessage(error),
					});
				}
			}
		}
	}

	/**
	 * Get all recorded metric values
	 *
	 * Returns a copy of all currently recorded metric values across all metrics.
	 * The returned map is a shallow copy — mutation of the returned map does not affect
	 * internal state, but arrays within it should not be mutated.
	 *
	 * @returns Map of metric name to array of recorded values
	 *
	 * @example
	 * ```typescript
	 * const allMetrics = registry.getAllMetrics();
	 * for (const [name, values] of allMetrics.entries()) {
	 *   console.log(`${name}: ${values.length} values recorded`);
	 * }
	 * ```
	 */
	public getAllMetrics(): Map<string, MetricValue[]> {
		return new Map(this.values);
	}

	/**
	 * Get recorded values for a single metric by name
	 *
	 * @param name - The metric name
	 * @returns Array of recorded values for the metric
	 *
	 * @example
	 * ```typescript
	 * const values = registry.getMetric('http_request_duration_seconds');
	 * console.log(`Recorded ${values.length} request duration measurements`);
	 * ```
	 */
	public getMetric(name: string): MetricValue[] {
		return this.values.get(name) ?? [];
	}

	/**
	 * Subscribe to a specific metric by name
	 *
	 * Registers a listener for a specific metric name. The listener is called synchronously
	 * each time a value is recorded for that metric. Returns an unsubscribe function that
	 * can be called to remove the listener.
	 *
	 * @param metricName - The metric name to listen to
	 * @param handler - Callback function called with each recorded metric value
	 * @returns Unsubscribe function to remove the listener
	 *
	 * @example
	 * ```typescript
	 * const unsubscribe = registry.on('http_request_duration_seconds', (value) => {
	 *   console.log('Request duration recorded:', value.value, value.labels);
	 * });
	 *
	 * // Later, unsubscribe if needed
	 * unsubscribe();
	 * ```
	 */
	public on(metricName: string, handler: (value: MetricValue) => void): () => void {
		const handlers = this.listeners.get(metricName) ?? [];
		handlers.push(handler);
		this.listeners.set(metricName, handlers);

		// Return unsubscribe function
		return () => {
			const idx = handlers.indexOf(handler);
			if (idx >= 0) {
				handlers.splice(idx, 1);
			}
		};
	}

	/**
	 * Register a metrics exporter
	 *
	 * Registers an exporter (e.g., Prometheus, OpenTelemetry) with the registry.
	 * If the exporter supports event-based notifications, it will receive calls to
	 * `onMetricRecorded` for each metric recorded after registration.
	 *
	 * The exporter's `onDescriptorRegistered` method is called immediately for all
	 * already-registered descriptors, allowing the exporter to initialize instruments.
	 *
	 * @param exporter - The metrics exporter to register
	 *
	 * @example
	 * ```typescript
	 * const prometheusExporter = new PrometheusExporter(registry);
	 * registry.registerExporter(prometheusExporter);
	 *
	 * const otExporter = new OpenTelemetryExporter();
	 * registry.registerExporter(otExporter);
	 * ```
	 */
	public registerExporter(exporter: IMetricsExporter): void {
		this.exporters.push(exporter);

		// Call onDescriptorRegistered for all existing descriptors
		for (const descriptor of this.descriptors.values()) {
			try {
				if (exporter.onDescriptorRegistered) {
					exporter.onDescriptorRegistered(descriptor);
				}
			} catch (error) {
				this.logger.error('Error notifying exporter during registration', 'InstrumentationRegistry', {
					exporterIndex: this.exporters.length - 1,
					metricName: descriptor.name,
					error: getErrorMessage(error),
				});
			}
		}
	}

	/**
	 * Shutdown the registry and all registered exporters
	 *
	 * Called during application shutdown. Calls the `shutdown()` method on all
	 * registered exporters to allow them to flush buffered metrics, close connections,
	 * and clean up resources.
	 *
	 * @returns Promise that resolves when all exporters have been shut down
	 *
	 * @example
	 * ```typescript
	 * app.onModuleDestroy(async () => {
	 *   await registry.shutdown();
	 * });
	 * ```
	 */
	public async shutdown(): Promise<void> {
		const shutdownPromises = this.exporters
			.map((exporter) => {
				try {
					const result = exporter.shutdown?.();
					if (result instanceof Promise) {
						return result;
					}
				} catch (error) {
					this.logger.error('Error during exporter shutdown', 'InstrumentationRegistry', {
						exporterIndex: this.exporters.indexOf(exporter),
						error: getErrorMessage(error),
					});
				}
				return Promise.resolve();
			});

		await Promise.all(shutdownPromises);
	}
}
