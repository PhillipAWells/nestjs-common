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
	public OnDescriptorRegistered(descriptor: IMetricDescriptor): void {
		// Only create if not already cached
		if (this.Instruments.has(descriptor.name)) {
			return;
		}

		try {
			const Meter = metrics.getMeterProvider().getMeter('nestjs-open-telemetry');

			const Options = {
				description: descriptor.help,
				...(descriptor.unit !== undefined && { unit: descriptor.unit }),
			};

			let Instrument: Counter | Histogram | ObservableGauge | UpDownCounter;

			switch (descriptor.type) {
				case 'counter': {
					Instrument = Meter.createCounter(descriptor.name, Options);
					break;
				}
				case 'histogram': {
					Instrument = Meter.createHistogram(descriptor.name, Options);
					break;
				}
				case 'gauge': {
					// NOTE: Push-based gauges are implemented as UpDownCounters because the OTel SDK's
					// ObservableGauge requires a pull-based callback pattern incompatible with our push model.
					// Consumers should use 'updown_counter' type for absolute set operations if needed.
					Instrument = Meter.createUpDownCounter(descriptor.name, Options);
					break;
				}
				case 'updown_counter': {
					Instrument = Meter.createUpDownCounter(descriptor.name, Options);
					break;
				}
				default: {
					// Exhaustiveness check — this block is unreachable if all types are handled
					const Exhaustive: never = descriptor.type as never;
					throw new BaseApplicationError(`Unhandled metric type: ${Exhaustive}`);
				}
			}

			this.Instruments.set(descriptor.name, Instrument);
		} catch (error) {
			const ErrorMessage = getErrorMessage(error);
			this.Logger.warn(`Failed to register descriptor "${descriptor.name}": ${ErrorMessage}`);
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
	public OnMetricRecorded(value: IMetricValue): void {
		const Instrument = this.Instruments.get(value.descriptor.name);
		if (!Instrument) {
			return;
		}

		const Attributes = value.labels as Attributes;

		switch (value.descriptor.type) {
			case 'counter':
				(Instrument as Counter).add(value.value, Attributes);
				break;
			case 'histogram':
				(Instrument as Histogram).record(value.value, Attributes);
				break;
			case 'gauge': {
				// Gauge is implemented as UpDownCounter.
				// UpDownCounter.add() accepts a delta, so we compute the difference
				// between the new absolute value and the last known value to emulate
				// gauge (set) semantics.
				const SortedLabels = value.labels
					? Object.entries(value.labels as Record<string, unknown>)
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([k, v]) => `${k}=${v}`)
						.join(',')
					: '';
				const GaugeKey = `${value.descriptor.name}:${SortedLabels}`;
				const Previous = this.GaugeValues.get(GaugeKey) ?? 0;
				const Delta = value.value - Previous;
				this.GaugeValues.set(GaugeKey, value.value);
				(Instrument as UpDownCounter).add(Delta, Attributes);
				break;
			}
			case 'updown_counter':
				(Instrument as UpDownCounter).add(value.value, Attributes);
				break;
			default: {
				// Exhaustiveness check — this block is unreachable if all types are handled
				const Exhaustive: never = value.descriptor.type as never;
				this.Logger.warn(`Unhandled metric type: ${Exhaustive}`);
				break;
			}
		}
	}

	/**
	 * Called on application shutdown.
	 *
	 * Clears the instrument cache and allows OpenTelemetry resources to be cleaned up.
	 */
	public Shutdown(): void {
		this.Instruments.clear();
		this.GaugeValues.clear();
	}
}
