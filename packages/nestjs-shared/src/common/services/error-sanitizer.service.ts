import { Injectable } from '@nestjs/common';
import { HTTP_STATUS_INTERNAL_SERVER_ERROR } from '../constants/http-status.constants.js';
import { ModuleRef } from '@nestjs/core';
import { ILazyModuleRefService } from '../utils/lazy-getter.types.js';

/**
 * Options for configuring the ErrorSanitizerService.
 */
export interface IErrorSanitizerOptions {
	/**
	 * Additional regex patterns to apply for message sanitization.
	 */
	additionalPatterns?: RegExp[];

	/**
	 * Additional field names to treat as sensitive and redact.
	 */
	additionalSensitiveKeys?: string[];
}

/**
 * Injection token for ErrorSanitizerService configuration.
 */
export const ERROR_SANITIZER_OPTIONS = 'ERROR_SANITIZER_OPTIONS';

/**
 * Error Sanitizer Service.
 * Sanitizes error responses and error context to prevent information disclosure in production.
 * Removes sensitive information like stack traces, file paths, database URIs, API keys, email addresses,
 * IP addresses, and custom sensitive fields.
 *
 * Implements defense-in-depth by sanitizing:
 * - Error messages (via regex patterns)
 * - Nested context objects (via field name matching)
 * - Stack traces (removed in production)
 *
 * Sensitive patterns redacted:
 * - File paths (e.g., `/home/user/app.ts` -> `[FILE]`)
 * - Database URIs (e.g., `mongodb://...` -> `[REDACTED]`)
 * - API keys and tokens (e.g., `Bearer sk_live_...` -> `Bearer [REDACTED]`)
 * - Email addresses (e.g., `user@example.com` -> `[EMAIL]`)
 * - IP addresses (IPv4 and IPv6) -> `[IP]`
 * - Sensitive field values (passwords, tokens, API keys, etc.) -> `***REDACTED***`
 *
 * @remarks
 * - Maximum message length: 5000 chars (prevents ReDoS attacks on regex patterns)
 * - Maximum context depth: 5 levels (prevents deeply nested structure processing)
 * - Circular reference detection prevents infinite loops
 * - Case-insensitive field name matching for sensitivity
 *
 * @example
 * ```typescript
 * const error = {
 *   message: 'Error at /home/user/app.ts, Bearer sk_live_abc123',
 *   context: { password: 'secret123', userId: '456' }
 * };
 * const Sanitized = errorSanitizer.sanitizeErrorResponse(error, false);
 * // message: 'Error at [FILE], Bearer [REDACTED]'
 * // context: { password: '***REDACTED***', userId: '456' }
 * ```
 */

@Injectable()
export class ErrorSanitizerService implements ILazyModuleRefService {
	/**
	 * Maximum length for error messages before truncation.
	 * Prevents ReDoS (Regular Expression Denial of Service) attacks by limiting
	 * the input size to regex patterns used in message sanitization.
	 */
	// eslint-disable-next-line no-magic-numbers
	private static readonly MAX_MESSAGE_LENGTH = 5000;

	/**
	 * Maximum nesting depth for context object serialization.
	 * Prevents deeply nested structures from causing performance issues.
	 */
	// eslint-disable-next-line no-magic-numbers
	private static readonly MAX_CONTEXT_DEPTH = 5;

	/**
	 * Precompiled regex pattern for matching file paths with code extensions
	 * Used to redact file paths from error messages
	 */
	private static readonly FILE_PATH_REGEX = /\/[a-zA-Z0-9_./:-]{0,200}\.(?:ts|js|json|py|go|rb|java|cs|php)/g;

	/**
	 * Precompiled regex pattern for matching IPv4 addresses
	 */
	private static readonly IPV4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

	/**
	 * Precompiled regex pattern for matching IPv6 addresses
	 * Covers various IPv6 formats: full form, compressed form, ::1, ::ffff:IPv4, bare ::
	 * Uses a simpler, non-backtracking pattern to avoid ReDoS (Regular Expression Denial of Service)
	 */
	private static readonly IPV6_REGEX = /(?:::(?:ffff(?::0{1,4})?:)?(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])(?:\.(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])){3}|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::)/gi;

	/**
	 * Default sensitive field names that are always redacted from context
	 * Stored as lowercase for case-insensitive matching
	 */
	private static readonly DEFAULT_SENSITIVE_KEYS = [
		'password',
		'pwd',
		'passwd',
		'pass',
		'token',
		'secret',
		'key',
		'credential',
		'apikey',
		'api_key',
		'api-key',
		'authorization',
		'auth',
		'jwt',
		'refreshtoken',
		'accesstoken',
		'private_key',
		'privatekey',
		'secret_key',
		'client_secret',
		'access_token',
		'refresh_token',
		'bearer',
		'ssn',
		'credit_card',
		'creditcard',
		'card_number',
		'cardnumber',
		'cvv',
		'pin',
	];

	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	private get Options(): IErrorSanitizerOptions | undefined {
		try {
			return this.Module.get(ERROR_SANITIZER_OPTIONS, { strict: false });
		} catch {
			return undefined;
		}
	}

	/**
	 * Sanitize error response for client
	 * Removes sensitive information like stack traces, file paths, etc.
	 */
	public SanitizeErrorResponse(error: Record<string, any>, isDevelopment: boolean = false): Record<string, any> {
		const sanitized: Record<string, any> = {
			message: this.sanitizeMessage(error.message),
			statusCode: error.statusCode ?? HTTP_STATUS_INTERNAL_SERVER_ERROR,
			timestamp: new Date().toISOString(),
		};

		// Only include stack trace in development
		if (isDevelopment && error.stack) {
			sanitized.stack = error.stack;
		}

		// Sanitize context if present
		if (error.context) {
			sanitized.context = this.sanitizeContext(error.context);
		}

		return sanitized;
	}

	/**
	 * Sanitize an error message to remove sensitive information.
	 * Redacts file paths, database connection strings, API keys, Bearer tokens,
	 * email addresses, and IP addresses. Truncates overly long messages to prevent
	 * ReDoS attacks and ensure reasonable log sizes.
	 *
	 * @param message - The error message string to sanitize
	 * @returns Sanitized message with sensitive patterns replaced by placeholder strings
	 *
	 * @example
	 * ```typescript
	 * const msg = 'Error at /home/user/app.ts, Bearer sk_live_abc123';
	 * const Sanitized = sanitizeMessage(msg);
	 * // Returns: 'Error at [FILE], Bearer [REDACTED]'
	 * ```
	 */
	private sanitizeMessage(message: string): string {
		if (!message) return 'An error occurred';

		// Ensure message is a string
		let safeMessage = message;
		if (typeof safeMessage !== 'string') {
			safeMessage = String(safeMessage);
		}

		// Truncate message to prevent ReDoS attacks on regex patterns
		const truncated = safeMessage.length > ErrorSanitizerService.MAX_MESSAGE_LENGTH
			? `${safeMessage.substring(0, ErrorSanitizerService.MAX_MESSAGE_LENGTH)}... [truncated]`
			: safeMessage;

		// Remove file paths - match paths with code file extensions
		let sanitized = truncated.replace(ErrorSanitizerService.FILE_PATH_REGEX, '[FILE]');

		// Remove database connection strings
		sanitized = sanitized.replace(
			/mongodb:\/\/[^\s/]+/gi,
			'[REDACTED]',
		);
		sanitized = sanitized.replace(
			/postgres(?:ql)?:\/\/[^\s/]+/gi,
			'[REDACTED]',
		);

		// Remove API keys and tokens
		sanitized = sanitized.replace(
			/Bearer\s+[a-zA-Z0-9._-]+/gi,
			'Bearer [REDACTED]',
		);
		sanitized = sanitized.replace(
			/(?:api[_-]?key|sk_live|sk_test|pk_live|pk_test)[\s=:]*[a-zA-Z0-9._-]+/gi,
			'[REDACTED]',
		);

		// Remove email addresses - more restrictive pattern
		sanitized = sanitized.replace(
			/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
			'[EMAIL]',
		);

		// Remove IP addresses (both IPv4 and IPv6)
		sanitized = sanitized.replace(ErrorSanitizerService.IPV4_REGEX, '[IP]');
		sanitized = sanitized.replace(ErrorSanitizerService.IPV6_REGEX, '[IP]');

		return sanitized;
	}

	/**
	 * Recursively sanitize an error context object to remove sensitive field values.
	 * Identifies sensitive fields by name (e.g., password, token, secret) and replaces
	 * their values with a redaction marker. Handles nested objects and arrays while
	 * detecting circular references to prevent infinite loops.
	 *
	 * @param context - The context object to sanitize
	 * @returns Sanitized context with sensitive field values replaced
	 *
	 * @example
	 * ```typescript
	 * const Ctx = { user: 'john', password: 'secret123', nested: { apiKey: 'sk_live' } };
	 * const Sanitized = sanitizeContext(ctx);
	 * // Returns: { user: 'john', password: '***REDACTED***', nested: { apiKey: '***REDACTED***' } }
	 * ```
	 */
	private sanitizeContext(context: Record<string, any>): Record<string, any> {
		const seen = new Set<object>();
		const Result = this.serializeWithDepthLimit(
			context,
			ErrorSanitizerService.MAX_CONTEXT_DEPTH,
			0,
			seen,
		);
		return (Result as Record<string, any>) ?? {};
	}

	/**
	 * Recursively serialize an object with depth limiting and circular reference detection.
	 * Handles nested objects and arrays while preventing infinite loops.
	 *
	 * @param obj - The object to serialize
	 * @param maxDepth - Maximum nesting depth (default 5)
	 * @param currentDepth - Current recursion depth
	 * @param seen - Set of already-visited objects to detect cycles
	 * @returns Serialized object with sensitive fields redacted
	 */
	private serializeWithDepthLimit(
		obj: unknown,
		maxDepth: number,
		currentDepth: number,
		seen: Set<object>,
	): unknown {
		// Return non-object values as-is
		if (typeof obj !== 'object' || obj === null) {
			if (typeof obj === 'string') {
				return this.sanitizeMessage(obj);
			}
			return obj;
		}

		// Check for circular reference
		if (seen.has(obj)) {
			return '[CIRCULAR_REF]';
		}

		// Check for max depth
		if (currentDepth >= maxDepth) {
			return '[MAX_DEPTH]';
		}

		// Mark object as visited immediately after circular check, before recursing
		seen.add(obj);

		// Handle arrays
		if (Array.isArray(obj)) {
			return obj.map(item =>
				this.serializeWithDepthLimit(item, maxDepth, currentDepth + 1, seen),
			);
		}

		// Handle objects
		const sanitized: Record<string, any> = {};

		for (const [key, value] of Object.entries(obj)) {
			// Skip sensitive fields
			if (this.isSensitiveField(key)) {
				sanitized[key] = '***REDACTED***';
			} else if (typeof value === 'object' && value !== null) {
				// For objects and arrays, recurse with depth check
				sanitized[key] = this.serializeWithDepthLimit(
					value,
					maxDepth,
					currentDepth + 1,
					seen,
				);
			} else if (typeof value === 'string') {
				// Sanitize string values
				sanitized[key] = this.sanitizeMessage(value);
			} else {
				// Return primitive values as-is
				sanitized[key] = value;
			}
		}

		return sanitized;
	}

	/**
	 * Check if field is sensitive (case-insensitive comparison)
	 */
	private isSensitiveField(fieldName: string): boolean {
		const fieldNameLower = fieldName.toLowerCase();
		const allSensitiveFields = [
			...ErrorSanitizerService.DEFAULT_SENSITIVE_KEYS,
			...(this.Options?.additionalSensitiveKeys ?? []),
		];

		return allSensitiveFields.some(field =>
			fieldNameLower.includes(field.toLowerCase()),
		);
	}
}
