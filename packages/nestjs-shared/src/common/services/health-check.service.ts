import { Injectable, Inject } from '@nestjs/common';
import { AppLogger } from './logger.service.js';

/**
 * Health status enumeration for standardized health check responses
 */
export enum HealthStatus {
	OK = 'ok',
	READY = 'ready',
	ALIVE = 'alive',
}

export interface IHealthCheck {
	status: string;
	timestamp: string;
	service?: string;
	version?: string;
	checks?: Record<string, string>;
}

/**
 * Health check service for Kubernetes probes and monitoring
 * Provides standardized health, readiness, and liveness checks
 */
@Injectable()
export class HealthCheckService {
	private readonly contextualLogger: AppLogger;

	constructor(@Inject(AppLogger) logger: AppLogger) {
		this.contextualLogger = logger.createContextualLogger(HealthCheckService.name);
	}

	/**
	 * Get application health status
	 * Used for general health checks
	 * @param serviceName - Optional service name
	 * @param version - Optional version string
	 * @returns Health check response
	 */
	public getHealth(serviceName?: string, version?: string): IHealthCheck {
		this.contextualLogger.debug('Health check requested');

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

		this.contextualLogger.debug(`Health check response: ${JSON.stringify(response)}`);
		return response;
	}

	/**
	 * Get application readiness status
	 * Used for Kubernetes readiness probes to determine if service should receive traffic
	 * @param checks - Optional custom health checks (e.g., database, cache status)
	 * @returns Readiness check response
	 */
	public getReadiness(checks?: Record<string, string>): IHealthCheck {
		this.contextualLogger.debug('Readiness check requested');

		const defaultChecks = {
			database: HealthStatus.OK,
			cache: HealthStatus.OK,
		};

		const response: IHealthCheck = {
			status: HealthStatus.READY,
			timestamp: new Date().toISOString(),
			checks: checks ?? defaultChecks,
		};

		this.contextualLogger.debug(`Readiness check response: ${JSON.stringify(response)}`);
		return response;
	}

	/**
	 * Get application liveness status
	 * Used for Kubernetes liveness probes to determine if service is alive
	 * @returns Liveness check response
	 */
	public getLiveness(): IHealthCheck {
		this.contextualLogger.debug('Liveness check requested');

		const response: IHealthCheck = {
			status: HealthStatus.ALIVE,
			timestamp: new Date().toISOString(),
		};

		this.contextualLogger.debug(`Liveness check response: ${JSON.stringify(response)}`);
		return response;
	}
}
