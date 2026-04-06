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
			const BaseLogger = this.Module.get(AppLogger);
			this._ContextualLogger = BaseLogger.CreateContextualLogger(ErrorCategorizerService.name);
		}
		return this._ContextualLogger;
	}

	/**
	 * Check if an error is retryable
	 */
	public IsRetryable(error: unknown): boolean {
		const Category = this.CategorizeError(error);
		return Category.retryable;
	}

	/**
	 * Categorize an error and determine recovery strategy
	 */
	public CategorizeError(error: unknown): IErrorCategory {
		const Err = error as Record<string, any>;
		const ErrorMessage = Err?.message ?? String(error);
		const ErrorCode = Err?.code ?? Err?.status;

		// Node.js network error codes are always transient (checked first before pattern matching)
		const NODE_TRANSIENT_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']);
		if (error && NODE_TRANSIENT_CODES.has((error as { code?: string }).code ?? '')) {
			this.Logger.Debug('Categorized as transient network error (Node.js error code)', {
				error: ErrorMessage,
				code: ErrorCode,
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
		if (this.IsDatabaseError(error)) {
			this.Logger.Debug('Categorized as transient database error', {
				error: ErrorMessage,
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
		if (this.IsTimeoutError(error)) {
			this.Logger.Debug('Categorized as transient timeout error', {
				error: ErrorMessage,
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
		if (this.IsNetworkError(error)) {
			this.Logger.Debug('Categorized as transient network error', {
				error: ErrorMessage,
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
		if (this.IsServerError(error)) {
			this.Logger.Debug('Categorized as transient server error', {
				error: ErrorMessage,
				status: ErrorCode,
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
		if (this.IsRateLimitError(error)) {
			this.Logger.Debug('Categorized as transient rate limit error', {
				error: ErrorMessage,
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
		if (this.IsBadRequestError(error)) {
			this.Logger.Debug('Categorized as permanent bad request error', {
				error: ErrorMessage,
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
		if (this.IsValidationError(error)) {
			this.Logger.Debug('Categorized as permanent validation error', {
				error: ErrorMessage,
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
		if (this.IsAuthError(error)) {
			this.Logger.Debug('Categorized as permanent authentication error', {
				error: ErrorMessage,
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
		if (this.IsAuthzError(error)) {
			this.Logger.Debug('Categorized as permanent authorization error', {
				error: ErrorMessage,
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
		if (this.IsNotFoundError(error)) {
			this.Logger.Debug('Categorized as permanent not found error', {
				error: ErrorMessage,
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
			error: ErrorMessage,
			code: ErrorCode,
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
	public LogRecoveryAttempt(error: unknown, attempt: number, maxAttempts: number): void {
		const Category = this.CategorizeError(error);
		this.Logger.info('Error recovery attempt', {
			attempt,
			maxAttempts,
			errorType: Category.type,
			strategy: Category.strategy,
			backoffMs: Category.backoffMs,
			error: (error as Record<string, any>)?.message ?? String(error),
		});
	}

	/**
	 * Log successful recovery
	 */
	public LogRecoverySuccess(error: unknown, attempts: number): void {
		this.Logger.info('Error recovery successful', {
			attempts,
			error: (error as Record<string, any>)?.message ?? String(error),
		});
	}

	/**
	 * Log failed recovery
	 */
	public LogRecoveryFailed(error: unknown, attempts: number): void {
		const Err = error as Record<string, any>;
		const Category = this.CategorizeError(error);
		this.Logger.error('Error recovery failed', undefined, undefined, {
			attempts,
			errorType: Category.type,
			retryable: Category.retryable,
			error: Err?.message ?? String(error),
		});
	}

	private IsNetworkError(error: unknown): boolean {
		const Err = error as Record<string, any>;
		const NetworkCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EPIPE'];
		return NetworkCodes.includes(Err?.code) || /\bnetwork\b/i.test(Err?.message) || /\bconnection\b/i.test(Err?.message);
	}

	private IsTimeoutError(error: unknown): boolean {
		const Err = error as Record<string, any>;
		return Err?.code === 'ETIMEDOUT' ||
			/\btimeout\b|\btimed out\b/i.test(Err?.message);
	}

	private IsDatabaseError(error: unknown): boolean {
		const Err = error as Record<string, any>;
		return /\bconnection\b/i.test(Err?.message) &&
			(
				/\bdatabase\b/i.test(Err?.message) ||
				/\bmongodb\b/i.test(Err?.message) ||
				/\bredis\b/i.test(Err?.message)
			);
	}

	private IsBadRequestError(error: unknown): boolean {
		const Err = error as Record<string, any>;
		return Err?.status === HTTP_STATUS_BAD_REQUEST ||
			Err?.status === HTTP_STATUS_UNPROCESSABLE_ENTITY;
	}

	private IsValidationError(error: unknown): boolean {
		const Err = error as Record<string, any>;
		return /\bvalidation\b/i.test(Err?.message) ||
			Err?.name === 'IValidationError';
	}

	private IsAuthError(error: unknown): boolean {
		const Err = error as Record<string, any>;
		return Err?.status === HTTP_STATUS_UNAUTHORIZED || /\bunauthorized\b/i.test(Err?.message) ||
			/\bauthentication\b/i.test(Err?.message);
	}

	private IsAuthzError(error: unknown): boolean {
		const Err = error as Record<string, any>;
		return Err?.status === HTTP_STATUS_FORBIDDEN || /\bforbidden\b/i.test(Err?.message) ||
			/\bauthorization\b/i.test(Err?.message);
	}

	private IsNotFoundError(error: unknown): boolean {
		const Err = error as Record<string, any>;
		return Err?.status === HTTP_STATUS_NOT_FOUND || /\bnot found\b/i.test(Err?.message);
	}

	private IsServerError(error: unknown): boolean {
		const Err = error as Record<string, any>;
		return Err?.status === HTTP_STATUS_BAD_GATEWAY ||
			Err?.status === HTTP_STATUS_SERVICE_UNAVAILABLE ||
			Err?.status === HTTP_STATUS_GATEWAY_TIMEOUT;
	}

	private IsRateLimitError(error: unknown): boolean {
		const Err = error as Record<string, any>;
		return Err?.status === HTTP_STATUS_TOO_MANY_REQUESTS || /\brate limit\b/i.test(Err?.message) ||
			/\btoo many requests\b/i.test(Err?.message);
	}
}
