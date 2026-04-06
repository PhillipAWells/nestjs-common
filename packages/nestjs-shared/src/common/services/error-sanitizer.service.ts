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
	 * Sanitize an error object for sending to a client.
	 *
	 * Always present in the result: `message` (redacted), `statusCode`, `timestamp`.
	 * In development (`isDevelopment = true`): `stack` and sanitized `context` are also included.
	 * In production: stack traces and context are omitted entirely.
	 *
	 * @param error - Raw error object, typically from a caught exception or `BaseApplicationError`.
	 * @param isDevelopment - When `true`, includes stack trace and context in the response.
	 * @returns Sanitized response object safe to serialize and send to the client.
	 */
	public SanitizeErrorResponse(error: Record<string, any>, isDevelopment: boolean = false): Record<string, any> {
		const Sanitized: Record<string, any> = {
			message: this.SanitizeMessage(error.message),
			statusCode: error.statusCode ?? HTTP_STATUS_INTERNAL_SERVER_ERROR,
			timestamp: new Date().toISOString(),
		};

		// Only include stack trace in development
		if (isDevelopment && error.stack) {
			Sanitized.stack = error.stack;
		}

		// Sanitize context if present
		if (error.context) {
			Sanitized.context = this.SanitizeContext(error.context);
		}

		return Sanitized;
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
	private SanitizeMessage(message: string): string {
		if (!message) return 'An error occurred';

		// Ensure message is a string
		let SafeMessage = message;
		if (typeof SafeMessage !== 'string') {
			SafeMessage = String(SafeMessage);
		}

		// Truncate message to prevent ReDoS attacks on regex patterns
		const Truncated = SafeMessage.length > ErrorSanitizerService.MAX_MESSAGE_LENGTH
			? `${SafeMessage.substring(0, ErrorSanitizerService.MAX_MESSAGE_LENGTH)}... [truncated]`
			: SafeMessage;

		// Remove file paths - match paths with code file extensions
		let Sanitized = Truncated.replace(ErrorSanitizerService.FILE_PATH_REGEX, '[FILE]');

		// Remove database connection strings
		Sanitized = Sanitized.replace(
			/mongodb:\/\/[^\s/]+/gi,
			'[REDACTED]',
		);
		Sanitized = Sanitized.replace(
			/postgres(?:ql)?:\/\/[^\s/]+/gi,
			'[REDACTED]',
		);

		// Remove API keys and tokens
		Sanitized = Sanitized.replace(
			/Bearer\s+[a-zA-Z0-9._-]+/gi,
			'Bearer [REDACTED]',
		);
		Sanitized = Sanitized.replace(
			/(?:api[_-]?key|sk_live|sk_test|pk_live|pk_test)[\s=:]*[a-zA-Z0-9._-]+/gi,
			'[REDACTED]',
		);

		// Remove email addresses - more restrictive pattern
		Sanitized = Sanitized.replace(
			/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
			'[EMAIL]',
		);

		// Remove IP addresses (both IPv4 and IPv6)
		Sanitized = Sanitized.replace(ErrorSanitizerService.IPV4_REGEX, '[IP]');
		Sanitized = Sanitized.replace(ErrorSanitizerService.IPV6_REGEX, '[IP]');

		return Sanitized;
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
	private SanitizeContext(context: Record<string, any>): Record<string, any> {
		const Seen = new Set<object>();
		const Result = this.SerializeWithDepthLimit(
			context,
			ErrorSanitizerService.MAX_CONTEXT_DEPTH,
			0,
			Seen,
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
	private SerializeWithDepthLimit(
		obj: unknown,
		maxDepth: number,
		currentDepth: number,
		seen: Set<object>,
	): unknown {
		// Return non-object values as-is
		if (typeof obj !== 'object' || obj === null) {
			if (typeof obj === 'string') {
				return this.SanitizeMessage(obj);
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
				this.SerializeWithDepthLimit(item, maxDepth, currentDepth + 1, seen),
			);
		}

		// Handle objects
		const Sanitized: Record<string, any> = {};

		for (const [Key, Value] of Object.entries(obj)) {
			// Skip sensitive fields
			if (this.IsSensitiveField(Key)) {
				Sanitized[Key] = '***REDACTED***';
			} else if (typeof Value === 'object' && Value !== null) {
				// For objects and arrays, recurse with depth check
				Sanitized[Key] = this.SerializeWithDepthLimit(
					Value,
					maxDepth,
					currentDepth + 1,
					seen,
				);
			} else if (typeof Value === 'string') {
				// Sanitize string values
				Sanitized[Key] = this.SanitizeMessage(Value);
			} else {
				// Return primitive values as-is
				Sanitized[Key] = Value;
			}
		}

		return Sanitized;
	}

	/**
	 * Check if field is sensitive (case-insensitive comparison)
	 */
	private IsSensitiveField(fieldName: string): boolean {
		const FieldNameLower = fieldName.toLowerCase();
		const AllSensitiveFields = [
			...ErrorSanitizerService.DEFAULT_SENSITIVE_KEYS,
			...(this.Options?.additionalSensitiveKeys ?? []),
		];

		return AllSensitiveFields.some(field =>
			FieldNameLower.includes(field.toLowerCase()),
		);
	}
}
