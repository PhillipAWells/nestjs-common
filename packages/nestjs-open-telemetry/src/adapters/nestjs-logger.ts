import { LoggerService } from '@nestjs/common';
import { trace, context as otelContext } from '@opentelemetry/api';
import { Logger, ILoggerConfig } from '@pawells/logger';

/**
 * NestJS LoggerService implementation with OpenTelemetry context integration.
 * Automatically injects trace_id and span_id into all log statements.
 *
 * @example
 * ```typescript
 * import { OpenTelemetryLogger } from '@pawells/nestjs-open-telemetry';
 *
 * @Module({
 *   providers: [
 *     {
 *       provide: Logger,
 *       useClass: OpenTelemetryLogger
 *     }
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
export class OpenTelemetryLogger implements LoggerService {
	private readonly logger: Logger;

	constructor(config?: Partial<ILoggerConfig>) {
		this.logger = new Logger({
			service: config?.service ?? 'nestjs-app',
			...(config?.level !== undefined && { level: config.level }),
			...(config?.format !== undefined && { format: config.format }),
		});
	}

	/**
	 * Log a message (info level).
	 */
	public log(message: any, context?: string): void {
		const metadata = this.buildMetadata(context);
		this.logger.info(this.formatMessage(message), metadata);
	}

	/**
	 * Log an error message.
	 */
	public error(message: any, stackTrace?: string, context?: string): void {
		const metadata = this.buildMetadata(context);
		if (stackTrace) {
			metadata['stackTrace'] = stackTrace;
		}
		this.logger.error(this.formatMessage(message), metadata);
	}

	/**
	 * Log a warning message.
	 */
	public warn(message: any, context?: string): void {
		const metadata = this.buildMetadata(context);
		this.logger.warn(this.formatMessage(message), metadata);
	}

	/**
	 * Log a debug message.
	 */
	public debug(message: any, context?: string): void {
		const metadata = this.buildMetadata(context);
		this.logger.debug(this.formatMessage(message), metadata);
	}

	/**
	 * Log a verbose message (mapped to debug).
	 */
	public verbose(message: any, context?: string): void {
		this.debug(message, context);
	}

	/**
	 * Build metadata with trace context and NestJS context.
	 */
	private buildMetadata(context?: string): Record<string, string | number> {
		const metadata: Record<string, string | number> = {};

		// Add NestJS context if provided
		if (context) {
			metadata['context'] = context;
		}

		// Add OpenTelemetry trace context
		const span = trace.getSpan(otelContext.active());
		if (span) {
			const spanContext = span.spanContext();
			metadata['trace_id'] = spanContext.traceId;
			metadata['span_id'] = spanContext.spanId;
			metadata['trace_flags'] = spanContext.traceFlags;
		}

		return metadata;
	}

	/**
	 * Format message to string.
	 */
	private formatMessage(message: unknown): string {
		if (typeof message === 'string') {
			return message;
		}
		if (message instanceof Error) {
			return message.message;
		}
		return JSON.stringify(message);
	}
}
