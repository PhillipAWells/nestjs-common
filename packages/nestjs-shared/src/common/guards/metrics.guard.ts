import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { ConfigService } from '../../config/config.service.js';
import { AuditLoggerService } from '../services/audit-logger.service.js';
import { LazyModuleRefService } from '../utils/lazy-getter.types.js';

/**
 * Optional API key guard for the /metrics endpoint
 *
 * This guard checks for a configurable API key if the METRICS_API_KEY environment
 * variable is set. If METRICS_API_KEY is not configured, all requests are allowed
 * (backward compatible behavior).
 *
 * Usage:
 * ```typescript
 * @Controller()
 * export class MetricsController {
 *   @Get('metrics')
 *   @UseGuards(MetricsGuard)
 *   getMetrics(@Res() response: Response) {
 *     // ...
 *   }
 * }
 * ```
 *
 * Environment Variables:
 * - METRICS_API_KEY: Optional. If set, requires this API key in the Authorization header
 *   or X-API-Key header. Format: "Bearer <api-key>" or header "X-API-Key: <api-key>"
 */
@Injectable()
export class MetricsGuard implements CanActivate, LazyModuleRefService {
	constructor(public readonly Module: ModuleRef) {}

	private get Config(): ConfigService {
		return this.Module.get(ConfigService);
	}

	private get AuditLogger(): AuditLoggerService | undefined {
		try {
			return this.Module.get(AuditLoggerService, { strict: false });
		} catch {
			return undefined;
		}
	}

	private get metricsApiKey(): string | undefined {
		return this.Config.get('METRICS_API_KEY');
	}

	/**
	 * Timing-safe comparison of two strings to prevent timing attacks
	 * @param a First string to compare
	 * @param b Second string to compare
	 * @returns true if strings are equal, false otherwise
	 */
	private timingSafeCompare(a: string, b: string | undefined): boolean {
		if (!b) {
			return false;
		}

		try {
			const bufferA = Buffer.from(a);
			const bufferB = Buffer.from(b);

			if (bufferA.length !== bufferB.length) {
				return false;
			}

			return timingSafeEqual(bufferA, bufferB);
		} catch {
			return false;
		}
	}

	public canActivate(context: ExecutionContext): boolean {
		// If no API key is configured, allow all requests
		if (!this.metricsApiKey) {
			return true;
		}

		const request = context.switchToHttp().getRequest<Request>();

		// Check Authorization header (Bearer token)
		const authHeader = request.headers.authorization;
		if (authHeader) {
			const [scheme, token] = authHeader.split(' ');
			if (scheme?.toLowerCase() === 'bearer' && token && this.timingSafeCompare(token, this.metricsApiKey)) {
				this.AuditLogger?.logSecurityEvent({
					timestamp: new Date(),
					action: 'metrics_access',
					resource: '/metrics',
					result: 'success',
					ipAddress: request.ip,
					userAgent: request.get('User-Agent'),
					details: { authMethod: 'bearer' },
				});
				return true;
			}
		}

		// Check X-API-Key header
		const apiKeyHeader = request.headers['x-api-key'] as string | undefined;
		if (apiKeyHeader && this.timingSafeCompare(apiKeyHeader, this.metricsApiKey)) {
			this.AuditLogger?.logSecurityEvent({
				timestamp: new Date(),
				action: 'metrics_access',
				resource: '/metrics',
				result: 'success',
				ipAddress: request.ip,
				userAgent: request.get('User-Agent'),
				details: { authMethod: 'x-api-key' },
			});
			return true;
		}

		throw new ForbiddenException('Invalid or missing metrics API key');
	}
}
