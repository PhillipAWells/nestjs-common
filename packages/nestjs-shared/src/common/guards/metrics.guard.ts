import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '../../config/config.service.js';

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
 *   or as a query parameter. Format: "Bearer <api-key>" or "?key=<api-key>"
 */
@Injectable()
export class MetricsGuard implements CanActivate {
	private readonly metricsApiKey: string | undefined;

	constructor(private readonly configService: ConfigService) {
		this.metricsApiKey = this.configService.get('METRICS_API_KEY');
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
			if (scheme === 'Bearer' && token === this.metricsApiKey) {
				return true;
			}
		}

		// Check query parameter as fallback
		const queryKey = request.query.key as string | undefined;
		if (queryKey === this.metricsApiKey) {
			return true;
		}

		// Check X-API-Key header
		const apiKeyHeader = request.headers['x-api-key'] as string | undefined;
		if (apiKeyHeader === this.metricsApiKey) {
			return true;
		}

		throw new ForbiddenException('Invalid or missing metrics API key');
	}
}
