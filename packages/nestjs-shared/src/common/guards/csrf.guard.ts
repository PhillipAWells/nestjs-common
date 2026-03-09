import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Optional } from '@nestjs/common';
import { Request } from 'express';
import { CSRFService } from '../services/csrf.service.js';
import { AppLogger } from '../services/logger.service.js';
import { AuditLoggerService } from '../services/audit-logger.service.js';

/**
 * Guard that validates CSRF tokens on requests to prevent Cross-Site Request Forgery attacks.
 * Automatically bypasses validation for safe HTTP methods (GET, HEAD, OPTIONS) and enforces
 * token validation for state-changing operations (POST, PUT, DELETE, PATCH).
 *
 * Use this guard globally or on specific routes that require CSRF protection:
 * ```typescript
 * app.useGlobalGuards(new CSRFGuard(csrfService, logger));
 * // or on a controller:
 * @UseGuards(CSRFGuard)
 * export class MyController { ... }
 * ```
 */

@Injectable()
export class CSRFGuard implements CanActivate {
	constructor(
		private readonly csrfService: CSRFService,
		@Optional() private readonly logger?: AppLogger,
		@Optional() private readonly auditLogger?: AuditLoggerService,
	) {}

	/**
	 * Evaluate whether the current request is authorized based on CSRF token validity.
	 * Allows safe methods (GET, HEAD, OPTIONS) without validation. For state-changing
	 * requests, validates the CSRF token and logs failures for audit trails.
	 *
	 * @param context - The execution context containing request/response objects
	 * @returns true if request is authorized or safe method; throws ForbiddenException if validation fails
	 *
	 * @throws ForbiddenException when CSRF token validation fails on state-changing requests
	 */

	public canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request>();

		// Skip CSRF validation for GET, HEAD, OPTIONS
		if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
			return true;
		}

		// Validate CSRF token
		if (!this.csrfService.validateToken(request)) {
			// Extract IP address from request — prefer request.ip which respects trustProxy
			const ipAddress = request.ip ?? (request.socket as { remoteAddress?: string } | undefined)?.remoteAddress ?? 'unknown';
			const endpoint = request.path ?? request.url ?? 'unknown';

			// Log via audit logger if available
			this.auditLogger?.logCsrfViolation(ipAddress, endpoint);

			// Also log via app logger for backward compatibility
			this.logger?.warn('CSRF token validation failed', 'CSRFGuard', {
				ip: ipAddress,
				path: endpoint,
				method: request.method,
			});

			throw new ForbiddenException('Invalid CSRF token');
		}

		return true;
	}
}
