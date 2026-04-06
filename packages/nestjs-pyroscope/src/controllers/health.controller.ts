import { Controller, Get, Header, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PyroscopeService } from '../service.js';
import { MetricsService } from '../services/metrics.service.js';
import type { IMetricsResponse } from '../services/metrics.service.js';
import { PYROSCOPE_CONFIG_TOKEN } from '../constants.js';
import { PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD } from '../constants/profiling.constants.js';
import type { IPyroscopeConfig } from '../interfaces/profiling.interface.js';

/**
 * Health response interface
 */
export interface IHealthResponse {
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
 * Health check controller for profiling service.
 *
 * Provides REST endpoints for monitoring profiling health, metrics, and status.
 * Automatically registered when enableHealthChecks is not false in module config.
 *
 * Features:
 * - Real-time health status endpoint
 * - Metrics aggregation and export
 * - Prometheus format metrics support
 * - Comprehensive status information
 *
 * Routes (mounted at /profiling):
 * - GET /profiling/health - Health status check
 * - GET /profiling/metrics - Aggregated metrics (JSON)
 * - GET /profiling/status - Combined health and metrics
 * - GET /profiling/metrics/prometheus - Prometheus format metrics
 *
 * WARNING: These endpoints expose infrastructure and performance information.
 * They should be protected at the network level (firewall, VPN, internal network only).
 */
@Controller('profiling')
export class HealthController {
	private readonly ModuleRef: ModuleRef;

	constructor(@Inject(ModuleRef) moduleRef: ModuleRef) {
		this.ModuleRef = moduleRef;
	}

	private get PyroscopeService(): PyroscopeService {
		return this.ModuleRef.get(PyroscopeService, { strict: false });
	}

	private get MetricsService(): MetricsService {
		return this.ModuleRef.get(MetricsService, { strict: false });
	}

	private get Config(): IPyroscopeConfig {
		return this.ModuleRef.get(PYROSCOPE_CONFIG_TOKEN, { strict: false });
	}

	/**
	 * Get profiling service health status.
	 *
	 * Returns comprehensive health information including initialization status,
	 * active profile count, and Pyroscope server connectivity.
	 *
	 * WARNING: This endpoint exposes infrastructure information (server address,
	 * application name, active profiles). It should be protected at the network
	 * level (firewall, VPN, internal network only).
	 *
	 * @returns IHealthResponse with comprehensive health information
	 *
	 * @example
	 * ```
	 * GET /profiling/health
	 * {
	 *   "status": "healthy",
	 *   "timestamp": 1710429254123,
	 *   "uptime": 3600.5,
	 *   "pyroscope": {
	 *     "connected": true,
	 *     "serverAddress": "http://localhost:4040",
	 *     "applicationName": "my-app",
	 *     "lastUpdate": 1710429254123
	 *   },
	 *   "profiling": {
	 *     "enabled": true,
	 *     "activeProfiles": 12,
	 *     "totalProfiles": 5430
	 *   }
	 * }
	 * ```
	 */
	@Get('health')
	@Header('Cache-Control', 'no-store')
	public GetHealth(): IHealthResponse {
		const PyroscopeHealth = this.PyroscopeService.GetHealth();
		const Metrics = this.MetricsService.GetMetrics();

		// Determine overall health status
		let Status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

		if (!PyroscopeHealth.details.initialized && this.PyroscopeService.IsEnabled()) {
			Status = 'unhealthy';
		} else if ((PyroscopeHealth.details.activeProfiles ?? 0) > (this.Config.degradedActiveProfilesThreshold ?? PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD)) {
			// Consider degraded if too many active profiles
			Status = 'degraded';
		}

		return {
			status: Status,
			timestamp: Date.now(),
			uptime: process.uptime(),
			pyroscope: {
				connected: PyroscopeHealth.details.initialized ?? false,
				serverAddress: PyroscopeHealth.details.serverAddress ?? '',
				applicationName: PyroscopeHealth.details.applicationName ?? '',
				lastUpdate: Metrics.timestamp,
			},
			profiling: {
				enabled: this.PyroscopeService.IsEnabled(),
				activeProfiles: PyroscopeHealth.details.activeProfiles ?? 0,
				totalProfiles: PyroscopeHealth.details.totalMetrics ?? 0,
			},
		};
	}

	/**
	 * Get current profiling metrics.
	 *
	 * Returns aggregated profiling metrics including CPU samples, memory allocations,
	 * and request statistics.
	 *
	 * WARNING: This endpoint exposes profiling metrics which reveal performance
	 * characteristics. It should be protected at the network level (firewall, VPN,
	 * internal network only).
	 *
	 * @returns IMetricsResponse with aggregated profiling data
	 *
	 * @example
	 * ```
	 * GET /profiling/metrics
	 * {
	 *   "timestamp": 1710429254123,
	 *   "cpu": {
	 *     "samples": 1250,
	 *     "duration": 45000
	 *   },
	 *   "memory": {
	 *     "samples": 890,
	 *     "allocations": 512000000
	 *   },
	 *   "requests": {
	 *     "total": 5430,
	 *     "successful": 5389,
	 *     "failed": 41,
	 *     "averageResponseTime": 125.34
	 *   }
	 * }
	 * ```
	 */
	@Get('metrics')
	@Header('Cache-Control', 'no-store')
	public GetMetrics(): IMetricsResponse {
		return this.MetricsService.GetMetrics();
	}

	/**
	 * Get detailed status information.
	 *
	 * Returns both health and metrics in a single response for comprehensive
	 * profiling service status.
	 *
	 * WARNING: This endpoint exposes comprehensive infrastructure and profiling data.
	 * It should be protected at the network level (firewall, VPN, internal network only).
	 *
	 * @returns Comprehensive status including health and metrics
	 */
	@Get('status')
	@Header('Cache-Control', 'no-store')
	public GetStatus(): { health: IHealthResponse; metrics: IMetricsResponse } {
		return {
			health: this.GetHealth(),
			metrics: this.GetMetrics(),
		};
	}

	/**
	 * Get metrics in Prometheus format.
	 *
	 * Returns profiling metrics in standard Prometheus exposition format for
	 * easy integration with Prometheus monitoring systems.
	 *
	 * WARNING: This endpoint exposes profiling metrics in Prometheus format,
	 * revealing performance characteristics. It should be protected at the network
	 * level (firewall, VPN, internal network only).
	 *
	 * @returns String containing metrics in Prometheus exposition format
	 *
	 * @example
	 * ```
	 * GET /profiling/metrics/prometheus
	 * # HELP profiling_cpu_samples_total Total number of CPU profiling samples collected
	 * # TYPE profiling_cpu_samples_total counter
	 * profiling_cpu_samples_total 1250
	 * ...
	 * ```
	 */
	@Get('metrics/prometheus')
	@Header('Cache-Control', 'no-store')
	public GetPrometheusMetrics(): string {
		return this.MetricsService.GetPrometheusMetrics();
	}
}
