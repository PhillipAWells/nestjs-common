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
import { ILazyModuleRefService } from '../utils/lazy-getter.types.js';
import { AppLogger } from './logger.service.js';

// Backoff times in milliseconds
const BACKOFF_RETRY_MS = 1000;
const BACKOFF_TIMEOUT_MS = 2000;
const BACKOFF_DATABASE_MS = 5000;
const BACKOFF_RATE_LIMIT_MS = 10000;

/**
 * Error category classification for recovery strategy determination.
 */
export interface IErrorCategory {
	type: 'transient' | 'permanent';
	retryable: boolean;
	strategy: 'retry' | 'fail' | 'backoff';
	backoffMs?: number;
}

/**
 * Error Categorizer Service.
 * Classifies errors as transient or permanent and recommends recovery strategies.
 *
 * Categories:
 * - **Transient** (retryable): Network errors, timeouts, database connection errors, rate limits, server errors (5xx)
 * - **Permanent** (not retryable): Validation errors, bad requests (4xx), authentication/authorization, not found
 *
 * Recovery strategies:
 * - **retry**: Immediate retry (for network errors)
 * - **backoff**: Exponential backoff retry (for timeouts, database, rate limits)
 * - **fail**: Fast failure without retry (for validation, authentication, not found)
 *
 * @remarks
 * - Node.js error codes (ECONNRESET, ECONNREFUSED, ETIMEDOUT, ENOTFOUND, EAI_AGAIN) are always transient
 * - Database connection errors are always transient with long backoff (5s)
 * - Timeout errors get medium backoff (2s)
 * - Rate limit errors get maximum backoff (10s)
 * - Unknown errors default to permanent/fail strategy
 *
 * @example
 * ```typescript
 * const category = errorCategorizer.categorizeError(error);
 * if (category.retryable) {
 *   // Retry with backoff: category.backoffMs
 * } else {
 *   // Fail fast
 * }
 * ```
 */
@Injectable()
export class ErrorCategorizerService implements ILazyModuleRefService {
	private _ContextualLogger: AppLogger | undefined;

	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	/**
	 * Get contextual logger for error categorizer
	 */
	public get Logger(): AppLogger {
		if (!this._ContextualLogger) {
			const baseLogger = this.Module.get(AppLogger);
			this._ContextualLogger = baseLogger.createContextualLogger(ErrorCategorizerService.name);
		}
		return this._ContextualLogger;
	}

	/**
	 * Check if an error is retryable
	 */
	public isRetryable(error: unknown): boolean {
		const category = this.categorizeError(error);
		return category.retryable;
	}

	/**
	 * Categorize an error and determine recovery strategy
	 */
	public categorizeError(error: unknown): IErrorCategory {
		const err = error as Record<string, any>;
		const errorMessage = err?.message ?? String(error);
		const errorCode = err?.code ?? err?.status;

		// Node.js network error codes are always transient (checked first before pattern matching)
		const NODE_TRANSIENT_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']);
		if (error && NODE_TRANSIENT_CODES.has((error as { code?: string }).code ?? '')) {
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
	public logRecoveryAttempt(error: unknown, attempt: number, maxAttempts: number): void {
		const category = this.categorizeError(error);
		this.Logger.info('Error recovery attempt', {
			attempt,
			maxAttempts,
			errorType: category.type,
			strategy: category.strategy,
			backoffMs: category.backoffMs,
			error: (error as Record<string, any>)?.message ?? String(error),
		});
	}

	/**
	 * Log successful recovery
	 */
	public logRecoverySuccess(error: unknown, attempts: number): void {
		this.Logger.info('Error recovery successful', {
			attempts,
			error: (error as Record<string, any>)?.message ?? String(error),
		});
	}

	/**
	 * Log failed recovery
	 */
	public logRecoveryFailed(error: unknown, attempts: number): void {
		const err = error as Record<string, any>;
		const category = this.categorizeError(error);
		this.Logger.error('Error recovery failed', undefined, undefined, {
			attempts,
			errorType: category.type,
			retryable: category.retryable,
			error: err?.message ?? String(error),
		});
	}

	private isNetworkError(error: unknown): boolean {
		const err = error as Record<string, any>;
		const networkCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EPIPE'];
		return networkCodes.includes(err?.code) || /\bnetwork\b/i.test(err?.message) || /\bconnection\b/i.test(err?.message);
	}

	private isTimeoutError(error: unknown): boolean {
		const err = error as Record<string, any>;
		return err?.code === 'ETIMEDOUT' ||
			/\btimeout\b|\btimed out\b/i.test(err?.message);
	}

	private isDatabaseError(error: unknown): boolean {
		const err = error as Record<string, any>;
		return /\bconnection\b/i.test(err?.message) &&
			(
				/\bdatabase\b/i.test(err?.message) ||
				/\bmongodb\b/i.test(err?.message) ||
				/\bredis\b/i.test(err?.message)
			);
	}

	private isBadRequestError(error: unknown): boolean {
		const err = error as Record<string, any>;
		return err?.status === HTTP_STATUS_BAD_REQUEST ||
			err?.status === HTTP_STATUS_UNPROCESSABLE_ENTITY;
	}

	private isValidationError(error: unknown): boolean {
		const err = error as Record<string, any>;
		return /\bvalidation\b/i.test(err?.message) ||
			err?.name === 'IValidationError';
	}

	private isAuthError(error: unknown): boolean {
		const err = error as Record<string, any>;
		return err?.status === HTTP_STATUS_UNAUTHORIZED || /\bunauthorized\b/i.test(err?.message) ||
			/\bauthentication\b/i.test(err?.message);
	}

	private isAuthzError(error: unknown): boolean {
		const err = error as Record<string, any>;
		return err?.status === HTTP_STATUS_FORBIDDEN || /\bforbidden\b/i.test(err?.message) ||
			/\bauthorization\b/i.test(err?.message);
	}

	private isNotFoundError(error: unknown): boolean {
		const err = error as Record<string, any>;
		return err?.status === HTTP_STATUS_NOT_FOUND || /\bnot found\b/i.test(err?.message);
	}

	private isServerError(error: unknown): boolean {
		const err = error as Record<string, any>;
		return err?.status === HTTP_STATUS_BAD_GATEWAY ||
			err?.status === HTTP_STATUS_SERVICE_UNAVAILABLE ||
			err?.status === HTTP_STATUS_GATEWAY_TIMEOUT;
	}

	private isRateLimitError(error: unknown): boolean {
		const err = error as Record<string, any>;
		return err?.status === HTTP_STATUS_TOO_MANY_REQUESTS || /\brate limit\b/i.test(err?.message) ||
			/\btoo many requests\b/i.test(err?.message);
	}
}
