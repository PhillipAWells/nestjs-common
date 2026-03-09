import { Controller, Get, Inject, Header } from '@nestjs/common';
import { HealthCheck } from '@nestjs/terminus';
import { PyroscopeService } from '../service.js';
import { MetricsService } from '../services/metrics.service.js';
import type { MetricsResponse } from '../services/metrics.service.js';
import { PYROSCOPE_CONFIG_TOKEN } from '../constants.js';
import { PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD } from '../constants/profiling.constants.js';
import type { IPyroscopeConfig } from '../interfaces/profiling.interface.js';

/**
 * Health response interface
 */
export interface HealthResponse {
	status: 'healthy' | 'unhealthy' | 'degraded';
	timestamp: number;
	uptime: number;
	pyroscope: {
		connected: boolean;
		serverAddress: string;
		applicationName: string;
		lastUpdate: number;
	};
	profiling: {
		enabled: boolean;
		activeProfiles: number;
		totalProfiles: number;
	};
}

/**
 * Health check controller for profiling service
 * Provides endpoints for monitoring profiling health and metrics
 */
@Controller('profiling')
export class HealthController {
	constructor(
		private readonly pyroscopeService: PyroscopeService,
		@Inject(MetricsService) private readonly metricsService: MetricsService,
		@Inject(PYROSCOPE_CONFIG_TOKEN) private readonly config: IPyroscopeConfig,
	) {}

	/**
	 * Get profiling service health status
	 * WARNING: This endpoint exposes infrastructure information (server address, application name, active profiles).
	 * It should be protected at the network level (firewall, VPN, internal network only).
	 * @returns HealthResponse with comprehensive health information
	 */
	@Get('health')
	@HealthCheck()
	@Header('Cache-Control', 'no-store')
	public getHealth(): HealthResponse {
		const pyroscopeHealth = this.pyroscopeService.getHealth();
		const metrics = this.metricsService.getMetrics();

		// Determine overall health status
		let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

		if (!pyroscopeHealth.details.initialized && this.pyroscopeService.isEnabled()) {
			status = 'unhealthy';
		} else if (pyroscopeHealth.details.activeProfiles > (this.config.degradedActiveProfilesThreshold ?? PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD)) {
			// Consider degraded if too many active profiles
			status = 'degraded';
		}

		return {
			status,
			timestamp: Date.now(),
			uptime: process.uptime(),
			pyroscope: {
				connected: pyroscopeHealth.details.initialized,
				serverAddress: pyroscopeHealth.details.serverAddress ?? '',
				applicationName: pyroscopeHealth.details.applicationName ?? '',
				lastUpdate: metrics.timestamp,
			},
			profiling: {
				enabled: this.pyroscopeService.isEnabled(),
				activeProfiles: pyroscopeHealth.details.activeProfiles,
				totalProfiles: pyroscopeHealth.details.totalMetrics,
			},
		};
	}

	/**
	 * Get current profiling metrics
	 * WARNING: This endpoint exposes profiling metrics which reveal performance characteristics.
	 * It should be protected at the network level (firewall, VPN, internal network only).
	 * @returns MetricsResponse with aggregated profiling data
	 */
	@Get('metrics')
	@Header('Cache-Control', 'no-store')
	public getMetrics(): MetricsResponse {
		return this.metricsService.getMetrics();
	}

	/**
	 * Get detailed status information
	 * WARNING: This endpoint exposes comprehensive infrastructure and profiling data.
	 * It should be protected at the network level (firewall, VPN, internal network only).
	 * @returns Comprehensive status including health and metrics
	 */
	@Get('status')
	@Header('Cache-Control', 'no-store')
	public getStatus(): { health: HealthResponse; metrics: MetricsResponse } {
		return {
			health: this.getHealth(),
			metrics: this.getMetrics(),
		};
	}

	/**
	 * Get metrics in Prometheus format
	 * WARNING: This endpoint exposes profiling metrics in Prometheus format, revealing performance characteristics.
	 * It should be protected at the network level (firewall, VPN, internal network only).
	 * @returns String containing metrics in Prometheus exposition format
	 */
	@Get('metrics/prometheus')
	@Header('Cache-Control', 'no-store')
	public getPrometheusMetrics(): string {
		return this.metricsService.getPrometheusMetrics();
	}
}
