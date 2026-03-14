/**
 * Default namespace for OpenTelemetry tracer names.
 *
 * This constant is used to automatically prefix tracer names with a consistent namespace.
 * For example, when you call `getTracer('user-service')`, the actual tracer name becomes
 * 'pawells.user-service'. This ensures all traces are properly namespaced and grouped
 * in observability platforms.
 *
 * Can be overridden at runtime via `setTracerNamespace()` in lib/tracing.ts.
 *
 * @constant
 * @type {string}
 * @default 'pawells'
 */
export const OTEL_NAMESPACE = 'pawells';
