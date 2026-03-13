import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { PyroscopeService } from '../service.js';
import { PYROSCOPE_CONFIG_TOKEN } from '../constants.js';
import { PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD } from '../constants/profiling.constants.js';
import type { IPyroscopeConfig } from '../interfaces/profiling.interface.js';

/**
 * Health indicator for Pyroscope profiling service
 * Integrates with NestJS Health Check module
 */
@Injectable()
export class ProfilingHealthIndicator extends HealthIndicator {
	constructor(public readonly Module: ModuleRef) {
		super();
	}

	private get pyroscopeService(): PyroscopeService {
		return this.Module.get(PyroscopeService, { strict: false }); 
	}

	private get config(): IPyroscopeConfig {
		return this.Module.get(PYROSCOPE_CONFIG_TOKEN, { strict: false }); 
	}

	/**
	 * Check profiling service health
	 * @param key Key for the health indicator result
	 * @returns HealthIndicatorResult with profiling health status
	 */
	public check(key: string): HealthIndicatorResult {
		const health = this.pyroscopeService.getHealth();

		if (!health.details.initialized && this.pyroscopeService.isEnabled()) {
			return this.getStatus(key, false, {
				message: 'Pyroscope profiling is enabled but not initialized',
				enabled: health.details.enabled,
				initialized: health.details.initialized,
			});
		}

		if ((health.details.activeProfiles ?? 0) > (this.config.degradedActiveProfilesThreshold ?? PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD)) {
			return this.getStatus(key, false, {
				message: 'Too many active profiles, service may be degraded',
				activeProfiles: health.details.activeProfiles,
				totalMetrics: health.details.totalMetrics,
			});
		}

		return this.getStatus(key, true, {
			initialized: health.details.initialized,
			activeProfiles: health.details.activeProfiles,
			totalMetrics: health.details.totalMetrics,
		});
	}
}
