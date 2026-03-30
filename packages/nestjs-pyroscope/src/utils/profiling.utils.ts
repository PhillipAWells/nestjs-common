import { IPyroscopeConfig, TProfileType } from '../interfaces/profiling.interface.js';
import {
	PROFILING_TAG_MAX_LENGTH,
	PROFILING_RETRY_BASE_DELAY_MS,
	PROFILING_RETRY_MAX_DELAY_MS,
	PROFILING_RETRY_JITTER_MS,
	PROFILING_PERCENTILE_DIVISOR,
	PROFILING_ID_RADIX,
	PROFILING_ID_SUBSTR_END,
	PROFILING_DURATION_SECONDS_THRESHOLD,
} from '../constants/profiling.constants.js';

/**
 * Configuration validation utilities.
 *
 * Validates IPyroscopeConfig objects against Pyroscope requirements.
 */
export class ProfilingConfigValidator {
	/**
	 * Validate Pyroscope configuration.
	 *
	 * Performs comprehensive validation of profiling configuration including:
	 * - Required fields (serverAddress, applicationName)
	 * - Field format validation (URLs, sample rates, profile types)
	 * - Credential validation (paired basicAuth fields)
	 *
	 * @param config Configuration to validate
	 * @returns Object with isValid flag and array of validation errors
	 *
	 * @example
	 * ```typescript
	 * const result = ProfilingConfigValidator.validate(config);
	 * if (!result.isValid) {
	 *   console.error('Config errors:', result.errors);
	 * }
	 * ```
	 */
	public static validate(config: IPyroscopeConfig): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!config.serverAddress) {
			errors.push('serverAddress is required');
		} else if (!config.serverAddress.startsWith('http')) {
			errors.push('serverAddress must start with http:// or https://');
		}

		if (!config.applicationName) {
			errors.push('applicationName is required');
		}

		if (config.sampleRate !== undefined && (config.sampleRate < 0 || config.sampleRate > 1)) {
			errors.push('sampleRate must be between 0 and 1');
		}

		if (config.profileTypes) {
			const validTypes: TProfileType[] = ['cpu', 'memory', 'goroutine', 'mutex', 'block'];
			const invalidTypes = config.profileTypes.filter(type => !validTypes.includes(type));
			if (invalidTypes.length > 0) {
				errors.push(`Invalid profile types: ${invalidTypes.join(', ')}`);
			}
		}

		if (config.basicAuthUser && !config.basicAuthPassword) {
			errors.push('basicAuthPassword is required when basicAuthUser is provided');
		}

		if (config.basicAuthPassword && !config.basicAuthUser) {
			errors.push('basicAuthUser is required when basicAuthPassword is provided');
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}
}

/**
 * ITag formatting utilities.
 *
 * Handles tag formatting, merging, and sanitization for profiling operations.
 */
export class TagFormatter {
	/**
	 * Format tags for Pyroscope.
	 *
	 * Converts tag keys from camelCase to snake_case for consistency with Pyroscope conventions.
	 *
	 * @param tags Input tags with camelCase keys
	 * @returns Formatted tags with snake_case keys
	 *
	 * @example
	 * ```typescript
	 * TagFormatter.format({ userId: '123', userName: 'john' });
	 * // Returns { user_id: '123', user_name: 'john' }
	 * ```
	 */
	public static format(tags: Record<string, string>): Record<string, string> {
		const formatted: Record<string, string> = {};

		for (const [key, value] of Object.entries(tags)) {
			// Convert camelCase to snake_case for consistency
			const formattedKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
			formatted[formattedKey] = String(value);
		}

		return formatted;
	}

	/**
	 * Merge tags with priority to override.
	 *
	 * Merges base tags with override tags, with override tags taking precedence.
	 *
	 * @param baseTags Base tags
	 * @param overrideTags Tags to merge in, taking priority
	 * @returns Merged tag object
	 *
	 * @example
	 * ```typescript
	 * TagFormatter.merge({ env: 'prod' }, { region: 'us-east-1' });
	 * // Returns { env: 'prod', region: 'us-east-1' }
	 * ```
	 */
	public static merge(baseTags: Record<string, string>, overrideTags: Record<string, string>): Record<string, string> {
		return { ...baseTags, ...overrideTags };
	}

	/**
	 * Filter out invalid tag values and truncate to max length.
	 *
	 * Removes null, undefined, and empty string values. Truncates remaining values
	 * to the specified max length (default: PROFILING_TAG_MAX_LENGTH).
	 *
	 * @param tags Input tags
	 * @param maxLength Maximum tag value length (characters). Defaults to PROFILING_TAG_MAX_LENGTH
	 * @returns Sanitized tags with invalid values removed and lengths enforced
	 *
	 * @example
	 * ```typescript
	 * TagFormatter.sanitize({ userId: '123', empty: '', token: 'verylong...' });
	 * // Removes 'empty', truncates 'token' if needed
	 * ```
	 */
	public static sanitize(tags: Record<string, string>, maxLength?: number): Record<string, string> {
		const sanitized: Record<string, string> = {};
		const tagMaxLength = maxLength ?? PROFILING_TAG_MAX_LENGTH;

		for (const [key, value] of Object.entries(tags)) {
			if (value !== null && value !== undefined && value !== '') {
				sanitized[key] = String(value).substring(0, tagMaxLength); // Limit tag value length
			}
		}

		return sanitized;
	}
}

/**
 * Metric aggregation utilities.
 *
 * Provides statistical calculations and grouping operations on profiling metrics.
 */
export class MetricAggregator {
	/**
	 * Calculate average duration from metrics.
	 *
	 * @param metrics Array of metrics with duration field
	 * @returns Average duration in milliseconds
	 *
	 * @example
	 * ```typescript
	 * const avgMs = MetricAggregator.averageDuration([
	 *   { duration: 100 },
	 *   { duration: 200 },
	 * ]);
	 * // Returns 150
	 * ```
	 */
	public static averageDuration(metrics: Array<{ duration: number }>): number {
		if (metrics.length === 0) return 0;

		const total = metrics.reduce((sum, metric) => sum + metric.duration, 0);
		return total / metrics.length;
	}

	/**
	 * Calculate percentile from duration metrics.
	 *
	 * Calculates the specified percentile (e.g., p95, p99) from duration metrics.
	 *
	 * @param metrics Array of metrics with duration field
	 * @param p Percentile value (0-100, e.g., 95 for p95)
	 * @returns Duration value at the specified percentile in milliseconds
	 *
	 * @example
	 * ```typescript
	 * const p95 = MetricAggregator.percentile(metrics, 95);
	 * // 95% of requests completed in <= p95 milliseconds
	 * ```
	 */
	public static percentile(metrics: Array<{ duration: number }>, p: number): number {
		if (metrics.length === 0) return 0;

		const sorted = metrics.map(m => m.duration).sort((a, b) => a - b);

		const index = Math.ceil((p / PROFILING_PERCENTILE_DIVISOR) * sorted.length) - 1;
		return sorted[Math.min(sorted.length - 1, Math.max(0, index))] ?? 0;
	}

	/**
	 * Group metrics by tags.
	 *
	 * Groups metrics by values of specified tag keys, useful for analyzing
	 * performance by dimension (e.g., by endpoint, operation type, etc).
	 *
	 * @param metrics Array of metrics with optional tags
	 * @param tagKeys ITag keys to group by
	 * @returns Object with group keys and arrays of metrics in each group
	 *
	 * @example
	 * ```typescript
	 * const grouped = MetricAggregator.groupByTags(metrics, ['operation']);
	 * // grouped['select'] contains all metrics with operation: 'select'
	 * ```
	 */
	public static groupByTags<T extends { tags?: Record<string, string> }>(
		metrics: T[],
		tagKeys: string[],
	): Record<string, T[]> {
		const groups: Record<string, T[]> = {};

		for (const metric of metrics) {
			const key = tagKeys
				.map(key => metric.tags?.[key] ?? 'unknown')
				.join('_');

			(groups[key] ??= []);
			groups[key].push(metric);
		}

		return groups;
	}
}

/**
 * Error handling utilities.
 *
 * Provides error classification, formatting, and retry strategy determination
 * for profiling operations.
 */
export class ProfilingErrorHandler {
	/**
	 * Check if error is recoverable.
	 *
	 * Classifies errors as recoverable (e.g., network errors) or non-recoverable
	 * (e.g., auth errors). Used to determine retry eligibility.
	 *
	 * @param error Error to check
	 * @returns true if the error is recoverable and retry is appropriate
	 *
	 * @example
	 * ```typescript
	 * if (ProfilingErrorHandler.isRecoverableError(error)) {
	 *   // Schedule retry
	 * }
	 * ```
	 */
	public static isRecoverableError(error: Error): boolean {
		// Network errors are usually recoverable
		if (error.message.includes('ECONNREFUSED') ||
			error.message.includes('ENOTFOUND') ||
			error.message.includes('timeout')) {
			return true;
		}

		// Authentication errors are not recoverable
		if (error.message.includes('401') || error.message.includes('403')) {
			return false;
		}

		return false;
	}

	/**
	 * Create user-friendly error message.
	 *
	 * Formats error messages for logging/display without exposing sensitive details.
	 * Generic message returned for unknown errors.
	 *
	 * @param error Error to format
	 * @returns IUser-friendly error message
	 *
	 * @example
	 * ```typescript
	 * const message = ProfilingErrorHandler.formatError(error);
	 * logger.error(message); // Safe to expose to users
	 * ```
	 */
	public static formatError(error: Error): string {
		if (error.message.includes('ECONNREFUSED')) {
			return 'Unable to connect to Pyroscope server. Please check server address and network connectivity.';
		}

		if (error.message.includes('401')) {
			return 'Authentication failed. Please check your credentials.';
		}

		if (error.message.includes('403')) {
			return 'Access forbidden. Please check your permissions.';
		}

		// Return generic message instead of exposing error details
		return 'Profiling operation failed';
	}

	/**
	 * Determine retry delay based on error type.
	 *
	 * For recoverable errors, returns exponential backoff delay with jitter.
	 * For non-recoverable errors, returns 0 (no retry).
	 *
	 * @param error Error from operation
	 * @param attempt Retry attempt number (0-based)
	 * @param baseDelayMs Base delay for exponential backoff (defaults to PROFILING_RETRY_BASE_DELAY_MS)
	 * @param maxDelayMs Maximum delay cap (defaults to PROFILING_RETRY_MAX_DELAY_MS)
	 * @param jitterMs Random jitter to add (defaults to PROFILING_RETRY_JITTER_MS)
	 * @returns Milliseconds to delay before retry, or 0 if no retry
	 *
	 * @example
	 * ```typescript
	 * const delay = ProfilingErrorHandler.getRetryDelay(error, 2);
	 * // Returns exponential backoff: min(100 * 2^2, 10000) + random jitter
	 * ```
	 */
	public static getRetryDelay(error: Error, attempt: number, baseDelayMs?: number, maxDelayMs?: number, jitterMs?: number): number {
		if (!this.isRecoverableError(error)) {
			return 0; // No retry
		}

		// Exponential backoff with jitter
		const baseDelay = baseDelayMs ?? PROFILING_RETRY_BASE_DELAY_MS;
		const maxDelay = maxDelayMs ?? PROFILING_RETRY_MAX_DELAY_MS;
		const jitter = jitterMs ?? PROFILING_RETRY_JITTER_MS;

		const calculatedDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
		return calculatedDelay + Math.random() * jitter;
	}
}

/**
 * Standalone utility functions for backward compatibility and convenience.
 */

/**
 * Generate a unique profile ID.
 *
 * Creates a unique identifier for profiling sessions using timestamp and
 * random component.
 *
 * @param prefix Optional prefix for the profile ID (default: 'profile')
 * @returns Unique profile identifier string
 *
 * @example
 * ```typescript
 * const id = generateProfileId('op');
 * // Returns something like 'op_1710429254123_abc123def'
 * ```
 */
export function generateProfileId(prefix: string = 'profile'): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(PROFILING_ID_RADIX).substring(2, PROFILING_ID_SUBSTR_END)}`;
}

/**
 * Format duration in milliseconds to human readable string.
 *
 * Converts milliseconds to either "Xms" or "Xs" format depending on magnitude.
 * Durations >= 1000ms are shown as seconds.
 *
 * @param ms Duration in milliseconds
 * @returns Formatted duration string (e.g., '125.50ms' or '1.50s')
 *
 * @example
 * ```typescript
 * formatDuration(450);  // Returns '450.00ms'
 * formatDuration(1500); // Returns '1.50s'
 * ```
 */
export function formatDuration(ms: number): string {
	if (ms < PROFILING_DURATION_SECONDS_THRESHOLD) {
		return `${ms.toFixed(2)}ms`;
	}

	return `${(ms / PROFILING_DURATION_SECONDS_THRESHOLD).toFixed(2)}s`;
}

/**
 * Check if profiling is enabled based on environment.
 *
 * Reads the PYROSCOPE_ENABLED environment variable to determine if profiling
 * should be active. Accepts 'true' or '1' as truthy values.
 *
 * @returns true if PYROSCOPE_ENABLED environment variable is 'true' or '1'
 *
 * @example
 * ```typescript
 * // Set env: PYROSCOPE_ENABLED=true
 * if (isProfilingEnabled()) {
 *   // Enable profiling
 * }
 * ```
 */
export function isProfilingEnabled(): boolean {
	const enabled = process.env['PYROSCOPE_ENABLED'];
	return enabled === 'true' || enabled === '1';
}
