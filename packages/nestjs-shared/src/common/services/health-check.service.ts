import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AppLogger } from './logger.service.js';
import { ILazyModuleRefService } from '../utils/lazy-getter.types.js';

/**
 * Health status enumeration for standardized health check responses.
 */
export enum HealthStatus {
	OK = 'ok',
	READY = 'ready',
	ALIVE = 'alive',
}

/**
 * Health check response interface.
 */
export interface IHealthCheck {
	status: string;
	timestamp: string;
	service?: string;
	version?: string;
	checks?: Record<string, string>;
}

/**
 * Health Check Service.
 * Provides standardized health, readiness, and liveness checks for Kubernetes probes and monitoring.
 *
 * Probe types:
 * - **Health/Status**: General application health (used by load balancers)
 * - **Readiness**: Determines if service should receive traffic (Kubernetes readiness probe)
 * - **Liveness**: Confirms service is alive and responsive (Kubernetes liveness probe)
 *
 * @remarks
 * - All responses include ISO timestamps for log correlation
 * - Supports optional service name and version strings
 * - Readiness probe can include custom checks (database, cache, etc.)
 * - All checks automatically logged via AppLogger for monitoring
 *
 * @example
 * ```typescript
 * // In a health controller
 * @Get('/')
 * health() {
 *   return this.healthService.getHealth('my-service', '1.0.0');
 * }
 *
 * @Get('/ready')
 * readiness() {
 *   const checks = {
 *     database: HealthStatus.OK,
 *     cache: HealthStatus.OK,
 *   };
 *   return this.healthService.getReadiness(checks);
 * }
 *
 * @Get('/live')
 * liveness() {
 *   return this.healthService.getLiveness();
 * }
 * ```
 */
@Injectable()
export class HealthCheckService implements ILazyModuleRefService {
	private _ContextualLogger: AppLogger | undefined;

	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	private get Logger(): AppLogger {
		if (!this._ContextualLogger) {
			const baseLogger = this.Module.get(AppLogger);
			this._ContextualLogger = baseLogger.CreateContextualLogger(HealthCheckService.name);
		}
		return this._ContextualLogger;
	}

	/**
	 * Get application health status
	 * Used for general health checks
	 * @param serviceName - Optional service name
	 * @param version - Optional version string
	 * @returns Health check response
	 */
	public GetHealth(serviceName?: string, version?: string): IHealthCheck {
		this.Logger.Debug('Health check requested');

		const response: IHealthCheck = {
			status: HealthStatus.OK,
			timestamp: new Date().toISOString(),
		};

		if (serviceName) {
			response.service = serviceName;
		}

		if (version) {
			response.version = version;
		}

		this.Logger.Debug(`Health check response: ${JSON.stringify(response)}`);
		return response;
	}

	/**
	 * Get application readiness status
	 * Used for Kubernetes readiness probes to determine if service should receive traffic
	 * @param checks - Optional custom health checks (e.g., database, cache status)
	 * @returns Readiness check response
	 */
	public GetReadiness(checks?: Record<string, string>): IHealthCheck {
		this.Logger.Debug('Readiness check requested');

		const response: IHealthCheck = {
			status: HealthStatus.READY,
			timestamp: new Date().toISOString(),
			checks: checks ?? {},
		};

		this.Logger.Debug(`Readiness check response: ${JSON.stringify(response)}`);
		return response;
	}

	/**
	 * Get application liveness status
	 * Used for Kubernetes liveness probes to determine if service is alive
	 * @returns Liveness check response
	 */
	public GetLiveness(): IHealthCheck {
		this.Logger.Debug('Liveness check requested');

		const response: IHealthCheck = {
			status: HealthStatus.ALIVE,
			timestamp: new Date().toISOString(),
		};

		this.Logger.Debug(`Liveness check response: ${JSON.stringify(response)}`);
		return response;
	}
}
