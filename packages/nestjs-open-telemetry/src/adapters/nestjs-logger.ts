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
	private readonly Logger: Logger;

	constructor(config?: Partial<ILoggerConfig>) {
		this.Logger = new Logger({
			service: config?.service ?? 'nestjs-app',
			...(config?.level !== undefined && { level: config.level }),
			...(config?.format !== undefined && { format: config.format }),
		});
	}

	/**
	 * Log a message (info level).
	 */
	public Log(message: unknown, context?: string): void {
		const Metadata = this.BuildMetadata(context);
		this.Logger.info(this.FormatMessage(message), Metadata);
	}

	/** Lowercase alias for {@link Log}. Required by LoggerService interface. */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public log(message: unknown, context?: string): void {
		return this.Log(message, context);
	}

	/**
	 * Log an error message.
	 */
	public Error(message: unknown, stackTrace?: string, context?: string): void {
		const Metadata = this.BuildMetadata(context);
		if (stackTrace) {
			Metadata['stackTrace'] = stackTrace;
		}
		this.Logger.error(this.FormatMessage(message), Metadata);
	}

	/** Lowercase alias for {@link Error}. Required by LoggerService interface. */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public error(message: unknown, stackTrace?: string, context?: string): void {
		return this.Error(message, stackTrace, context);
	}

	/**
	 * Log a warning message.
	 */
	public Warn(message: unknown, context?: string): void {
		const Metadata = this.BuildMetadata(context);
		this.Logger.warn(this.FormatMessage(message), Metadata);
	}

	/** Lowercase alias for {@link Warn}. Required by LoggerService interface. */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public warn(message: unknown, context?: string): void {
		return this.Warn(message, context);
	}

	/**
	 * Log a debug message.
	 */
	public Debug(message: unknown, context?: string): void {
		const Metadata = this.BuildMetadata(context);
		this.Logger.debug(this.FormatMessage(message), Metadata);
	}

	/**
	 * Log a verbose message (mapped to debug).
	 * Intentional downgrade: NestJS verbose is the most verbose level, but AppLogger
	 * has no verbose level, so verbose messages are mapped to debug level.
	 */
	public Verbose(message: unknown, context?: string): void {
		this.Debug(message, context);
	}

	/**
	 * Log a fatal error message.
	 */
	public Fatal(message: unknown, context?: string): void {
		const Metadata = this.BuildMetadata(context);
		this.Logger.fatal(this.FormatMessage(message), Metadata);
	}

	/**
	 * Build metadata with trace context and NestJS context.
	 * @private
	 */
	private BuildMetadata(
		context?: string,
	): Record<string, string | number> {
		const Metadata: Record<string, string | number> = {};

		// Add NestJS context if provided
		if (context) {
			Metadata['context'] = context;
		}

		// Add OpenTelemetry trace context
		const Span = trace.getSpan(otelContext.active());
		if (Span) {
			const SpanContext = Span.spanContext();
			Metadata['trace_id'] = SpanContext.traceId;
			Metadata['span_id'] = SpanContext.spanId;
			Metadata['trace_flags'] = SpanContext.traceFlags;
		}

		return Metadata;
	}

	/**
	 * Format message to string.
	 * @private
	 */
	private FormatMessage(
		message: unknown,
	): string {
		if (typeof message === 'string') {
			return message;
		}
		if (message instanceof Error) {
			return message.message;
		}
		return JSON.stringify(message);
	}
}
