import { trace, context, SpanStatusCode, type Span, type Tracer, type SpanOptions, type Context } from '@opentelemetry/api';
import { getErrorMessage } from '@pawells/nestjs-shared/common';
import { OTEL_NAMESPACE } from './constants.js';

/**
 * Current namespace for tracer names (configurable, defaults to OTEL_NAMESPACE)
 */
let CurrentNamespace = OTEL_NAMESPACE;

/**
 * Set the namespace for tracer names (internal use)
 * @internal
 * @private
 */
export function SetTracerNamespace(namespace: string): void {
	CurrentNamespace = namespace;
}

/**
 * Get a tracer instance with namespace conventions.
 *
 * Creates a tracer with the specified name and version, following namespace naming conventions.
 * The tracer is used to create and manage spans for distributed tracing.
 *
 * The provided name will be automatically prefixed with the configured namespace (e.g., 'user-service'
 * becomes 'pawells.user-service'). This ensures all traces are properly namespaced.
 *
 * @param name - Tracer name (e.g., 'user-service', 'auth-service'). Will be prefixed with namespace.
 * @param version - Optional tracer version (defaults to '1.0.0')
 * @returns Tracer instance
 *
 * @example
 * ```typescript
 * const tracer = GetTracer('user-service', '1.2.0');
 * // Tracer name becomes 'pawells.user-service'
 * const span = tracer.startSpan('getUserById');
 * // ... do work
 * span.end();
 * ```
 */
export function GetTracer(name: string, version = '1.0.0'): Tracer {
	// Prefix with namespace if one is configured
	const TracerName = CurrentNamespace ? `${CurrentNamespace}.${name}` : name;
	return trace.getTracer(TracerName, version);
}

/**
 * Create a new span with the given tracer.
 *
 * Helper function to create a span with common namespace conventions.
 * Automatically sets span as active in context if `makeActive` is true.
 *
 * @param tracer - Tracer instance
 * @param name - Span name
 * @param options - Optional span options
 * @param makeActive - Whether to make the span active in context (default: true)
 * @returns Object with span and context
 *
 * @example
 * ```typescript
 * const tracer = GetTracer('user-service');
 * const { span, ctx } = CreateSpan(tracer, 'getUserById', {
 *   attributes: { 'user.id': '123' }
 * });
 *
 * // Do work within span context
 * context.with(ctx, async () => {
 *   // Work here will be traced
 * });
 *
 * span.end();
 * ```
 */
export function CreateSpan(
	tracer: Tracer,
	name: string,
	options?: SpanOptions,
	makeActive = true,
): { span: Span; ctx: Context } {
	const Span = tracer.startSpan(name, options);
	const Ctx = makeActive ? trace.setSpan(context.active(), Span) : context.active();
	return { span: Span, ctx: Ctx };
}

/**
 * Execute a function within a span context.
 *
 * Automatically creates a span, executes the function within the span's context,
 * and properly handles success/error status and span ending.
 *
 * @param tracer - Tracer instance
 * @param name - Span name
 * @param fn - Function to execute within span context (can be sync or async)
 * @param options - Optional span options
 * @returns Promise resolving to function result
 *
 * @example
 * ```typescript
 * const tracer = GetTracer('user-service');
 *
 * const user = await WithSpan(tracer, 'getUserById', async () => {
 *   const user = await db.findUser(userId);
 *   return user;
 * }, {
 *   attributes: { 'user.id': userId }
 * });
 * ```
 */
export async function WithSpan<T>(
	tracer: Tracer,
	name: string,
	fn: () => T | Promise<T>,
	options?: SpanOptions,
): Promise<T> {
	const { span, ctx } = CreateSpan(tracer, name, options);
	try {
		const Result = await context.with(ctx, async () => {
			const Value = fn();
			// eslint-disable-next-line @typescript-eslint/return-await
			return Value instanceof Promise ? await Value : Value;
		});
		span.setStatus({ code: SpanStatusCode.OK });
		return Result;
	} catch (error) {
		span.recordException(error as Error);
		const Message = getErrorMessage(error);
		span.setStatus({ code: SpanStatusCode.ERROR, message: Message });
		throw error;
	} finally {
		span.end();
	}
}

/**
 * Add attributes to the current active span.
 *
 * Convenience function to add multiple attributes to the currently active span.
 *
 * **Silent No-Op Behavior**: If no span is currently active, this function silently
 * returns without error. This is intentional for graceful degradation when
 * OpenTelemetry is not initialized or outside of a span context. Attributes are
 * simply not recorded in this case.
 *
 * @param attributes - Attributes to add to the active span
 * @param ctx - Optional context (defaults to current active context)
 *
 * @example
 * ```typescript
 * AddAttributes({
 *   'user.id': userId,
 *   'user.role': 'admin',
 *   'request.method': 'POST'
 * });
 * ```
 */
export function AddAttributes(
	attributes: Record<string, string | number | boolean>,
	ctx?: Context,
): void {
	const ActiveContext = ctx ?? context.active();
	const Span = trace.getSpan(ActiveContext);
	if (!Span) {
		return;
	}
	Object.entries(attributes).forEach(([key, value]) => {
		Span.setAttribute(key, value);
	});
}

/**
 * Reset tracer namespace to default.
 * Used for test isolation and cleanup.
 * @internal
 * @private
 */
export function ResetTracerNamespace(): void {
	CurrentNamespace = OTEL_NAMESPACE;
}
