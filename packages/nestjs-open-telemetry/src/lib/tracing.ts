import { trace, context, SpanStatusCode, type Span, type Tracer, type SpanOptions, type Context } from '@opentelemetry/api';
import { OTEL_NAMESPACE } from './constants.js';

/**
 * Current namespace for tracer names (configurable, defaults to OTEL_NAMESPACE)
 */
let currentNamespace = OTEL_NAMESPACE;

/**
 * Set the namespace for tracer names (internal use)
 * @internal
 */
export function setTracerNamespace(namespace: string): void {
	currentNamespace = namespace;
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
 * const tracer = getTracer('user-service', '1.2.0');
 * // Tracer name becomes 'pawells.user-service'
 * const span = tracer.startSpan('getUserById');
 * // ... do work
 * span.end();
 * ```
 */
export function getTracer(name: string, version = '1.0.0'): Tracer {
	// Prefix with namespace if one is configured
	const tracerName = currentNamespace ? `${currentNamespace}.${name}` : name;
	return trace.getTracer(tracerName, version);
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
 * const tracer = getTracer('user-service');
 * const { span, ctx } = createSpan(tracer, 'getUserById', {
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
export function createSpan(
	tracer: Tracer,
	name: string,
	options?: SpanOptions,
	makeActive = true,
): { span: Span; ctx: Context } {
	const span = tracer.startSpan(name, options);
	const ctx = makeActive ? trace.setSpan(context.active(), span) : context.active();
	return { span, ctx };
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
 * const tracer = getTracer('user-service');
 *
 * const user = await withSpan(tracer, 'getUserById', async () => {
 *   const user = await db.findUser(userId);
 *   return user;
 * }, {
 *   attributes: { 'user.id': userId }
 * });
 * ```
 */
export async function withSpan<T>(
	tracer: Tracer,
	name: string,
	fn: () => T | Promise<T>,
	options?: SpanOptions,
): Promise<T> {
	const { span, ctx } = createSpan(tracer, name, options);
	try {
		const result = await context.with(ctx, async () => {
			const value = fn();
			// eslint-disable-next-line @typescript-eslint/return-await
			return value instanceof Promise ? await value : value;
		});
		span.setStatus({ code: SpanStatusCode.OK });
		return result;
	} catch (error) {
		span.recordException(error as Error);
		const message = error instanceof Error ? error.message : String(error);
		span.setStatus({ code: SpanStatusCode.ERROR, message });
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
 * addAttributes({
 *   'user.id': userId,
 *   'user.role': 'admin',
 *   'request.method': 'POST'
 * });
 * ```
 */
export function addAttributes(
	attributes: Record<string, string | number | boolean>,
	ctx?: Context,
): void {
	const activeContext = ctx ?? context.active();
	const span = trace.getSpan(activeContext);
	if (!span) {
		return;
	}
	Object.entries(attributes).forEach(([key, value]) => {
		span.setAttribute(key, value);
	});
}

/**
 * Reset tracer namespace to default.
 * Used for test isolation and cleanup.
 * @internal
 */
export function resetTracerNamespace(): void {
	currentNamespace = OTEL_NAMESPACE;
}
