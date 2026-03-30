import { Injectable } from '@nestjs/common';
import {
	Counter,
	Histogram,
	ObservableGauge,
	UpDownCounter,
	Attributes,
	metrics,
} from '@opentelemetry/api';
import {
	IMetricsExporter,
	IMetricDescriptor,
	IMetricValue,
	BaseApplicationError,
} from '@pawells/nestjs-shared';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';

/**
 * OpenTelemetry metrics exporter implementation.
 *
 * Implements the IMetricsExporter interface to export metrics to OpenTelemetry.
 * This exporter supports event-based push of metrics as they're recorded.
 *
 * @example
 * ```typescript
 * import { OpenTelemetryExporter } from '@pawells/nestjs-open-telemetry';
 * import { MetricsModule } from '@pawells/nestjs-shared';
 *
 * @Module({
 *   imports: [
 *     MetricsModule.forRoot({
 *       exporters: [new OpenTelemetryExporter()],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Injectable()
export class OpenTelemetryExporter implements IMetricsExporter {
	/**
	 * Whether this exporter supports event-based push of metrics.
	 * OpenTelemetry exporter is push-based (receives each metric as it's recorded).
	 * @readonly
	 */
	public readonly SupportsEventBased = true;

	/**
	 * Whether this exporter supports pull-based reads.
	 * OpenTelemetry exporter is push-only (no scrape endpoint).
	 * @readonly
	 */
	public readonly SupportsPull = false;

	/**
	 * Cache of created OpenTelemetry instruments, keyed by metric name.
	 * Stores Counter, Histogram, ObservableGauge, and UpDownCounter instances.
	 */
	private readonly Instruments: Map<
		string,
		Counter | Histogram | ObservableGauge | UpDownCounter
	>;

	/**
	 * Tracks the last recorded absolute value for gauge metrics, keyed by
	 * a composite of metric name and serialized labels.
	 * Used to compute the delta for UpDownCounter when emulating gauge semantics.
	 */
	private readonly GaugeValues: Map<string, number>;

	/**
	 * Application logger instance for diagnostics and error reporting.
	 */
	private readonly Logger: AppLogger;

	/**
	 * Initialize the exporter with an empty instrument cache.
	 */
	constructor() {
		this.Logger = new AppLogger(undefined, OpenTelemetryExporter.name);
		this.Instruments = new Map();
		this.GaugeValues = new Map();
	}

	/**
	 * Called when a metric descriptor is registered.
	 *
	 * Pre-creates the corresponding OpenTelemetry instrument and caches it
	 * so subsequent metric recordings can use it directly.
	 *
	 * @param descriptor - The metric descriptor being registered
	 */
	public onDescriptorRegistered(descriptor: IMetricDescriptor): void {
		// Only create if not already cached
		if (this.Instruments.has(descriptor.name)) {
			return;
		}

		try {
			const meter = metrics.getMeterProvider().getMeter('nestjs-open-telemetry');

			const options = {
				description: descriptor.help,
				...(descriptor.unit !== undefined && { unit: descriptor.unit }),
			};

			let instrument: Counter | Histogram | ObservableGauge | UpDownCounter;

			switch (descriptor.type) {
				case 'counter': {
					instrument = meter.createCounter(descriptor.name, options);
					break;
				}
				case 'histogram': {
					instrument = meter.createHistogram(descriptor.name, options);
					break;
				}
				case 'gauge': {
					// NOTE: Push-based gauges are implemented as UpDownCounters because the OTel SDK's
					// ObservableGauge requires a pull-based callback pattern incompatible with our push model.
					// Consumers should use 'updown_counter' type for absolute set operations if needed.
					instrument = meter.createUpDownCounter(descriptor.name, options);
					break;
				}
				case 'updown_counter': {
					instrument = meter.createUpDownCounter(descriptor.name, options);
					break;
				}
				default: {
					// Exhaustiveness check — this block is unreachable if all types are handled
					const _exhaustive: never = descriptor.type as never;
					throw new BaseApplicationError(`Unhandled metric type: ${_exhaustive}`);
				}
			}

			this.Instruments.set(descriptor.name, instrument);
		} catch (error) {
			const errorMessage = getErrorMessage(error);
			this.Logger.warn(`Failed to register descriptor "${descriptor.name}": ${errorMessage}`);
			return;
		}
	}

	/**
	 * Called each time a metric is recorded.
	 *
	 * Updates the appropriate OpenTelemetry instrument with the metric value and attributes.
	 *
	 * @param value - The metric value being recorded, including descriptor and labels
	 */
	public onMetricRecorded(value: IMetricValue): void {
		const instrument = this.Instruments.get(value.descriptor.name);
		if (!instrument) {
			return;
		}

		const attributes = value.labels as Attributes;

		switch (value.descriptor.type) {
			case 'counter':
				(instrument as Counter).add(value.value, attributes);
				break;
			case 'histogram':
				(instrument as Histogram).record(value.value, attributes);
				break;
			case 'gauge': {
				// Gauge is implemented as UpDownCounter.
				// UpDownCounter.add() accepts a delta, so we compute the difference
				// between the new absolute value and the last known value to emulate
				// gauge (set) semantics.
				const sortedLabels = value.labels
					? Object.entries(value.labels as Record<string, unknown>)
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([k, v]) => `${k}=${v}`)
						.join(',')
					: '';
				const gaugeKey = `${value.descriptor.name}:${sortedLabels}`;
				const previous = this.GaugeValues.get(gaugeKey) ?? 0;
				const delta = value.value - previous;
				this.GaugeValues.set(gaugeKey, value.value);
				(instrument as UpDownCounter).add(delta, attributes);
				break;
			}
			case 'updown_counter':
				(instrument as UpDownCounter).add(value.value, attributes);
				break;
			default: {
				// Exhaustiveness check — this block is unreachable if all types are handled
				const _exhaustive: never = value.descriptor.type as never;
				this.Logger.warn(`Unhandled metric type: ${_exhaustive}`);
				break;
			}
		}
	}

	/**
	 * Called on application shutdown.
	 *
	 * Clears the instrument cache and allows OpenTelemetry resources to be cleaned up.
	 */
	public shutdown(): void {
		this.Instruments.clear();
		this.GaugeValues.clear();
	}
}
