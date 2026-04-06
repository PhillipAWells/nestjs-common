import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ILazyModuleRefService } from '../utils/lazy-getter.types.js';
import { AppLogger } from './logger.service.js';
import { EscapeNewlines } from '../utils/sanitization.utils.js';

/**
 * Audit log entry for security events.
 */
export interface IAuditLogEntry {
	timestamp: Date;
	userId?: string;
	action: string;
	resource: string;
	result: 'success' | 'failure';
	details?: Record<string, any>;
	ipAddress?: string;
	userAgent?: string;
}

/**
 * Audit Logger Service.
 * Specialized logging for security-related events: authentication, authorization, token operations,
 * CSRF violations, rate limiting, and configuration changes.
 *
 * All audit events are logged at INFO level (or WARN for failures) with structured JSON data
 * for easy parsing by log aggregation systems (Loki, Splunk, etc.).
 *
 * @remarks
 * - Automatically redacts sensitive fields (passwords, tokens) via AppLogger
 * - All events include ISO timestamps and structured event data
 * - Integrates with log aggregation for compliance and forensics
 * - Available globally via CommonModule
 *
 * @example
 * ```typescript
 * // Log authentication attempt
 * auditLogger.logAuthenticationAttempt('user@example.com', true, '192.168.1.1');
 *
 * // Log CSRF violation
 * auditLogger.logCsrfViolation('192.168.1.1', '/api/users');
 *
 * // Log custom security event
 * auditLogger.logSecurityEvent({
 *   userId: 'user-123',
 *   action: 'delete_user',
 *   resource: 'users/456',
 *   result: 'failure',
 *   ipAddress: '192.168.1.1'
 * });
 * ```
 */
@Injectable()
export class AuditLoggerService implements ILazyModuleRefService {
	private _ContextualLogger: AppLogger | undefined;

	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	public get Logger(): AppLogger {
		if (!this._ContextualLogger) {
			const BaseLogger = this.Module.get(AppLogger);
			this._ContextualLogger = BaseLogger.CreateContextualLogger(AuditLoggerService.name);
		}
		return this._ContextualLogger;
	}

	/**
	 * Log authentication attempt
	 */
	public LogAuthenticationAttempt(
		email: string,
		success: boolean,
		ipAddress?: string,
		reason?: string,
	): void {
		const AuditData = {
			event: 'authentication',
			email,
			success,
			ipAddress,
			reason,
			timestamp: new Date().toISOString(),
		};
		this.Logger.info(
			`Authentication ${success ? 'SUCCESS' : 'FAILURE'}: ${EscapeNewlines(email)}${reason ? ` - ${EscapeNewlines(reason)}` : ''} | ${JSON.stringify(AuditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log authorization failure
	 */
	public LogAuthorizationFailure(
		userId: string,
		resource: string,
		action: string,
		ipAddress?: string,
	): void {
		const AuditData = {
			event: 'authorization_failure',
			userId,
			resource,
			action,
			ipAddress,
			timestamp: new Date().toISOString(),
		};
		this.Logger.warn(
			`Authorization FAILURE: IUser ${EscapeNewlines(userId)} attempted ${EscapeNewlines(action)} on ${EscapeNewlines(resource)} | ${JSON.stringify(AuditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log token generation
	 */
	public LogTokenGeneration(userId: string, tokenType: 'access' | 'refresh'): void {
		const AuditData = {
			event: 'token_generation',
			userId,
			tokenType,
			timestamp: new Date().toISOString(),
		};
		this.Logger.info(
			`Token GENERATED: ${tokenType} token for user ${EscapeNewlines(userId)} | ${JSON.stringify(AuditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log token revocation
	 */
	public LogTokenRevocation(userId: string, reason: string): void {
		const AuditData = {
			event: 'token_revocation',
			userId,
			reason,
			timestamp: new Date().toISOString(),
		};
		this.Logger.info(
			`Token REVOCATION: IUser ${EscapeNewlines(userId)} - ${EscapeNewlines(reason)} | ${JSON.stringify(AuditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log rate limit violation
	 */
	public LogRateLimitViolation(
		endpoint: string,
		ipAddress: string,
		limit: number,
	): void {
		const AuditData = {
			event: 'rate_limit_violation',
			endpoint,
			ipAddress,
			limit,
			timestamp: new Date().toISOString(),
		};
		this.Logger.warn(
			`Rate LIMIT VIOLATION: ${EscapeNewlines(endpoint)} from ${EscapeNewlines(ipAddress)} (limit: ${limit}/min) | ${JSON.stringify(AuditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log CSRF violation
	 */
	public LogCsrfViolation(ipAddress: string, endpoint: string): void {
		const AuditData = {
			event: 'csrf_violation',
			ipAddress,
			endpoint,
			timestamp: new Date().toISOString(),
		};
		this.Logger.warn(
			`CSRF VIOLATION: ${EscapeNewlines(endpoint)} from ${EscapeNewlines(ipAddress)} | ${JSON.stringify(AuditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log security configuration change
	 */
	public LogConfigurationChange(
		userId: string,
		config: string,
		oldValue: any,
		newValue: any,
	): void {
		const AuditData = {
			event: 'config_change',
			userId,
			config,
			oldValue,
			newValue,
			timestamp: new Date().toISOString(),
		};
		this.Logger.info(
			`Configuration CHANGE: ${EscapeNewlines(config)} modified by ${EscapeNewlines(userId)} | ${JSON.stringify(AuditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log data access
	 */
	public LogDataAccess(userId: string, resource: string, action: string): void {
		const AuditData = {
			event: 'data_access',
			userId,
			resource,
			action,
			timestamp: new Date().toISOString(),
		};
		this.Logger.info(
			`Data ACCESS: IUser ${EscapeNewlines(userId)} ${EscapeNewlines(action)} ${EscapeNewlines(resource)} | ${JSON.stringify(AuditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log security event
	 */
	public LogSecurityEvent(entry: IAuditLogEntry): void {
		const AuditData = {
			...entry,
			timestamp: new Date().toISOString(),
		};
		this.Logger.info(
			`Security EVENT: ${EscapeNewlines(entry.action)} on ${EscapeNewlines(entry.resource)} - ${entry.result} | ${JSON.stringify(AuditData)}`,
			'AuditLogger',
		);
	}
}
