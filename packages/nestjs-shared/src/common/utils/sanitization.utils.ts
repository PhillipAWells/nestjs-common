import xss from 'xss';
import { GetErrorMessage } from './error.utils.js';
import type { IContextualLogger } from '../interfaces/logger.interface.js';

/**
 * Maximum recursion depth for sanitization operations.
 * Prevents stack overflow attacks and infinite loops on circular references.
 */
export const MAX_SANITIZE_DEPTH = 20;

/**
 * Escapes newline characters and other special characters that could be used for log injection attacks.
 * Replaces newlines with \n literal strings to prevent log forging where an attacker might inject
 * a newline to create fake log entries.
 *
 * @param str The string to escape
 * @returns String with newlines and carriage returns escaped
 *
 * @example
 * ```typescript
 * escapeNewlines('Hello\nWorld') // Returns: 'Hello\\nWorld'
 * escapeNewlines('foo\rbar') // Returns: 'foo\\rbar'
 * ```
 */
export function EscapeNewlines(str: string): string {
	if (typeof str !== 'string') {
		return String(str);
	}
	return str
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r')
		.replace(/\t/g, '\\t');
}

/**
 * Recursively sanitizes object keys to prevent MongoDB injection attacks.
 * This function only sanitizes keys (property names), not values, to prevent
 * destruction of legitimate data like email addresses or S3 paths.
 *
 * CRITICAL: This function must be applied to the complete root request object.
 * Extracting a sub-object and passing it separately bypasses sanitization for
 * parent levels. Always sanitize at the entry point (request body, params, query).
 *
 * Behavior at max depth: Throws an error to prevent bypass of sanitization.
 * A highly nested object may indicate an attack or data structure issue.
 *
 * @param value The value to sanitize (keys only)
 * @param depth Current recursion depth (internal use)
 * @param logger Optional logger instance for warnings
 * @returns Sanitized value with dangerous characters in keys replaced
 * @throws Error if maximum sanitization depth is exceeded
 *
 * @example
 * ```typescript
 * // CORRECT: Sanitize at entry point
 * app.use((req, res, next) => {
 *   req.body = sanitizeObject(req.body);
 *   next();
 * });
 *
 * // WRONG: Don't extract sub-object and sanitize separately
 * const user = sanitizeObject(req.body.user); // Misses req.body itself
 *
 * // CORRECT: Sanitize complete object first
 * const Sanitized = sanitizeObject(req.body);
 * const user = sanitized.user; // Now safe
 * ```
 */
export function SanitizeObject(value: any, depth: number = 0, logger?: IContextualLogger): any {
	if (depth >= MAX_SANITIZE_DEPTH) {
		if (logger) {
			logger.error(`Sanitization depth limit exceeded at depth ${MAX_SANITIZE_DEPTH}`);
		}
		throw new Error(`Input object exceeds maximum sanitization depth of ${MAX_SANITIZE_DEPTH}. Deeply nested objects may be malicious.`);
	}

	if (typeof value === 'object' && value !== null) {
		if (Array.isArray(value)) {
			return value.map(item => SanitizeObject(item, depth + 1, logger));
		}

		const Sanitized: any = {};
		for (const [Key, Val] of Object.entries(value)) {
			// Sanitize keys to prevent MongoDB operator injection
			// MongoDB operators start with '$', and command expressions with 'eval', 'function', etc.
			// Replace dangerous key patterns: $ at start, eval, function in keys
			let SanitizedKey = Key;

			// Prevent MongoDB operators (e.g., $where, $regex, etc.)
			if (SanitizedKey.startsWith('$')) {
				SanitizedKey = '_' + SanitizedKey.slice(1);
			}

			// Prevent arbitrary code execution patterns in key names
			const DangerousKeyPatterns = ['eval', 'function', '__proto__', 'constructor', 'prototype'];
			for (const Pattern of DangerousKeyPatterns) {
				if (SanitizedKey.toLowerCase().includes(Pattern)) {
					SanitizedKey = SanitizedKey.replace(new RegExp(Pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '_redacted_');
				}
			}

			// Recursively sanitize nested objects/arrays, but preserve string values
			Sanitized[SanitizedKey] = typeof Val === 'object' ? SanitizeObject(Val, depth + 1, logger) : Val;
		}

		return Sanitized;
	}

	return value;
}

/**
 * Recursively sanitizes object values to prevent XSS attacks.
 * Strips dangerous HTML tags, JavaScript event handlers, and protocol handlers
 * from string values while preserving legitimate data.
 *
 * Uses the xss library for server-side HTML string sanitization.
 *
 * @param value The value to sanitize (strings and nested objects)
 * @param logger Optional logger instance for warnings
 * @returns Sanitized value with XSS vectors removed
 */
export function SanitizeXss(value: unknown, logger?: IContextualLogger): unknown {
	if (typeof value === 'string') {
		// Use xss library for server-side HTML string sanitization
		// Removes common XSS patterns: script tags, event handlers, dangerous protocols
		// Static import ensures dependency is resolved at module load time and fails fast if missing

		let Sanitized = value;

		try {
			// xss is statically imported at module top to ensure TypeScript and bundlers
			// can properly resolve the dependency at build time
			Sanitized = xss(Sanitized);
		} catch (error) {
			if (logger) {
				logger.warn(`XSS sanitization (xss library) failed: ${GetErrorMessage(error)}`);
			}
		}

		// Final protocol stripping as defense-in-depth
		Sanitized = Sanitized
			.replace(/javascript:/gi, '')
			.replace(/vbscript:/gi, '');

		return Sanitized;
	}

	if (Array.isArray(value)) {
		return value.map(v => SanitizeXss(v, logger));
	}

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([k, v]) => [k, SanitizeXss(v, logger)]),
		);
	}

	return value;
}
