/**
 * @pawells/nestjs-open-telemetry
 * NestJS integration for OpenTelemetry
 */

// Modules
export { OpenTelemetryModule } from './opentelemetry.module.js';

// Exporters
export { OpenTelemetryExporter } from './exporters/index.js';

// Logger adapter
export { OpenTelemetryLogger } from './adapters/nestjs-logger.js';

// Decorators
export { Traced, SpanKind } from './decorators/traced.decorator.js';
export type { TracedOptions } from './decorators/traced.decorator.js';

// Re-export useful types from dependencies
export type { ILoggerConfig, LogLevel } from '@pawells/logger';
export type { Span, SpanContext, Attributes } from '@opentelemetry/api';

// Re-export commonly used helpers from core package
export {
	recordHttpMetrics,
	trackActiveRequests,
	getTracer,
	createSpan,
	withSpan,
	addAttributes,
} from '@pawells/open-telemetry-client';
