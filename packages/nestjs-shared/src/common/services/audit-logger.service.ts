import { Injectable } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { LazyModuleRefService } from '../utils/lazy-getter.types.js';
import { AppLogger } from './logger.service.js';

export interface AuditLogEntry {
	timestamp: Date;
	userId?: string;
	action: string;
	resource: string;
	result: 'success' | 'failure';
	details?: Record<string, any>;
	ipAddress?: string;
	userAgent?: string;
}

@Injectable()
export class AuditLoggerService implements LazyModuleRefService {
	private _contextualLogger: AppLogger | undefined;

	constructor(public readonly Module: ModuleRef) {}

	public get Logger(): AppLogger {
		if (!this._contextualLogger) {
			const baseLogger = this.Module.get(AppLogger);
			this._contextualLogger = baseLogger.createContextualLogger(AuditLoggerService.name);
		}
		return this._contextualLogger;
	}

	/**
	 * Log authentication attempt
	 */
	public logAuthenticationAttempt(
		email: string,
		success: boolean,
		ipAddress?: string,
		reason?: string,
	): void {
		const auditData = {
			event: 'authentication',
			email,
			success,
			ipAddress,
			reason,
			timestamp: new Date().toISOString(),
		};
		this.Logger.info(
			`Authentication ${success ? 'SUCCESS' : 'FAILURE'}: ${email}${reason ? ` - ${reason}` : ''} | ${JSON.stringify(auditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log authorization failure
	 */
	public logAuthorizationFailure(
		userId: string,
		resource: string,
		action: string,
		ipAddress?: string,
	): void {
		const auditData = {
			event: 'authorization_failure',
			userId,
			resource,
			action,
			ipAddress,
			timestamp: new Date().toISOString(),
		};
		this.Logger.warn(
			`Authorization FAILURE: User ${userId} attempted ${action} on ${resource} | ${JSON.stringify(auditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log token generation
	 */
	public logTokenGeneration(userId: string, tokenType: 'access' | 'refresh'): void {
		const auditData = {
			event: 'token_generation',
			userId,
			tokenType,
			timestamp: new Date().toISOString(),
		};
		this.Logger.info(
			`Token GENERATED: ${tokenType} token for user ${userId} | ${JSON.stringify(auditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log token revocation
	 */
	public logTokenRevocation(userId: string, reason: string): void {
		const auditData = {
			event: 'token_revocation',
			userId,
			reason,
			timestamp: new Date().toISOString(),
		};
		this.Logger.info(
			`Token REVOCATION: User ${userId} - ${reason} | ${JSON.stringify(auditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log rate limit violation
	 */
	public logRateLimitViolation(
		endpoint: string,
		ipAddress: string,
		limit: number,
	): void {
		const auditData = {
			event: 'rate_limit_violation',
			endpoint,
			ipAddress,
			limit,
			timestamp: new Date().toISOString(),
		};
		this.Logger.warn(
			`Rate LIMIT VIOLATION: ${endpoint} from ${ipAddress} (limit: ${limit}/min) | ${JSON.stringify(auditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log CSRF violation
	 */
	public logCsrfViolation(ipAddress: string, endpoint: string): void {
		const auditData = {
			event: 'csrf_violation',
			ipAddress,
			endpoint,
			timestamp: new Date().toISOString(),
		};
		this.Logger.warn(
			`CSRF VIOLATION: ${endpoint} from ${ipAddress} | ${JSON.stringify(auditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log security configuration change
	 */
	public logConfigurationChange(
		userId: string,
		config: string,
		oldValue: any,
		newValue: any,
	): void {
		const auditData = {
			event: 'config_change',
			userId,
			config,
			oldValue,
			newValue,
			timestamp: new Date().toISOString(),
		};
		this.Logger.info(
			`Configuration CHANGE: ${config} modified by ${userId} | ${JSON.stringify(auditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log data access
	 */
	public logDataAccess(userId: string, resource: string, action: string): void {
		const auditData = {
			event: 'data_access',
			userId,
			resource,
			action,
			timestamp: new Date().toISOString(),
		};
		this.Logger.info(
			`Data ACCESS: User ${userId} ${action} ${resource} | ${JSON.stringify(auditData)}`,
			'AuditLogger',
		);
	}

	/**
	 * Log security event
	 */
	public logSecurityEvent(entry: AuditLogEntry): void {
		const auditData = {
			...entry,
			timestamp: new Date().toISOString(),
		};
		this.Logger.info(
			`Security EVENT: ${entry.action} on ${entry.resource} - ${entry.result} | ${JSON.stringify(auditData)}`,
			'AuditLogger',
		);
	}
}
