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
export interface IRetryConfig {
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
const DEFAULT_RETRY_CONFIG: Required<Omit<IRetryConfig, 'logger'>> = {
	maxRetries: 3,
	initialDelay: 1000,
	maxDelay: 30000,
	backoffMultiplier: 2,
	retryableStatuses: [HTTP_STATUS_TIMEOUT, HTTP_STATUS_RATE_LIMIT, HTTP_STATUS_INTERNAL_ERROR, HTTP_STATUS_BAD_GATEWAY, HTTP_STATUS_SERVICE_UNAVAILABLE, HTTP_STATUS_GATEWAY_TIMEOUT],
};

/**
 * Determine if an error is retryable
 */
function IsRetryableError(error: unknown, retryableStatuses: number[]): boolean {
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
function CalculateDelay(
	attempt: number,
	initialDelay: number,
	maxDelay: number,
	backoffMultiplier: number,
): number {
	const ExponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt);
	const DelayWithCap = Math.min(ExponentialDelay, maxDelay);

	// Add jitter (±20%)
	const Jitter = DelayWithCap * JITTER_FACTOR * (Math.random() * 2 - 1);
	return Math.floor(DelayWithCap + Jitter);
}

/**
 * Execute a function with retry logic
 */
export async function WithRetry<T>(
	fn: () => Promise<T>,
	config: IRetryConfig = {},
): Promise<T> {
	const {
		maxRetries,
		initialDelay,
		maxDelay,
		backoffMultiplier,
		retryableStatuses,
	} = { ...DEFAULT_RETRY_CONFIG, ...config };

	let LastError: Error | undefined;

	for (let Attempt = 0; Attempt <= maxRetries; Attempt++) {
		try {
			return await fn();
		} catch (error) {
			LastError = error instanceof Error ? error : new Error(String(error));

			// Don't retry on last attempt
			if (Attempt === maxRetries) {
				break;
			}

			// Check if error is retryable
			if (!IsRetryableError(error, retryableStatuses)) {
				throw error;
			}

			// Calculate delay and wait
			const Delay = CalculateDelay(Attempt, initialDelay, maxDelay, backoffMultiplier);

			if (config.logger) {
				config.logger.warn(
					`Retrying after ${Delay}ms (attempt ${Attempt + 1}/${maxRetries})`,
					{ error: LastError.message },
				);
			}

			await new Promise(resolve => setTimeout(resolve, Delay));
		}
	}

	throw LastError ?? new Error('Max retries exceeded');
}
