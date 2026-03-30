/**
 * @packageDocumentation
 *
 * OpenTelemetry tracing and metrics integration for NestJS applications.
 *
 * This package provides:
 * - **@Traced decorator** — Automatically wrap methods in distributed tracing spans with error handling
 * - **Manual span helpers** — Low-level control over span creation and context management via `getTracer`, `createSpan`, `withSpan`
 * - **HTTP metrics** — Record request duration, status codes, and body sizes following OpenTelemetry semantic conventions
 * - **Logger adapter** — Inject trace context (trace_id, span_id) into all logs automatically
 *
 * Depends on {@link https://www.npmjs.com/package/@pawells/nestjs-shared @pawells/nestjs-shared} for the `InstrumentationRegistry`.
 *
 * @example
 * ```typescript
 * import { Module } from '@nestjs/common';
 * import { CommonModule } from '@pawells/nestjs-shared';
 * import { OpenTelemetryModule } from '@pawells/nestjs-open-telemetry';
 *
 * @Module({
 *   imports: [
 *     CommonModule,                    // Provides InstrumentationRegistry
 *     OpenTelemetryModule.forRoot(),   // Integrates OpenTelemetry exporter
 *   ],
 * })
 * export class AppModule {}
 * ```
 */

// Modules
export { OpenTelemetryModule } from './opentelemetry.module.js';

// Exporters
export { OpenTelemetryExporter } from './exporters/index.js';

// Logger adapter
export { OpenTelemetryLogger } from './adapters/nestjs-logger.js';

// Decorators
export { Traced, SpanKind } from './decorators/traced.decorator.js';
export type { ITracedOptions } from './decorators/traced.decorator.js';

// Re-export useful types from dependencies
export type { ILoggerConfig, LogLevel } from '@pawells/logger';
export type { Span, SpanContext, Attributes } from '@opentelemetry/api';

// Re-export commonly used helpers from lib
export {
	getTracer,
	createSpan,
	withSpan,
	addAttributes,
	setTracerNamespace,
	resetTracerNamespace,
} from './lib/tracing.js';
export {
	recordHttpMetrics,
	trackActiveRequests,
	resetHttpMetrics,
} from './lib/metrics.js';
