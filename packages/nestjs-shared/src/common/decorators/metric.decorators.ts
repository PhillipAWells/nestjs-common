import { Inject } from '@nestjs/common';
import { Counter, Gauge, Histogram, Summary } from 'prom-client';

/**
 * Metric decorators for easy injection of Prometheus metrics
 */

/**
 * Inject a Counter metric
 */
export const InjectCounter = (name: string): ParameterDecorator => Inject(`PROM_METRIC_COUNTER_${name}`);

/**
 * Inject a Gauge metric
 */
export const InjectGauge = (name: string): ParameterDecorator => Inject(`PROM_METRIC_GAUGE_${name}`);

/**
 * Inject a Histogram metric
 */
export const InjectHistogram = (name: string): ParameterDecorator => Inject(`PROM_METRIC_HISTOGRAM_${name}`);

/**
 * Inject a Summary metric
 */
export const InjectSummary = (name: string): ParameterDecorator => Inject(`PROM_METRIC_SUMMARY_${name}`);

/**
 * Metric creation utilities
 */
export class MetricFactory {
	/**
	 * Create a counter metric
	 */
	public static CreateCounter(name: string, help: string, labelNames?: string[]): Counter<string> {
		const Config: { name: string; help: string; labelNames?: string[] } = {
			name,
			help,
		};
		if (labelNames !== undefined) {
			Config.labelNames = labelNames;
		}
		return new Counter(Config);
	}

	/**
	 * Create a gauge metric
	 */
	public static CreateGauge(name: string, help: string, labelNames?: string[]): Gauge<string> {
		const Config: { name: string; help: string; labelNames?: string[] } = {
			name,
			help,
		};
		if (labelNames !== undefined) {
			Config.labelNames = labelNames;
		}
		return new Gauge(Config);
	}

	/**
	 * Create a histogram metric
	 */
	public static CreateHistogram(
		name: string,
		help: string,
		labelNames?: string[],
		buckets?: number[],
	): Histogram<string> {
		const Config: { name: string; help: string; labelNames?: string[]; buckets?: number[] } = {
			name,
			help,
		};
		if (labelNames !== undefined) {
			Config.labelNames = labelNames;
		}
		if (buckets !== undefined) {
			Config.buckets = buckets;
		}
		return new Histogram(Config);
	}

	/**
	 * Create a summary metric
	 */
	public static CreateSummary(
		name: string,
		help: string,
		labelNames?: string[],
		percentiles?: number[],
	): Summary<string> {
		const Config: { name: string; help: string; labelNames?: string[]; percentiles?: number[] } = {
			name,
			help,
		};
		if (labelNames !== undefined) {
			Config.labelNames = labelNames;
		}
		if (percentiles !== undefined) {
			Config.percentiles = percentiles;
		}
		return new Summary(Config);
	}
}
