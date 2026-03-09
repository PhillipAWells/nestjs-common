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
 * @example
 * ```
 * GET /metrics
 *
 * Response:
 * 200 OK
 * Content-Type: text/plain; version=0.0.4; charset=utf-8
 *
 * # HELP http_request_duration_seconds Duration of HTTP requests in seconds
 * # TYPE http_request_duration_seconds histogram
 * http_request_duration_seconds_bucket{le="0.001",...} 0
 * ...
 * ```
 */
@Controller()
export class MetricsController {
	constructor(private readonly exporter: PrometheusExporter) {}

	/**
	 * Get all metrics in Prometheus text format
	 *
	 * Returns the current state of all metrics in Prometheus text format (version 0.0.4).
	 * Metrics include Node.js default metrics (event loop, GC, memory) plus any
	 * application-specific metrics registered with the InstrumentationRegistry.
	 *
	 * Protected by MetricsGuard: checks METRICS_API_KEY env var if configured.
	 * If METRICS_API_KEY is set, requires Bearer token, X-API-Key header, or ?key= query param.
	 * If not set, all requests are allowed.
	 *
	 * @param response - Express response object
	 *
	 * @example
	 * ```
	 * GET /metrics HTTP/1.1
	 * Authorization: Bearer <METRICS_API_KEY>
	 *
	 * HTTP/1.1 200 OK
	 * Content-Type: text/plain; version=0.0.4; charset=utf-8
	 * X-Robots-Tag: noindex, nofollow
	 *
	 * # HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.
	 * # TYPE process_cpu_user_seconds_total counter
	 * process_cpu_user_seconds_total 0.123456
	 * ...
	 * ```
	 */
	@Get('metrics')
	@UseGuards(MetricsGuard)
	@Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
	@Header('X-Robots-Tag', 'noindex, nofollow')
	public async getMetrics(@Res() response: Response): Promise<void> {
		const metrics = await this.exporter.getMetrics();
		response.send(metrics);
	}
}
