import { Controller, Get, Header, Res, Inject } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsRegistryService } from '../services/metrics-registry.service.js';
import { AppLogger } from '../services/logger.service.js';
import { HTTP_STATUS_INTERNAL_SERVER_ERROR } from '../constants/http-status.constants.js';
import { getErrorMessage } from '../utils/error.utils.js';

/**
 * Exposes Prometheus metrics at GET /metrics.
 *
 * IMPORTANT: This endpoint should be restricted to internal/monitoring networks
 * via reverse proxy (nginx, Traefik, etc.) or firewall rules. Do not expose
 * this endpoint publicly in production.
 */
@Controller()
export class MetricsController {
	private readonly MetricsService: MetricsRegistryService;
	@Inject(AppLogger)
	private readonly Logger: AppLogger;

	constructor(
		metricsService: MetricsRegistryService,
		@Inject(AppLogger) logger: AppLogger,
	) {
		this.MetricsService = metricsService;
		this.Logger = logger;
	}

	/**
	 * GET /metrics
	 *
	 * Returns Prometheus metrics in text format for scraping.
	 * This endpoint should be configured for pull-based monitoring.
	 */
	@Get('metrics')
	@Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
	@Header('X-Robots-ITag', 'noindex, nofollow')
	public async getMetrics(@Res() response: Response): Promise<void> {
		try {
			const metrics = await this.MetricsService.getMetrics();
			response.send(metrics);
		} catch (error) {
			this.Logger.error('Failed to collect metrics', getErrorMessage(error));
			// Return empty metrics on error to avoid breaking scrapers
			response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).send('# Error collecting metrics\n');
		}
	}
}
