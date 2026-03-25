import { trace, SpanStatusCode, context, SpanKind } from '@opentelemetry/api';
import { getErrorMessage, getErrorStack } from '@pawells/nestjs-shared/common';
import { OTEL_NAMESPACE } from '../lib/constants.js';
import type { MethodDecorator } from '@nestjs/common';

/**
 * Options for @Traced decorator.
 */
// Magic number constants
const TRUNCATE_ARGS_LENGTH = 100;
const TRUNCATE_STACK_LENGTH = 500;
const MIN_CREDIT_CARD_DIGITS = 13;
const MAX_CREDIT_CARD_DIGITS = 19;
const CREDIT_CARD_DOUBLE_DIGIT_LIMIT = 9;
const CREDIT_CARD_ADJUSTMENT = 9;
const LUHN_MODULO = 10;
const MAX_ARRAY_LENGTH_FOR_LOGGING = 5;

export interface TracedOptions {
	/**
   * Custom span name (defaults to ClassName.methodName)
   */
	name?: string;

	/**
   * Span kind (defaults to INTERNAL)
   */
	kind?: SpanKind;

	/**
   * Additional span attributes
   */
	attributes?: Record<string, string | number | boolean>;

	/**
   * Whether to capture method arguments as attributes (default: true)
   * Arguments longer than 100 chars or complex objects are omitted for security/size
   */
	captureArgs?: boolean;

	/**
   * Whether to capture method return value as attribute (default: false)
   * Return values longer than 100 chars or complex objects are omitted for security/size
   */
	captureReturn?: boolean;
}

/**
 * NestJS method decorator for automatic span creation.
 *
 * Automatically wraps method execution in a distributed tracing span.
 * Captures method parameters, return values, exceptions, and sets appropriate span status.
 *
 * @param options - Optional tracing configuration
 * @returns Method decorator
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { Injectable } from '@nestjs/common';
 * import { Traced } from '@pawells/nestjs-open-telemetry';
 *
 * @Injectable()
 * export class UserService {
 *   @Traced()
 *   async getUserById(userId: string) {
 *     return await this.db.findUser(userId);
 *   }
 * }
 * ```
 *
 * @example
 * With custom name and attributes:
 * ```typescript
 * @Traced({
 *   name: 'UserService.fetchUser',
 *   attributes: { 'service.layer': 'business-logic' },
 *   captureReturn: true
 * })
 * async getUserById(userId: string) {
 *   return await this.db.findUser(userId);
 * }
 * ```
 *
 * @example
 * For external HTTP calls:
 * ```typescript
 * import { SpanKind } from '@pawells/nestjs-open-telemetry';
 *
 * @Traced({
 *   name: 'HTTP GET /api/users',
 *   kind: SpanKind.CLIENT,
 *   attributes: { 'http.method': 'GET' }
 * })
 * async fetchUserFromAPI(userId: string) {
 *   return await this.httpClient.get(`/api/users/${userId}`);
 * }
 * ```
 */
export function Traced(options: TracedOptions = {}): MethodDecorator {
	return function(
		target: object,
		propertyKey: string | symbol,
		descriptor: PropertyDescriptor,
	): PropertyDescriptor {
		// Guard against being used as a class decorator (descriptor will be undefined)
		if (!descriptor) {
			return descriptor;
		}
		const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
		const className = (target as { constructor: { name: string } }).constructor.name;
		const methodName = String(propertyKey);

		// Determine span name
		const spanName = options.name ?? `${className}.${methodName}`;

		// Determine tracer name (use class name)
		const tracerName = `${OTEL_NAMESPACE}.${className}`;

		// Replace method with traced version that preserves sync/async signatures
		descriptor.value = function(...args: unknown[]): unknown {
			const tracer = trace.getTracer(tracerName, '1.0.0');
			const span = tracer.startSpan(spanName, {
				kind: options.kind ?? SpanKind.INTERNAL,
			});

			// Set base attributes
			const spanAttributes: Record<string, string | number | boolean> = {
				'code.function': methodName,
				'code.namespace': className,
				'method.args_count': args.length,
				...(options.attributes ? castAttributesToValidTypes(options.attributes) : {}),
			};

			// Capture method arguments if enabled (default: true)
			if (options.captureArgs !== false) {
				args.forEach((arg, index) => {
					const attrValue = sanitizeArgument(arg);
					if (attrValue !== null) {
						spanAttributes[`method.arg.${index}`] = attrValue;
					}
				});
			}

			// Set all attributes
			Object.entries(spanAttributes).forEach(([key, value]) => {
				span.setAttribute(key, value);
			});

			// Execute method within span context
			const ctx = trace.setSpan(context.active(), span);

			try {
				const result = context.with(ctx, () => originalMethod.apply(this, args));

				// Check if result is a Promise (async method)
				if (result instanceof Promise) {
					// Async path: Chain promise handlers wrapped in context.with(ctx, ...)
					// so that span attribute writes and any child spans created inside
					// the handlers run within the correct active span context.
					return result.then(
						(value) => context.with(ctx, () => {
							try {
								// Capture return value if enabled (default: false)
								if (options.captureReturn === true) {
									const returnValue = sanitizeArgument(value);
									if (returnValue !== null) {
										span.setAttribute('method.return', returnValue);
									} else {
										span.setAttribute('method.return_type', typeof value);
									}
								}

								// Set success status
								span.setStatus({ code: SpanStatusCode.OK });
							} finally {
								span.end();
							}

							return value;
						}),
						(error) => context.with(ctx, () => {
							try {
								// Record exception and set error status
								const errorInstance = error instanceof Error ? error : new Error(String(error));
								span.recordException(errorInstance);
								const message = getErrorMessage(error);
								span.setStatus({ code: SpanStatusCode.ERROR, message });

								// Add error attributes
								if (error instanceof Error) {
									span.setAttribute('error.type', error.name);
									span.setAttribute('error.message', error.message);
									const stack = getErrorStack(error);
									if (stack) {
										span.setAttribute('error.stack', truncateString(stack, TRUNCATE_STACK_LENGTH));
									}
								}
							} finally {
								span.end();
							}
							throw error;
						}),
					);
				} else {
					// Sync path: Handle span immediately with try-finally to guarantee span.end()
					try {
						// Capture return value if enabled (default: false)
						if (options.captureReturn === true) {
							const returnValue = sanitizeArgument(result);
							if (returnValue !== null) {
								span.setAttribute('method.return', returnValue);
							} else {
								span.setAttribute('method.return_type', typeof result);
							}
						}

						// Set success status
						span.setStatus({ code: SpanStatusCode.OK });
					} finally {
						span.end();
					}

					return result;
				}
			} catch (error) {
				// Record exception and set error status (for sync errors only)
				try {
					const errorInstance = error instanceof Error ? error : new Error(String(error));
					span.recordException(errorInstance);
					const message = getErrorMessage(error);
					span.setStatus({ code: SpanStatusCode.ERROR, message });

					// Add error attributes
					if (error instanceof Error) {
						span.setAttribute('error.type', error.name);
						span.setAttribute('error.message', error.message);
						const stack = getErrorStack(error);
						if (stack) {
							span.setAttribute('error.stack', truncateString(stack, TRUNCATE_STACK_LENGTH));
						}
					}
				} finally {
					span.end();
				}
				throw error;
			}
		};
		Object.defineProperty(descriptor.value, 'name', { value: methodName, configurable: true });

		return descriptor;
	};
}

/**
 * Cast span attributes to valid OpenTelemetry types.
 * @private
 *
 * Converts any attribute values to string, number, or boolean for compatibility with OTel API.
 * Objects are serialized with JSON.stringify; functions and symbols are converted to strings.
 *
 * @param attributes - Original attributes (may contain any types)
 * @returns Attributes cast to valid OTel types
 */
function castAttributesToValidTypes(
	attributes: Record<string, unknown>,
): Record<string, string | number | boolean> {
	const result: Record<string, string | number | boolean> = {};

	for (const [key, value] of Object.entries(attributes)) {
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			result[key] = value;
		} else if (value === null || value === undefined) {
			result[key] = String(value);
		} else if (typeof value === 'object') {
			result[key] = JSON.stringify(value);
		} else {
			// Functions, symbols, etc.
			result[key] = String(value);
		}
	}

	return result;
}

/**
 * Detect and redact Personally Identifiable Information (PII) from a string value.
 * @private
 *
 * Detects and replaces the following patterns:
 * - Email addresses: [REDACTED_EMAIL]
 * - Phone numbers: [REDACTED_PHONE]
 * - Social Security Numbers (SSN): [REDACTED_SSN]
 * - Credit Card numbers (with Luhn validation): [REDACTED_CREDIT_CARD]
 *
 * Credit card numbers are validated using the Luhn algorithm to reduce false positives.
 *
 * @param value - String value to check for PII
 * @returns String with PII redacted
 */
function detectAndRedactPII(
	value: string,
): string {
	// PII detection patterns with labels
	const patterns = [
		{
			type: 'email',
			regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gu,
			label: 'EMAIL',
		},
		{
			type: 'phone',
			regex: /\b(\+\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s-]?\d{4}\b/gu,
			label: 'PHONE',
		},
		{
			type: 'ssn',
			regex: /\b\d{3}-\d{2}-\d{4}\b/gu,
			label: 'SSN',
		},
		{
			type: 'creditCard',
			regex: /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/gu,
			label: 'CREDIT_CARD',
		},
	];

	let sanitized = value;

	for (const pattern of patterns) {
		if (pattern.type === 'creditCard') {
			// For credit cards, validate with Luhn algorithm before redacting
			sanitized = sanitized.replace(pattern.regex, (match) => {
				return isValidCreditCard(match) ? `[REDACTED_${pattern.label}]` : match;
			});
		} else {
			// For other PII types, redact directly
			sanitized = sanitized.replace(pattern.regex, `[REDACTED_${pattern.label}]`);
		}
	}

	return sanitized;
}

/**
 * Validate a credit card number using the Luhn algorithm.
 * @private
 *
 * The Luhn algorithm checks the mathematical validity of credit card numbers
 * to reduce false positives from random digit sequences.
 *
 * @param num - Credit card number string (may contain spaces or hyphens)
 * @returns True if the number passes Luhn validation, false otherwise
 */
function isValidCreditCard(
	num: string,
): boolean {
	// Extract digits only
	const digits = num.replace(/\D/g, '');

	// Credit card numbers are typically 13-19 digits
	if (digits.length < MIN_CREDIT_CARD_DIGITS || digits.length > MAX_CREDIT_CARD_DIGITS) {
		return false;
	}

	// Luhn algorithm implementation
	let sum = 0;
	let isEven = false;

	// Process digits from right to left
	for (let i = digits.length - 1; i >= 0; i--) {
		const digitChar = digits[i];
		if (!digitChar) {
			return false;
		}
		let digit = parseInt(digitChar, 10);

		if (isEven) {
			digit *= 2;
			// If result is > 9, subtract 9 (equivalent to adding digits)
			if (digit > CREDIT_CARD_DOUBLE_DIGIT_LIMIT) {
				digit -= CREDIT_CARD_ADJUSTMENT;
			}
		}

		sum += digit;
		isEven = !isEven;
	}

	// Valid if sum is divisible by 10
	return sum % LUHN_MODULO === 0;
}

/**
 * Sanitize argument for span attribute.
 * @private
 *
 * Converts argument to a safe string/number/boolean for span attributes.
 * Detects and redacts PII patterns (email, phone, SSN, credit card).
 * Returns null if argument is too complex or sensitive.
 *
 * @param arg - Argument to sanitize
 * @returns Sanitized value or null
 */
function sanitizeArgument(
	arg: unknown,
): string | number | boolean | null {
	// Handle primitives
	if (typeof arg === 'string') {
		// Detect and redact PII, then truncate
		const redacted = detectAndRedactPII(arg);
		return truncateString(redacted, TRUNCATE_ARGS_LENGTH);
	}

	if (typeof arg === 'number') {
		return arg;
	}

	if (typeof arg === 'boolean') {
		return arg;
	}

	// Handle null/undefined
	if (arg === null) {
		return 'null';
	}

	if (arg === undefined) {
		return 'undefined';
	}

	// Handle arrays (only if small and simple)
	if (Array.isArray(arg)) {
		if (arg.length === 0) {
			return '[]';
		}
		if (arg.length <= MAX_ARRAY_LENGTH_FOR_LOGGING && (arg as unknown[]).every(item => typeof item === 'string' || typeof item === 'number')) {
			// Sanitize array items for PII before serializing
			const sanitizedArray = (arg as (string | number)[]).map(item => {
				if (typeof item === 'string') {
					return detectAndRedactPII(item);
				}
				return item;
			});
			return JSON.stringify(sanitizedArray);
		}
		return `Array(${(arg as unknown[]).length})`;
	}

	// Handle objects (omit for security)
	if (typeof arg === 'object') {
		return `Object(${Object.keys(arg as object).length} keys)`;
	}

	// Skip functions, symbols, etc.
	return null;
}

/**
 * Truncate string to maximum length.
 * @private
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
function truncateString(
	str: string,
	maxLength: number,
): string {
	if (str.length <= maxLength) {
		return str;
	}
	return str.substring(0, maxLength) + '...';
}

/**
 * Export SpanKind for convenience when using @Traced decorator
 */
export { SpanKind } from '@opentelemetry/api';
