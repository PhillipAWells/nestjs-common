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
 * Configuration validation utilities
 */
export class ProfilingConfigValidator {
	/**
	 * Validate Pyroscope configuration
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
 * Tag formatting utilities
 */
export class TagFormatter {
	/**
	 * Format tags for Pyroscope
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
	 * Merge tags with priority to override
	 */
	public static merge(baseTags: Record<string, string>, overrideTags: Record<string, string>): Record<string, string> {
		return { ...baseTags, ...overrideTags };
	}

	/**
	 * Filter out invalid tag values
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
 * Metric aggregation utilities
 */
export class MetricAggregator {
	/**
	 * Calculate average duration from metrics
	 */
	public static averageDuration(metrics: Array<{ duration: number }>): number {
		if (metrics.length === 0) return 0;

		const total = metrics.reduce((sum, metric) => sum + metric.duration, 0);
		return total / metrics.length;
	}

	/**
	 * Calculate percentile from duration metrics
	 */
	public static percentile(metrics: Array<{ duration: number }>, p: number): number {
		if (metrics.length === 0) return 0;

		const sorted = metrics.map(m => m.duration).sort((a, b) => a - b);

		const index = Math.ceil((p / PROFILING_PERCENTILE_DIVISOR) * sorted.length) - 1;
		return sorted[Math.min(sorted.length - 1, Math.max(0, index))] ?? 0;
	}

	/**
	 * Group metrics by tags
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
 * Error handling utilities
 */
export class ProfilingErrorHandler {
	/**
	 * Check if error is recoverable
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
	 * Create user-friendly error message
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
	 * Determine retry delay based on error type
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
 * Legacy utility functions for backward compatibility
 */

/**
 * Generate a unique profile ID
 */
export function generateProfileId(prefix: string = 'profile'): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(PROFILING_ID_RADIX).substring(2, PROFILING_ID_SUBSTR_END)}`;
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
	if (ms < PROFILING_DURATION_SECONDS_THRESHOLD) {
		return `${ms.toFixed(2)}ms`;
	}

	return `${(ms / PROFILING_DURATION_SECONDS_THRESHOLD).toFixed(2)}s`;
}

/**
 * Check if profiling is enabled based on environment
 */
export function isProfilingEnabled(): boolean {
	const enabled = process.env['PYROSCOPE_ENABLED'];
	return enabled === 'true' || enabled === '1';
}
