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
	public static createCounter(name: string, help: string, labelNames?: string[]): Counter<string> {
		const config: any = {
			name,
			help,
		};
		if (labelNames !== undefined) {
			config.labelNames = labelNames;
		}
		return new Counter(config);
	}

	/**
	 * Create a gauge metric
	 */
	public static createGauge(name: string, help: string, labelNames?: string[]): Gauge<string> {
		const config: any = {
			name,
			help,
		};
		if (labelNames !== undefined) {
			config.labelNames = labelNames;
		}
		return new Gauge(config);
	}

	/**
	 * Create a histogram metric
	 */
	public static createHistogram(
		name: string,
		help: string,
		labelNames?: string[],
		buckets?: number[],
	): Histogram<string> {
		const config: any = {
			name,
			help,
		};
		if (labelNames !== undefined) {
			config.labelNames = labelNames;
		}
		if (buckets !== undefined) {
			config.buckets = buckets;
		}
		return new Histogram(config);
	}

	/**
	 * Create a summary metric
	 */
	public static createSummary(
		name: string,
		help: string,
		labelNames?: string[],
		percentiles?: number[],
	): Summary<string> {
		const config: any = {
			name,
			help,
		};
		if (labelNames !== undefined) {
			config.labelNames = labelNames;
		}
		if (percentiles !== undefined) {
			config.percentiles = percentiles;
		}
		return new Summary(config);
	}
}
