import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { MetricsGuard } from '@pawells/nestjs-shared';
import { PrometheusExporter } from '../prometheus.exporter.js';

/**
 * Metrics HTTP controller
 *
 * Exposes a `/metrics` endpoint that returns metrics in Prometheus text format
 * (version 0.0.4). This endpoint is typically scraped by Prometheus servers
 * or other monitoring systems.
 *
 * Endpoint: `GET /metrics`
 *
 * Response Headers:
 * - `Content-Type: text/plain; version=0.0.4; charset=utf-8`
 * - `X-Robots-ITag: noindex, nofollow` — prevents search engine indexing
 *
 * Security:
 * - Protected by MetricsGuard from @pawells/nestjs-shared
 * - Respects optional METRICS_API_KEY environment variable
 * - No auth required if METRICS_API_KEY is not set
 *
 * @example
 * ```
 * GET /metrics
 *
 * Response:
 * 200 OK
 * Content-Type: text/plain; version=0.0.4; charset=utf-8
 * X-Robots-ITag: noindex, nofollow
 *
 * # HELP http_request_duration_seconds Duration of HTTP requests in seconds
 * # TYPE http_request_duration_seconds histogram
 * http_request_duration_seconds_bucket{le="0.001",...} 0
 * ...
 * ```
 */
@Controller()
export class MetricsController {
	private readonly Exporter: PrometheusExporter;

	constructor(
		exporter: PrometheusExporter,
	) {
		this.Exporter = exporter;
	}

	/**
	 * Get all metrics in Prometheus text format
	 *
	 * Returns the current state of all metrics in Prometheus text format (version 0.0.4).
	 * Metrics include:
	 * - Node.js default metrics (process CPU, memory, event loop, GC, file descriptors)
	 * - Custom metrics registered with InstrumentationRegistry
	 *
	 * Process:
	 * 1. MetricsGuard checks METRICS_API_KEY if configured
	 * 2. PrometheusExporter.getMetrics() is called to flush pending values and retrieve metrics
	 * 3. Response is sent with Prometheus text format (version 0.0.4)
	 *
	 * Authentication (via MetricsGuard):
	 * - If METRICS_API_KEY is set: requires Bearer token, X-API-Key header, or ?key= query param
	 * - If METRICS_API_KEY is not set: all requests are allowed
	 *
	 * Response Headers:
	 * - Content-Type: text/plain; version=0.0.4; charset=utf-8
	 * - X-Robots-ITag: noindex, nofollow
	 *
	 * @param response - Express response object
	 * @returns Promise that resolves when response is sent
	 *
	 * @example
	 * ```
	 * GET /metrics HTTP/1.1
	 * Authorization: Bearer secret-api-key
	 *
	 * HTTP/1.1 200 OK
	 * Content-Type: text/plain; version=0.0.4; charset=utf-8
	 * X-Robots-ITag: noindex, nofollow
	 *
	 * # HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.
	 * # TYPE process_cpu_user_seconds_total counter
	 * process_cpu_user_seconds_total 0.123456
	 *
	 * # HELP process_resident_memory_bytes Resident memory size in bytes.
	 * # TYPE process_resident_memory_bytes gauge
	 * process_resident_memory_bytes 52428800
	 * ...
	 * ```
	 */
	@Get('metrics')
	@UseGuards(MetricsGuard)
	@Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
	@Header('X-Robots-ITag', 'noindex, nofollow')
	public async getMetrics(@Res() response: Response): Promise<void> {
		const metrics = await this.Exporter.getMetrics();
		response.send(metrics);
	}
}
