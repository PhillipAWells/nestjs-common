import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Registry, collectDefaultMetrics, Histogram, Counter, Gauge } from 'prom-client';
import {
	HTTP_DURATION_BUCKETS,
	HTTP_REQUEST_SIZE_BUCKETS,
	MILLISECONDS_TO_SECONDS,
} from '../constants/histogram-buckets.constants.js';
import { AppLogger } from './logger.service.js';
import { ILazyModuleRefService } from '../utils/lazy-getter.types.js';
import { GetErrorMessage } from '../utils/error.utils.js';

const HTTP_STATUS_CODE_500 = 500;
const HTTP_STATUS_CODE_400 = 400;

/**
 * Metrics Registry Service.
 * Centralized service for managing Prometheus metrics across the application.
 *
 * Features:
 * - HTTP request metrics (duration, count, size)
 * - Custom metric creation (counter, gauge, histogram)
 * - Default Node.js metrics collection
 * - Prometheus registry management
 * - Per-route metric cardinality prevention
 *
 * @remarks
 * - Controlled by METRICS_ENABLED environment variable (default: true)
 * - Automatically collects Node.js default metrics
 * - HTTP request metrics use normalized route paths to prevent unbounded label cardinality
 *
 * @example
 * ```typescript
 * // Record HTTP request
 * metricsService.recordHttpRequest('GET', '/users/:id', 200, 45, 2048);
 *
 * // Create custom metric
 * const customCounter = metricsService.createCounter('orders_total', 'Total orders processed');
 * customCounter.inc({ status: 'completed' });
 *
 * // Get metrics in Prometheus format
 * const metrics = await metricsService.getMetrics();
 * ```
 */
@Injectable()
export class MetricsRegistryService implements OnModuleInit, ILazyModuleRefService {
	private _ContextualLogger: AppLogger | undefined;

	private readonly Registry: Registry;

	private readonly Enabled: boolean;

	// HTTP Request Metrics
	private readonly HttpRequestDuration: Histogram<string> | null = null;

	private readonly HttpRequestTotal: Counter<string> | null = null;

	private readonly HttpRequestSize: Histogram<string> | null = null;
	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
		this.Registry = new Registry();
		this.Enabled = process.env['METRICS_ENABLED'] !== 'false';

		if (this.Enabled) {
			// Collect default Node.js metrics
			collectDefaultMetrics({ register: this.Registry });

			// HTTP Request Duration Histogram
			this.HttpRequestDuration = new Histogram({
				name: 'http_request_duration_seconds',
				help: 'Duration of HTTP requests in seconds',
				labelNames: ['method', 'route', 'status_code', 'status_class'],
				buckets: HTTP_DURATION_BUCKETS,
				registers: [this.Registry],
			});

			// HTTP Request Total Counter
			this.HttpRequestTotal = new Counter({
				name: 'http_requests_total',
				help: 'Total number of HTTP requests',
				labelNames: ['method', 'route', 'status_code', 'status_class'],
				registers: [this.Registry],
			});

			// HTTP Request Size Histogram
			this.HttpRequestSize = new Histogram({
				name: 'http_request_size_bytes',
				help: 'Size of HTTP requests in bytes',
				labelNames: ['method', 'route'],
				buckets: HTTP_REQUEST_SIZE_BUCKETS,
				registers: [this.Registry],
			});
		}
	}

	/** NestJS lifecycle hook: logs whether metrics collection is enabled or disabled at startup. */
	public onModuleInit(): void {
		if (!this.Enabled) {
			this.Logger.info('Prometheus metrics disabled');
		} else {
			this.Logger.info('MetricsRegistryService initialized with HTTP metrics');
		}
	}

	/**
	 * Get contextual logger for metrics registry
	 * Memoized for performance
	 */
	private get Logger(): AppLogger {
		this._ContextualLogger ??= this.Module.get(AppLogger).CreateContextualLogger(MetricsRegistryService.name);
		return this._ContextualLogger;
	}

	/**
	 * Get the Prometheus registry
	 */
	public GetRegistry(): Registry {
		return this.Registry;
	}

	/**
	 * Record HTTP request metrics
	 */
	public RecordHttpRequest(method: string, route: string, statusCode: number, duration: number, size?: number): void {
		if (!this.Enabled || !this.HttpRequestDuration || !this.HttpRequestTotal) return;

		const StatusClass = statusCode >= HTTP_STATUS_CODE_500 ? '5xx' : statusCode >= HTTP_STATUS_CODE_400 ? '4xx' : '2xx';
		const Labels = { method, route, status_code: statusCode.toString(), status_class: StatusClass };

		this.HttpRequestDuration.observe(Labels, duration / MILLISECONDS_TO_SECONDS); // Convert to seconds
		this.HttpRequestTotal.inc(Labels);

		if (size !== undefined && this.HttpRequestSize) {
			this.HttpRequestSize.observe({ method, route }, size);
		}
	}

	/**
	 * Record a counter metric
	 */
	public RecordCounter(name: string, value: number = 1, labels: Record<string, string | number> = {}): void {
		if (!this.Enabled) return;
		try {
			const Counter = this.Registry.getSingleMetric(name) as Counter<string> | undefined;
			if (Counter) {
				Counter.inc(labels, value);
			} else {
				this.Logger.warn(`Counter metric '${name}' not found in registry`);
			}
		} catch (error) {
			const ErrorMsg = GetErrorMessage(error);
			this.Logger.error(`Failed to record counter '${name}': ${ErrorMsg}`);
		}
	}

	/**
	 * Record a gauge metric
	 */
	public RecordGauge(name: string, value: number, labels: Record<string, string | number> = {}): void {
		if (!this.Enabled) return;
		try {
			const Gauge = this.Registry.getSingleMetric(name) as Gauge<string> | undefined;
			if (Gauge) {
				Gauge.set(labels, value);
			} else {
				this.Logger.warn(`Gauge metric '${name}' not found in registry`);
			}
		} catch (error) {
			this.Logger.error(`Failed to record gauge '${name}': ${GetErrorMessage(error)}`);
		}
	}

	/**
	 * Record a histogram observation
	 */
	public RecordHistogram(name: string, value: number, labels: Record<string, string | number> = {}): void {
		if (!this.Enabled) return;
		try {
			const Histogram = this.Registry.getSingleMetric(name) as Histogram<string> | undefined;
			if (Histogram) {
				Histogram.observe(labels, value);
			} else {
				this.Logger.warn(`Histogram metric '${name}' not found in registry`);
			}
		} catch (error) {
			this.Logger.error(`Failed to record histogram '${name}': ${GetErrorMessage(error)}`);
		}
	}

	/**
	 * Create and register a new counter metric
	 */
	public CreateCounter(name: string, help: string, labelNames: string[] = []): Counter<string> {
		const CounterInstance = new Counter({
			name,
			help,
			labelNames,
			registers: [this.Registry],
		});
		this.Logger.info(`Created counter metric: ${name}`);
		return CounterInstance;
	}

	/**
	 * Create and register a new gauge metric
	 */
	public CreateGauge(name: string, help: string, labelNames: string[] = []): Gauge<string> {
		const GaugeInstance = new Gauge({
			name,
			help,
			labelNames,
			registers: [this.Registry],
		});
		this.Logger.info(`Created gauge metric: ${name}`);
		return GaugeInstance;
	}

	/**
	 * Create and register a new histogram metric
	 */
	public CreateHistogram(name: string, help: string, labelNames: string[] = [], buckets?: number[]): Histogram<string> {
		const Config: { name: string; help: string; labelNames: string[]; registers: Registry[]; buckets?: number[] } = {
			name,
			help,
			labelNames,
			registers: [this.Registry],
		};

		if (buckets !== undefined) {
			Config.buckets = buckets;
		}

		const HistogramInstance = new Histogram(Config);
		this.Logger.info(`Created histogram metric: ${name}`);
		return HistogramInstance;
	}

	/**
	 * Register a custom metric
	 */
	public RegisterMetric<T>(metric: T): T {
		if (metric && typeof metric === 'object' && 'register' in metric && typeof metric.register === 'function') {
			metric.register(this.Registry);
		}
		return metric;
	}

	/**
	 * Get metrics in Prometheus format
	 */
	// eslint-disable-next-line require-await
	public async GetMetrics(): Promise<string> {
		return this.Registry.metrics();
	}

	/**
	 * Get registry metrics as JSON for debugging
	 */
	// eslint-disable-next-line require-await
	public async GetMetricsAsJSON(): Promise<any> {
		return this.Registry.getMetricsAsJSON();
	}

	/**
	 * Clear all metrics (useful for testing)
	 */
	public Clear(): void {
		this.Registry.clear();
		this.Logger.warn('All metrics cleared');
	}
}
