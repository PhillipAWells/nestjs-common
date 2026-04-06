import { trace, SpanStatusCode, context, SpanKind } from '@opentelemetry/api';
import { getErrorMessage, getErrorStack } from '@pawells/nestjs-shared/common';
import { OTEL_NAMESPACE } from '../lib/constants.js';

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

export interface ITracedOptions {
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
export function Traced(options: ITracedOptions = {}) {
	return function(
		target: object,
		propertyKey: string | symbol,
		descriptor: PropertyDescriptor,
	): PropertyDescriptor {
		// Guard against being used as a class decorator (descriptor will be undefined)
		if (!descriptor) {
			return descriptor;
		}
		const OriginalMethod = descriptor.value as (...args: unknown[]) => unknown;
		const ClassName = (target as { constructor: { name: string } }).constructor.name;
		const MethodName = String(propertyKey);

		// Determine span name
		const SpanName = options.name ?? `${ClassName}.${MethodName}`;

		// Determine tracer name (use class name)
		const TracerName = `${OTEL_NAMESPACE}.${ClassName}`;

		// Replace method with traced version that preserves sync/async signatures
		descriptor.value = function(...args: unknown[]): unknown {
			const Tracer = trace.getTracer(TracerName, '1.0.0');
			const Span = Tracer.startSpan(SpanName, {
				kind: options.kind ?? SpanKind.INTERNAL,
			});

			// Set base attributes
			const SpanAttributes: Record<string, string | number | boolean> = {
				'code.function': MethodName,
				'code.namespace': ClassName,
				'method.args_count': args.length,
				...(options.attributes ? CastAttributesToValidTypes(options.attributes) : {}),
			};

			// Capture method arguments if enabled (default: true)
			if (options.captureArgs !== false) {
				args.forEach((arg, index) => {
					const AttrValue = SanitizeArgument(arg);
					if (AttrValue !== null) {
						SpanAttributes[`method.arg.${index}`] = AttrValue;
					}
				});
			}

			// Set all attributes
			Object.entries(SpanAttributes).forEach(([key, value]) => {
				Span.setAttribute(key, value);
			});

			// Execute method within span context
			const Ctx = trace.setSpan(context.active(), Span);

			try {
				const Result = context.with(Ctx, () => OriginalMethod.apply(this, args));

				// Check if result is a Promise (async method)
				if (Result instanceof Promise) {
					// Async path: Chain promise handlers wrapped in context.with(Ctx, ...)
					// so that span attribute writes and any child spans created inside
					// the handlers run within the correct active span context.
					return Result.then(
						(value) => context.with(Ctx, () => {
							try {
								// Capture return value if enabled (default: false)
								if (options.captureReturn === true) {
									const ReturnValue = SanitizeArgument(value);
									if (ReturnValue !== null) {
										Span.setAttribute('method.return', ReturnValue);
									} else {
										Span.setAttribute('method.return_type', typeof value);
									}
								}

								// Set success status
								Span.setStatus({ code: SpanStatusCode.OK });
							} finally {
								Span.end();
							}

							return value;
						}),
						(error) => context.with(Ctx, () => {
							try {
								// Record exception and set error status
								const ErrorInstance = error instanceof Error ? error : new Error(String(error));
								Span.recordException(ErrorInstance);
								const Message = getErrorMessage(error);
								Span.setStatus({ code: SpanStatusCode.ERROR, message: Message });

								// Add error attributes
								if (error instanceof Error) {
									Span.setAttribute('error.type', error.name);
									Span.setAttribute('error.message', error.message);
									const Stack = getErrorStack(error);
									if (Stack) {
										Span.setAttribute('error.stack', TruncateString(Stack, TRUNCATE_STACK_LENGTH));
									}
								}
							} finally {
								Span.end();
							}
							throw error;
						}),
					);
				} else {
					// Sync path: Handle span immediately with try-finally to guarantee span.end()
					try {
						// Capture return value if enabled (default: false)
						if (options.captureReturn === true) {
							const ReturnValue = SanitizeArgument(Result);
							if (ReturnValue !== null) {
								Span.setAttribute('method.return', ReturnValue);
							} else {
								Span.setAttribute('method.return_type', typeof Result);
							}
						}

						// Set success status
						Span.setStatus({ code: SpanStatusCode.OK });
					} finally {
						Span.end();
					}

					return Result;
				}
			} catch (error) {
				// Record exception and set error status (for sync errors only)
				try {
					const ErrorInstance = error instanceof Error ? error : new Error(String(error));
					Span.recordException(ErrorInstance);
					const Message = getErrorMessage(error);
					Span.setStatus({ code: SpanStatusCode.ERROR, message: Message });

					// Add error attributes
					if (error instanceof Error) {
						Span.setAttribute('error.type', error.name);
						Span.setAttribute('error.message', error.message);
						const Stack = getErrorStack(error);
						if (Stack) {
							Span.setAttribute('error.stack', TruncateString(Stack, TRUNCATE_STACK_LENGTH));
						}
					}
				} finally {
					Span.end();
				}
				throw error;
			}
		};
		Object.defineProperty(descriptor.value, 'name', { value: MethodName, configurable: true });

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
function CastAttributesToValidTypes(
	attributes: Record<string, unknown>,
): Record<string, string | number | boolean> {
	const Result: Record<string, string | number | boolean> = {};

	for (const [Key, Value] of Object.entries(attributes)) {
		if (typeof Value === 'string' || typeof Value === 'number' || typeof Value === 'boolean') {
			Result[Key] = Value;
		} else if (Value === null || Value === undefined) {
			Result[Key] = String(Value);
		} else if (typeof Value === 'object') {
			Result[Key] = JSON.stringify(Value);
		} else {
			// Functions, symbols, etc.
			Result[Key] = String(Value);
		}
	}

	return Result;
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
function DetectAndRedactPII(
	value: string,
): string {
	// PII detection patterns with labels
	const Patterns = [
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

	let Sanitized = value;

	for (const Pattern of Patterns) {
		if (Pattern.type === 'creditCard') {
			// For credit cards, validate with Luhn algorithm before redacting
			Sanitized = Sanitized.replace(Pattern.regex, (match) => {
				return IsValidCreditCard(match) ? `[REDACTED_${Pattern.label}]` : match;
			});
		} else {
			// For other PII types, redact directly
			Sanitized = Sanitized.replace(Pattern.regex, `[REDACTED_${Pattern.label}]`);
		}
	}

	return Sanitized;
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
function IsValidCreditCard(
	num: string,
): boolean {
	// Extract digits only
	const Digits = num.replace(/\D/g, '');

	// Credit card numbers are typically 13-19 digits
	if (Digits.length < MIN_CREDIT_CARD_DIGITS || Digits.length > MAX_CREDIT_CARD_DIGITS) {
		return false;
	}

	// Luhn algorithm implementation
	let Sum = 0;
	let IsEven = false;

	// Process digits from right to left
	for (let I = Digits.length - 1; I >= 0; I--) {
		const DigitChar = Digits[I];
		if (!DigitChar) {
			return false;
		}
		let Digit = parseInt(DigitChar, 10);

		if (IsEven) {
			Digit *= 2;
			// If result is > 9, subtract 9 (equivalent to adding digits)
			if (Digit > CREDIT_CARD_DOUBLE_DIGIT_LIMIT) {
				Digit -= CREDIT_CARD_ADJUSTMENT;
			}
		}

		Sum += Digit;
		IsEven = !IsEven;
	}

	// Valid if sum is divisible by 10
	return Sum % LUHN_MODULO === 0;
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
function SanitizeArgument(
	arg: unknown,
): string | number | boolean | null {
	// Handle primitives
	if (typeof arg === 'string') {
		// Detect and redact PII, then truncate
		const Redacted = DetectAndRedactPII(arg);
		return TruncateString(Redacted, TRUNCATE_ARGS_LENGTH);
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
			const SanitizedArray = (arg as (string | number)[]).map(item => {
				if (typeof item === 'string') {
					return DetectAndRedactPII(item);
				}
				return item;
			});
			return JSON.stringify(SanitizedArray);
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
function TruncateString(
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
