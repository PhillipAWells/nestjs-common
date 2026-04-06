import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { PyroscopeService } from '../service.js';
import { PYROSCOPE_CONFIG_TOKEN } from '../constants.js';
import { PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD } from '../constants/profiling.constants.js';
import type { IPyroscopeConfig } from '../interfaces/profiling.interface.js';

/**
 * Health indicator for Pyroscope profiling service.
 *
 * Integrates with NestJS @nestjs/terminus Health Check module to provide
 * profiling service health status in application health checks.
 *
 * Features:
 * - Checks if profiling service is initialized
 * - Monitors active profile count and detects degradation
 * - Provides detailed health status and metrics
 *
 * When to use:
 * - You want to include profiling health in your application health checks
 * - You need to monitor profiling service status
 * - You're using NestJS health checks with terminus module
 *
 * @example
 * ```typescript
 * @Controller('health')
 * @Injectable()
 * export class HealthController {
 *   constructor(
 *     private health: HealthCheckService,
 *     private profiling: ProfilingHealthIndicator,
 *   ) {}
 *
 *   @Get()
 *   check() {
 *     return this.health.check([
 *       () => this.profiling.check('profiling'),
 *     ]);
 *   }
 * }
 * ```
 *
 * @remarks
 * - Returns 'healthy' if profiling is disabled
 * - Returns 'unhealthy' if profiling is enabled but not initialized
 * - Returns 'healthy' with degraded warning if active profiles exceed threshold
 * - Used internally by HealthController if enableHealthChecks is true
 */
@Injectable()
export class ProfilingHealthIndicator extends HealthIndicator {
	private readonly ModuleRef: ModuleRef;

	constructor(moduleRef: ModuleRef) {
		super();
		this.ModuleRef = moduleRef;
	}

	private get PyroscopeService(): PyroscopeService {
		return this.ModuleRef.get(PyroscopeService, { strict: false });
	}

	private get Config(): IPyroscopeConfig {
		return this.ModuleRef.get(PYROSCOPE_CONFIG_TOKEN, { strict: false });
	}

	/**
	 * Check profiling service health.
	 *
	 * @param key Key for the health indicator result (e.g., 'profiling')
	 * @returns HealthIndicatorResult with profiling health status
	 *
	 * @example
	 * ```typescript
	 * const health = this.profiling.check('profiling');
	 * // Returns { profiling: { status: 'up', initialized: true, activeProfiles: 42 } }
	 * ```
	 */
	public Check(key: string): HealthIndicatorResult {
		const Health = this.PyroscopeService.GetHealth();

		if (!Health.details.initialized && this.PyroscopeService.IsEnabled()) {
			return this.getStatus(key, false, {
				message: 'Pyroscope profiling is enabled but not initialized',
				enabled: Health.details.enabled,
				initialized: Health.details.initialized,
			});
		}

		if ((Health.details.activeProfiles ?? 0) > (this.Config.degradedActiveProfilesThreshold ?? PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD)) {
			return this.getStatus(key, false, {
				message: 'Too many active profiles, service may be degraded',
				activeProfiles: Health.details.activeProfiles,
				totalMetrics: Health.details.totalMetrics,
			});
		}

		return this.getStatus(key, true, {
			initialized: Health.details.initialized,
			activeProfiles: Health.details.activeProfiles,
			totalMetrics: Health.details.totalMetrics,
		});
	}
}
