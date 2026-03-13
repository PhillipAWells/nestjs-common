import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Request } from 'express';
import { CSRFService } from '../services/csrf.service.js';
import { AppLogger } from '../services/logger.service.js';
import { AuditLoggerService } from '../services/audit-logger.service.js';
import { LazyModuleRefService } from '../utils/lazy-getter.types.js';

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
export class CSRFGuard implements CanActivate, LazyModuleRefService {
	constructor(public readonly Module: ModuleRef) {}

	private get CsrfService(): CSRFService {
		return this.Module.get(CSRFService);
	}

	private get Logger(): AppLogger | undefined {
		try {
			return this.Module.get(AppLogger, { strict: false });
		} catch {
			return undefined;
		}
	}

	private get AuditLogger(): AuditLoggerService | undefined {
		try {
			return this.Module.get(AuditLoggerService, { strict: false });
		} catch {
			return undefined;
		}
	}

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
		if (!this.CsrfService.validateToken(request)) {
			// Extract IP address from request — prefer request.ip which respects trustProxy
			const ipAddress = request.ip ?? (request.socket as { remoteAddress?: string } | undefined)?.remoteAddress ?? 'unknown';
			const endpoint = request.path ?? request.url ?? 'unknown';

			// Log via audit logger if available
			this.AuditLogger?.logCsrfViolation(ipAddress, endpoint);

			// Also log via app logger for backward compatibility
			this.Logger?.warn('CSRF token validation failed', 'CSRFGuard', {
				ip: ipAddress,
				path: endpoint,
				method: request.method,
			});

			throw new ForbiddenException('Invalid CSRF token');
		}

		return true;
	}
}
