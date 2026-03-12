import type { Logger } from '@pawells/logger';
import { TimeoutError, RateLimitError, NetworkError } from '../errors/index.js';

const HTTP_STATUS_TIMEOUT = 408;
const HTTP_STATUS_RATE_LIMIT = 429;
const HTTP_STATUS_INTERNAL_ERROR = 500;
const HTTP_STATUS_BAD_GATEWAY = 502;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const HTTP_STATUS_GATEWAY_TIMEOUT = 504;
const JITTER_FACTOR = 0.2;

/**
 * Retry configuration options
 */
export interface RetryConfig {
	/**
	 * Maximum number of retry attempts
	 * @default 3
	 */
	maxRetries?: number;

	/**
	 * Initial delay in milliseconds before first retry
	 * @default 1000
	 */
	initialDelay?: number;

	/**
	 * Maximum delay in milliseconds between retries
	 * @default 30000
	 */
	maxDelay?: number;

	/**
	 * Backoff multiplier for exponential backoff
	 * @default 2
	 */
	backoffMultiplier?: number;

	/**
	 * HTTP status codes that should trigger a retry
	 * @default [408, 429, 500, 502, 503, 504]
	 */
	retryableStatuses?: number[];

	/**
	 * Logger instance for retry logging
	 */
	logger?: Logger;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<Omit<RetryConfig, 'logger'>> = {
	maxRetries: 3,
	initialDelay: 1000,
	maxDelay: 30000,
	backoffMultiplier: 2,
	retryableStatuses: [HTTP_STATUS_TIMEOUT, HTTP_STATUS_RATE_LIMIT, HTTP_STATUS_INTERNAL_ERROR, HTTP_STATUS_BAD_GATEWAY, HTTP_STATUS_SERVICE_UNAVAILABLE, HTTP_STATUS_GATEWAY_TIMEOUT],
};

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
	if (error instanceof TimeoutError || error instanceof RateLimitError || error instanceof NetworkError) {
		return true;
	}

	if (error && typeof error === 'object' && 'statusCode' in error) {
		const { statusCode } = (error as { statusCode?: number });
		return statusCode !== undefined && retryableStatuses.includes(statusCode);
	}

	return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
	attempt: number,
	initialDelay: number,
	maxDelay: number,
	backoffMultiplier: number,
): number {
	const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt);
	const delayWithCap = Math.min(exponentialDelay, maxDelay);

	// Add jitter (±20%)
	const jitter = delayWithCap * JITTER_FACTOR * (Math.random() * 2 - 1);
	return Math.floor(delayWithCap + jitter);
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	config: RetryConfig = {},
): Promise<T> {
	const {
		maxRetries,
		initialDelay,
		maxDelay,
		backoffMultiplier,
		retryableStatuses,
	} = { ...DEFAULT_RETRY_CONFIG, ...config };

	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Don't retry on last attempt
			if (attempt === maxRetries) {
				break;
			}

			// Check if error is retryable
			if (!isRetryableError(error, retryableStatuses)) {
				throw error;
			}

			// Calculate delay and wait
			const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);

			if (config.logger) {
				config.logger.warn(
					`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
					{ error: lastError.message },
				);
			}

			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}

	throw lastError ?? new Error('Max retries exceeded');
}
