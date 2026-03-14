import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Registry, collectDefaultMetrics, Histogram, Counter, Gauge } from 'prom-client';
import {
	HTTP_DURATION_BUCKETS,
	HTTP_REQUEST_SIZE_BUCKETS,
	MILLISECONDS_TO_SECONDS,
} from '../constants/histogram-buckets.constants.js';
import { AppLogger } from './logger.service.js';
import { LazyModuleRefService } from '../utils/lazy-getter.types.js';

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
export class MetricsRegistryService implements OnModuleInit, LazyModuleRefService {
	private _contextualLogger: AppLogger | undefined;

	private readonly registry: Registry;

	private readonly enabled: boolean;

	// HTTP Request Metrics
	private readonly httpRequestDuration: Histogram<string> | null = null;

	private readonly httpRequestTotal: Counter<string> | null = null;

	private readonly httpRequestSize: Histogram<string> | null = null;

	constructor(public readonly Module: ModuleRef) {
		this.registry = new Registry();
		this.enabled = process.env['METRICS_ENABLED'] !== 'false';

		if (this.enabled) {
			// Collect default Node.js metrics
			collectDefaultMetrics({ register: this.registry });

			// HTTP Request Duration Histogram
			this.httpRequestDuration = new Histogram({
				name: 'http_request_duration_seconds',
				help: 'Duration of HTTP requests in seconds',
				labelNames: ['method', 'route', 'status_code', 'status_class'],
				buckets: HTTP_DURATION_BUCKETS,
				registers: [this.registry],
			});

			// HTTP Request Total Counter
			this.httpRequestTotal = new Counter({
				name: 'http_requests_total',
				help: 'Total number of HTTP requests',
				labelNames: ['method', 'route', 'status_code', 'status_class'],
				registers: [this.registry],
			});

			// HTTP Request Size Histogram
			this.httpRequestSize = new Histogram({
				name: 'http_request_size_bytes',
				help: 'Size of HTTP requests in bytes',
				labelNames: ['method', 'route'],
				buckets: HTTP_REQUEST_SIZE_BUCKETS,
				registers: [this.registry],
			});
		}
	}

	public onModuleInit(): void {
		if (!this.enabled) {
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
		// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
		this._contextualLogger ||= this.Module.get(AppLogger).createContextualLogger(MetricsRegistryService.name);
		return this._contextualLogger;
	}

	/**
	 * Get the Prometheus registry
	 */
	public getRegistry(): Registry {
		return this.registry;
	}

	/**
	 * Record HTTP request metrics
	 */
	public recordHttpRequest(method: string, route: string, statusCode: number, duration: number, size?: number): void {
		if (!this.enabled || !this.httpRequestDuration || !this.httpRequestTotal) return;

		const statusClass = statusCode >= HTTP_STATUS_CODE_500 ? '5xx' : statusCode >= HTTP_STATUS_CODE_400 ? '4xx' : '2xx';
		const labels = { method, route, status_code: statusCode.toString(), status_class: statusClass };

		this.httpRequestDuration.observe(labels, duration / MILLISECONDS_TO_SECONDS); // Convert to seconds
		this.httpRequestTotal.inc(labels);

		if (size !== undefined && this.httpRequestSize) {
			this.httpRequestSize.observe({ method, route }, size);
		}
	}

	/**
	 * Record a counter metric
	 */
	public recordCounter(name: string, value: number = 1, labels: Record<string, string | number> = {}): void {
		if (!this.enabled) return;
		try {
			const counter = this.registry.getSingleMetric(name) as Counter<string> | undefined;
			if (counter) {
				counter.inc(labels, value);
			} else {
				this.Logger.warn(`Counter metric '${name}' not found in registry`);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.Logger.error(`Failed to record counter '${name}': ${errorMsg}`);
		}
	}

	/**
	 * Record a gauge metric
	 */
	public recordGauge(name: string, value: number, labels: Record<string, string | number> = {}): void {
		if (!this.enabled) return;
		try {
			const gauge = this.registry.getSingleMetric(name) as Gauge<string> | undefined;
			if (gauge) {
				gauge.set(labels, value);
			} else {
				this.Logger.warn(`Gauge metric '${name}' not found in registry`);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.Logger.error(`Failed to record gauge '${name}': ${errorMsg}`);
		}
	}

	/**
	 * Record a histogram observation
	 */
	public recordHistogram(name: string, value: number, labels: Record<string, string | number> = {}): void {
		if (!this.enabled) return;
		try {
			const histogram = this.registry.getSingleMetric(name) as Histogram<string> | undefined;
			if (histogram) {
				histogram.observe(labels, value);
			} else {
				this.Logger.warn(`Histogram metric '${name}' not found in registry`);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.Logger.error(`Failed to record histogram '${name}': ${errorMsg}`);
		}
	}

	/**
	 * Create and register a new counter metric
	 */
	public createCounter(name: string, help: string, labelNames: string[] = []): Counter<string> {
		const counter = new Counter({
			name,
			help,
			labelNames,
			registers: [this.registry],
		});
		this.Logger.info(`Created counter metric: ${name}`);
		return counter;
	}

	/**
	 * Create and register a new gauge metric
	 */
	public createGauge(name: string, help: string, labelNames: string[] = []): Gauge<string> {
		const gauge = new Gauge({
			name,
			help,
			labelNames,
			registers: [this.registry],
		});
		this.Logger.info(`Created gauge metric: ${name}`);
		return gauge;
	}

	/**
	 * Create and register a new histogram metric
	 */
	public createHistogram(name: string, help: string, labelNames: string[] = [], buckets?: number[]): Histogram<string> {
		const config: { name: string; help: string; labelNames: string[]; registers: Registry[]; buckets?: number[] } = {
			name,
			help,
			labelNames,
			registers: [this.registry],
		};

		if (buckets !== undefined) {
			config.buckets = buckets;
		}

		const histogram = new Histogram(config);
		this.Logger.info(`Created histogram metric: ${name}`);
		return histogram;
	}

	/**
	 * Register a custom metric
	 */
	public registerMetric<T>(metric: T): T {
		if (metric && typeof metric === 'object' && 'register' in metric && typeof metric.register === 'function') {
			metric.register(this.registry);
		}
		return metric;
	}

	/**
	 * Get metrics in Prometheus format
	 */
	// eslint-disable-next-line require-await
	public async getMetrics(): Promise<string> {
		return this.registry.metrics();
	}

	/**
	 * Get registry metrics as JSON for debugging
	 */
	// eslint-disable-next-line require-await
	public async getMetricsAsJSON(): Promise<any> {
		return this.registry.getMetricsAsJSON();
	}

	/**
	 * Clear all metrics (useful for testing)
	 */
	public clear(): void {
		this.registry.clear();
		this.Logger.warn('All metrics cleared');
	}
}
