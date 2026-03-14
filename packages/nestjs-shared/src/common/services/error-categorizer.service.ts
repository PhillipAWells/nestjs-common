import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
	HTTP_STATUS_BAD_REQUEST,
	HTTP_STATUS_UNAUTHORIZED,
	HTTP_STATUS_FORBIDDEN,
	HTTP_STATUS_NOT_FOUND,
	HTTP_STATUS_TOO_MANY_REQUESTS,
	HTTP_STATUS_BAD_GATEWAY,
	HTTP_STATUS_SERVICE_UNAVAILABLE,
	HTTP_STATUS_GATEWAY_TIMEOUT,
	HTTP_STATUS_UNPROCESSABLE_ENTITY,
} from '../constants/http-status.constants.js';
import { LazyModuleRefService } from '../utils/lazy-getter.types.js';
import { AppLogger } from './logger.service.js';

// Backoff times in milliseconds
const BACKOFF_RETRY_MS = 1000;
const BACKOFF_TIMEOUT_MS = 2000;
const BACKOFF_DATABASE_MS = 5000;
const BACKOFF_RATE_LIMIT_MS = 10000;

export interface ErrorCategory {
	type: 'transient' | 'permanent';
	retryable: boolean;
	strategy: 'retry' | 'fail' | 'backoff';
	backoffMs?: number;
}

@Injectable()
export class ErrorCategorizerService implements LazyModuleRefService {
	private _contextualLogger: AppLogger | undefined;

	constructor(public readonly Module: ModuleRef) {}

	/**
	 * Get contextual logger for error categorizer
	 */
	public get Logger(): AppLogger {
		if (!this._contextualLogger) {
			const baseLogger = this.Module.get(AppLogger);
			this._contextualLogger = baseLogger.createContextualLogger(ErrorCategorizerService.name);
		}
		return this._contextualLogger;
	}

	/**
	 * Check if an error is retryable
	 */
	public isRetryable(error: any): boolean {
		const category = this.categorizeError(error);
		return category.retryable;
	}

	/**
	 * Categorize an error and determine recovery strategy
	 */
	public categorizeError(error: any): ErrorCategory {
		const errorMessage = error?.message ?? String(error);
		const errorCode = error?.code ?? error?.status;

		// Node.js network error codes are always transient (checked first before pattern matching)
		const NODE_TRANSIENT_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']);
		if (NODE_TRANSIENT_CODES.has((error as { code?: string }).code ?? '')) {
			this.Logger.debug('Categorized as transient network error (Node.js error code)', {
				error: errorMessage,
				code: errorCode,
				category: 'transient',
				strategy: 'backoff',
			});
			return {
				type: 'transient',
				retryable: true,
				strategy: 'backoff',
				backoffMs: BACKOFF_RETRY_MS,
			};
		}

		// Database connection errors (transient) - check before timeout since "timeout" may be in message
		if (this.isDatabaseError(error)) {
			this.Logger.debug('Categorized as transient database error', {
				error: errorMessage,
				category: 'transient',
				strategy: 'backoff',
			});
			return {
				type: 'transient',
				retryable: true,
				strategy: 'backoff',
				backoffMs: BACKOFF_DATABASE_MS,
			};
		}

		// Timeout errors (transient) - check before generic network errors since ETIMEDOUT is in networkCodes
		if (this.isTimeoutError(error)) {
			this.Logger.debug('Categorized as transient timeout error', {
				error: errorMessage,
				category: 'transient',
				strategy: 'backoff',
			});
			return {
				type: 'transient',
				retryable: true,
				strategy: 'backoff',
				backoffMs: BACKOFF_TIMEOUT_MS,
			};
		}

		// Network errors (transient)
		if (this.isNetworkError(error)) {
			this.Logger.debug('Categorized as transient network error', {
				error: errorMessage,
				category: 'transient',
				strategy: 'retry',
			});
			return {
				type: 'transient',
				retryable: true,
				strategy: 'retry',
				backoffMs: BACKOFF_RETRY_MS,
			};
		}

		// Server errors (transient) - 502, 503, 504
		if (this.isServerError(error)) {
			this.Logger.debug('Categorized as transient server error', {
				error: errorMessage,
				status: errorCode,
				category: 'transient',
				strategy: 'backoff',
			});
			return {
				type: 'transient',
				retryable: true,
				strategy: 'backoff',
				backoffMs: BACKOFF_TIMEOUT_MS,
			};
		}

		// Rate limit errors (transient) - 429
		if (this.isRateLimitError(error)) {
			this.Logger.debug('Categorized as transient rate limit error', {
				error: errorMessage,
				category: 'transient',
				strategy: 'backoff',
			});
			return {
				type: 'transient',
				retryable: true,
				strategy: 'backoff',
				backoffMs: BACKOFF_RATE_LIMIT_MS,
			};
		}

		// Bad request errors (permanent) - 400, 422
		if (this.isBadRequestError(error)) {
			this.Logger.debug('Categorized as permanent bad request error', {
				error: errorMessage,
				category: 'permanent',
				strategy: 'fail',
			});
			return {
				type: 'permanent',
				retryable: false,
				strategy: 'fail',
			};
		}

		// Validation errors (permanent)
		if (this.isValidationError(error)) {
			this.Logger.debug('Categorized as permanent validation error', {
				error: errorMessage,
				category: 'permanent',
				strategy: 'fail',
			});
			return {
				type: 'permanent',
				retryable: false,
				strategy: 'fail',
			};
		}

		// Authentication errors (permanent) - 401
		if (this.isAuthError(error)) {
			this.Logger.debug('Categorized as permanent authentication error', {
				error: errorMessage,
				category: 'permanent',
				strategy: 'fail',
			});
			return {
				type: 'permanent',
				retryable: false,
				strategy: 'fail',
			};
		}

		// Authorization errors (permanent) - 403
		if (this.isAuthzError(error)) {
			this.Logger.debug('Categorized as permanent authorization error', {
				error: errorMessage,
				category: 'permanent',
				strategy: 'fail',
			});
			return {
				type: 'permanent',
				retryable: false,
				strategy: 'fail',
			};
		}

		// Not found errors (permanent) - 404
		if (this.isNotFoundError(error)) {
			this.Logger.debug('Categorized as permanent not found error', {
				error: errorMessage,
				category: 'permanent',
				strategy: 'fail',
			});
			return {
				type: 'permanent',
				retryable: false,
				strategy: 'fail',
			};
		}

		// Default to permanent error
		this.Logger.warn('Uncategorized error treated as permanent', {
			error: errorMessage,
			code: errorCode,
			category: 'permanent',
			strategy: 'fail',
		});

		return {
			type: 'permanent',
			retryable: false,
			strategy: 'fail',
		};
	}

	/**
	 * Log error recovery attempt
	 */
	public logRecoveryAttempt(error: any, attempt: number, maxAttempts: number): void {
		const category = this.categorizeError(error);
		this.Logger.info('Error recovery attempt', {
			attempt,
			maxAttempts,
			errorType: category.type,
			strategy: category.strategy,
			backoffMs: category.backoffMs,
			error: error?.message ?? String(error),
		});
	}

	/**
	 * Log successful recovery
	 */
	public logRecoverySuccess(error: any, attempts: number): void {
		this.Logger.info('Error recovery successful', {
			attempts,
			error: error?.message ?? String(error),
		});
	}

	/**
	 * Log failed recovery
	 */
	public logRecoveryFailed(error: any, attempts: number): void {
		const category = this.categorizeError(error);
		this.Logger.error('Error recovery failed', undefined, undefined, {
			attempts,
			errorType: category.type,
			retryable: category.retryable,
			error: error?.message ?? String(error),
		});
	}

	private isNetworkError(error: any): boolean {
		const networkCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EPIPE'];
		return networkCodes.includes(error?.code) || /\bnetwork\b/i.test(error?.message) || /\bconnection\b/i.test(error?.message);
	}

	private isTimeoutError(error: any): boolean {
		return error?.code === 'ETIMEDOUT' ||
			/\btimeout\b|\btimed out\b/i.test(error?.message);
	}

	private isDatabaseError(error: any): boolean {
		return /\bconnection\b/i.test(error?.message) &&
			(
				/\bdatabase\b/i.test(error?.message) ||
				/\bmongodb\b/i.test(error?.message) ||
				/\bredis\b/i.test(error?.message)
			);
	}

	private isBadRequestError(error: any): boolean {
		return error?.status === HTTP_STATUS_BAD_REQUEST ||
			error?.status === HTTP_STATUS_UNPROCESSABLE_ENTITY;
	}

	private isValidationError(error: any): boolean {
		return /\bvalidation\b/i.test(error?.message) ||
			error?.name === 'ValidationError';
	}

	private isAuthError(error: any): boolean {
		return error?.status === HTTP_STATUS_UNAUTHORIZED || /\bunauthorized\b/i.test(error?.message) ||
			/\bauthentication\b/i.test(error?.message);
	}

	private isAuthzError(error: any): boolean {
		return error?.status === HTTP_STATUS_FORBIDDEN || /\bforbidden\b/i.test(error?.message) ||
			/\bauthorization\b/i.test(error?.message);
	}

	private isNotFoundError(error: any): boolean {
		return error?.status === HTTP_STATUS_NOT_FOUND || /\bnot found\b/i.test(error?.message);
	}

	private isServerError(error: any): boolean {
		return error?.status === HTTP_STATUS_BAD_GATEWAY ||
			error?.status === HTTP_STATUS_SERVICE_UNAVAILABLE ||
			error?.status === HTTP_STATUS_GATEWAY_TIMEOUT;
	}

	private isRateLimitError(error: any): boolean {
		return error?.status === HTTP_STATUS_TOO_MANY_REQUESTS || /\brate limit\b/i.test(error?.message) ||
			/\btoo many requests\b/i.test(error?.message);
	}
}
