import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { performance } from 'node:perf_hooks';
import { AppLogger } from '../services/logger.service.js';
import type { IContextualLogger } from '../interfaces/logger.interface.js';
import type { IMetricsExporter, IMetricDescriptor, IMetricValue } from '../interfaces/metrics-exporter.interface.js';
import { ILazyModuleRefService } from '../utils/lazy-getter.types.js';
import { GetErrorMessage } from '../utils/error.utils.js';

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
export class InstrumentationRegistry implements OnModuleInit, ILazyModuleRefService {
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
	private readonly Descriptors = new Map<string, IMetricDescriptor>();

	/**
	 * Map of recorded metric values by metric name
	 * @private
	 */
	private readonly Values = new Map<string, IMetricValue[]>();

	/**
	 * List of registered exporters
	 * @private
	 */
	private readonly Exporters: IMetricsExporter[] = [];

	/**
	 * Map of event listeners by metric name
	 * @private
	 */
	private readonly Listeners = new Map<string, Array<(value: IMetricValue) => void>>();

	/**
	 * Lazy-loaded contextual logger
	 * @private
	 */
	private _Logger: IContextualLogger | undefined;

	/**
	 * Getter for contextual logger (lazy initialization)
	 * @private
	 */
	private get Logger(): IContextualLogger {
		this._Logger ??= this.AppLogger.createContextualLogger(InstrumentationRegistry.name);
		return this._Logger;
	}

	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	public onModuleInit(): void {
		this.RegisterHttpMetrics();
	}

	/**
	 * Register standard HTTP metrics that are always available
	 * @private
	 */
	private RegisterHttpMetrics(): void {
		this.RegisterDescriptor({
			name: 'http_request_duration_seconds',
			type: 'histogram',
			help: 'Duration of HTTP requests in seconds',
			labelNames: ['method', 'route', 'status_code'],
			// eslint-disable-next-line no-magic-numbers
			buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10],
			unit: 'seconds',
		});

		this.RegisterDescriptor({
			name: 'http_requests_total',
			type: 'counter',
			help: 'Total number of HTTP requests',
			labelNames: ['method', 'route', 'status_code'],
		});

		this.RegisterDescriptor({
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
	public RegisterDescriptor(descriptor: IMetricDescriptor): void {
		const Existing = this.Descriptors.get(descriptor.name);

		if (Existing) {
			// Check if descriptors are identical
			if (this.DescriptorsAreEqual(Existing, descriptor)) {
				// Idempotent: same descriptor already registered
				return;
			}

			// Conflict: different descriptor with same name
			throw new Error(
				`Metric descriptor conflict: descriptor with name "${descriptor.name}" is already registered with different configuration`,
			);
		}

		// Register new descriptor
		this.Descriptors.set(descriptor.name, descriptor);
		this.Values.set(descriptor.name, []);

		// Notify all registered exporters
		for (const Exporter of this.Exporters) {
			try {
				if (Exporter.onDescriptorRegistered) {
					Exporter.onDescriptorRegistered(descriptor);
				}
			} catch (error) {
				this.Logger.error('Error notifying exporter of descriptor registration', 'InstrumentationRegistry', {
					exporterIndex: this.Exporters.indexOf(Exporter),
					metricName: descriptor.name,
					error: GetErrorMessage(error),
				});
			}
		}
	}

	/**
	 * Check if two metric descriptors are equal
	 * @private
	 */
	private DescriptorsAreEqual(a: IMetricDescriptor, b: IMetricDescriptor): boolean {
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
	public RecordMetric(name: string, value: number, labels?: Record<string, string | number>): void {
		const Descriptor = this.Descriptors.get(name);
		if (!Descriptor) {
			throw new Error(`Metric descriptor not found: "${name}". Register the descriptor first using registerDescriptor().`);
		}

		const MetricValue: IMetricValue = {
			descriptor: Descriptor,
			value,
			labels: labels ?? {},
			timestamp: performance.now(),
		};

		// Store in-memory values with rolling window
		const ValuesArray = this.Values.get(name);
		if (ValuesArray) {
			ValuesArray.push(MetricValue);
			// Enforce rolling window: discard oldest values if we exceed the limit
			if (ValuesArray.length > InstrumentationRegistry.MAX_VALUES_PER_METRIC) {
				ValuesArray.shift();
			}
		}

		// Notify event-based exporters
		for (const Exporter of this.Exporters) {
			try {
				if (Exporter.SupportsEventBased && Exporter.onMetricRecorded) {
					Exporter.onMetricRecorded(MetricValue);
				}
			} catch (error) {
				this.Logger.error('Error in event-based exporter onMetricRecorded', 'InstrumentationRegistry', {
					exporterIndex: this.Exporters.indexOf(Exporter),
					metricName: name,
					error: GetErrorMessage(error),
				});
			}
		}

		// Notify named listeners
		const NamedListeners = this.Listeners.get(name);
		if (NamedListeners) {
			for (const Handler of NamedListeners) {
				try {
					Handler(MetricValue);
				} catch (error) {
					this.Logger.error('Error in metric listener', 'InstrumentationRegistry', {
						metricName: name,
						error: GetErrorMessage(error),
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
	 *   console.log(`${name}: ${values.:Length} values recorded`);
	 * }
	 * ```
	 */
	public GetAllMetrics(): Map<string, IMetricValue[]> {
		return new Map(this.Values);
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
	 * console.log(`Recorded ${values.:Length} request duration measurements`);
	 * ```
	 */
	public GetMetric(name: string): IMetricValue[] {
		return this.Values.get(name) ?? [];
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
	public On(metricName: string, handler: (value: IMetricValue) => void): () => void {
		const Handlers = this.Listeners.get(metricName) ?? [];
		Handlers.push(handler);
		this.Listeners.set(metricName, Handlers);

		// Return unsubscribe function
		return () => {
			const Idx = Handlers.indexOf(handler);
			if (Idx >= 0) {
				Handlers.splice(Idx, 1);
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
	public RegisterExporter(exporter: IMetricsExporter): void {
		this.Exporters.push(exporter);

		// Call onDescriptorRegistered for all existing descriptors
		for (const Descriptor of this.Descriptors.values()) {
			try {
				if (exporter.onDescriptorRegistered) {
					exporter.onDescriptorRegistered(Descriptor);
				}
			} catch (error) {
				this.Logger.error('Error notifying exporter during registration', 'InstrumentationRegistry', {
					exporterIndex: this.Exporters.length - 1,
					metricName: Descriptor.name,
					error: GetErrorMessage(error),
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
	public async Shutdown(): Promise<void> {
		const ShutdownPromises = this.Exporters
			.map((Exporter) => {
				try {
					const Result = Exporter.shutdown?.();
					if (Result instanceof Promise) {
						return Result;
					}
				} catch (error) {
					this.Logger.error('Error during exporter shutdown', 'InstrumentationRegistry', {
						exporterIndex: this.Exporters.indexOf(Exporter),
						error: GetErrorMessage(error),
					});
				}
				return Promise.resolve();
			});

		await Promise.all(ShutdownPromises);
	}
}
