import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger as PawellsLogger, LogLevel as PawellsLogLevel } from '@pawells/logger';
import { CreateJsonCircularReplacer } from '@pawells/typescript-common';
import { trace, context } from '@opentelemetry/api';
import { LogLevel, ILogMetadata, LOG_LEVEL_FROM_STRING } from '../interfaces/log-entry.interface.js';
import { IContextualLogger } from '../interfaces/logger.interface.js';

import { MAX_SANITIZE_DEPTH } from '../utils/sanitization.utils.js';

/**
 * Options object for logging methods.
 * Provides a cleaner alternative to positional parameters.
 */
export interface ILogOptions {
	context?: string;
	trace?: string;
	metadata?: ILogMetadata;
}

/**
 * Centralized application logger service.
 * Wraps @pawells/logger and respects LOG_LEVEL environment variable for filtering.
 * Automatically redacts sensitive information (passwords, tokens, API keys) from logs.
 * Supports structured logging with context and metadata.
 * Integrates with OpenTelemetry for trace and span ID correlation.
 * Implements Interface Segregation Principle with focused interfaces.
 *
 * @example
 * ```typescript
 * // Use flexible logging methods
 * logger.info('IUser logged in', 'AuthService', { userId: '123' });
 * logger.error('Database error', error.stack, 'DatabaseService', { query: '...' });
 * logger.debug('Cache hit', { metadata: { key: 'users:123' } });
 * ```
 */

@Injectable()
export class AppLogger implements IContextualLogger {
	private readonly PawellsLogger: PawellsLogger;

	private readonly MinLevel: number;

	private readonly ServiceName: string;

	/**
	 * Set of field names that contain sensitive information requiring redaction in logs.
	 * Stored as lowercase for case-insensitive matching against object keys.
	 * Prevents leaking credentials, tokens, and other security-sensitive data into log output.
	 * Includes passwords, API keys, tokens, and payment card information.
	 */
	private readonly SensitiveKeys = new Set([
		'password', 'passwd', 'pwd',
		'token', 'authorization', 'auth', 'authtoken', 'refreshtoken', 'accesstoken', 'bearertoken', 'sessiontoken',
		'secret', 'api_key', 'apikey', 'apisecret', 'privatekey', 'encryptionkey',
		'credit_card', 'creditcard', 'cc_number', 'ccnumber', 'cardnumber',
		'ssn', 'social_security', 'socialsecurity',
		'cookie', 'session',
	]);

	private readonly ConfigService: ConfigService | undefined;
	private readonly Context: string;

	constructor(
		@Inject(ConfigService) @Optional() configService?: ConfigService,
		@Optional() context: string = 'AppLogger',
	) {
		this.ConfigService = configService;
		this.Context = context;
		this.ServiceName = this.ConfigService?.get<string>('SERVICE_NAME') ?? process.env['SERVICE_NAME'] ?? 'unknown-service';
		this.MinLevel = this.ParseLogLevel();

		// Create instance of @pawells/logger
		const PawellsLogLevel = this.MapNestjsLogLevelToPawells(this.MinLevel);
		const LogFormat = this.ParseLogFormat();
		this.PawellsLogger = new PawellsLogger({
			service: this.ServiceName,
			level: PawellsLogLevel,
			format: LogFormat,
		});
	}

	/**
	 * Parse LOG_LEVEL environment variable
	 * @returns LogLevel enum value (numeric)
	 */
	private ParseLogLevel(): number {
		const Level = (this.ConfigService?.get<string>('LOG_LEVEL') ?? process.env['LOG_LEVEL'] ?? 'info').toLowerCase();
		const ParsedLevel = LOG_LEVEL_FROM_STRING[Level];

		// Warn if the LOG_LEVEL value is invalid and log valid values
		if (ParsedLevel === undefined) {
			const ValidLevels = Object.keys(LOG_LEVEL_FROM_STRING).join(', ');
			const Message = `[AppLogger] Invalid LOG_LEVEL value: "${Level}". Valid values are: ${ValidLevels}. Falling back to "info".`;
			try {
				console.error(Message);
			} catch {
				// Ignore console error failures silently
			}
			return LogLevel.INFO;
		}

		return ParsedLevel;
	}

	/**
	 * Parse LOG_FORMAT environment variable
	 * @returns Format type ('json' | 'text'), defaults to 'json'
	 */
	private ParseLogFormat(): 'json' | 'text' {
		const Format = (this.ConfigService?.get<string>('LOG_FORMAT') ?? process.env['LOG_FORMAT'] ?? 'json').toLowerCase();

		// Validate format is either 'json' or 'text'
		if (Format !== 'json' && Format !== 'text') {
			const Message = `[AppLogger] Invalid LOG_FORMAT value: "${Format}". Valid values are: json, text. Falling back to "json".`;
			try {
				console.error(Message);
			} catch {
				// Ignore console error failures silently
			}
			return 'json';
		}

		return Format;
	}

	/**
	 * Map nestjs-shared numeric LogLevel to @pawells/logger LogLevel
	 * @param level - Numeric LogLevel from nestjs-shared
	 * @returns String LogLevel for @pawells/logger
	 */
	private MapNestjsLogLevelToPawells(level: number): PawellsLogLevel {
		const Mapping: Record<number, PawellsLogLevel> = {
			[LogLevel.DEBUG]: PawellsLogLevel.DEBUG,
			[LogLevel.INFO]: PawellsLogLevel.INFO,
			[LogLevel.WARN]: PawellsLogLevel.WARN,
			[LogLevel.ERROR]: PawellsLogLevel.ERROR,
			[LogLevel.FATAL]: PawellsLogLevel.FATAL,
			[LogLevel.SILENT]: PawellsLogLevel.SILENT,
		};
		return Mapping[level] ?? PawellsLogLevel.INFO;
	}

	/**
	 * Check if a log level should be output
	 * @param level - Level to check
	 * @returns true if level should be logged
	 */
	private ShouldLog(level: number): boolean {
		return level >= this.MinLevel;
	}

	/**
	 * Sanitize metadata to remove sensitive information and handle circular references
	 * @param metadata - Metadata to sanitize
	 * @returns Sanitized metadata with circular references replaced by '[CIRCULAR_REF]'
	 */
	private SanitizeMetadata(metadata?: ILogMetadata): ILogMetadata | undefined {
		if (!metadata) return undefined;

		const Sanitized: Record<string, any> = { ...metadata };
		const Visited = new WeakSet();

		const Sanitize = (obj: any, depth: number = 0): any => {
			if (depth >= MAX_SANITIZE_DEPTH) return '[DEPTH_EXCEEDED]';
			if (typeof obj !== 'object' || obj === null) return obj;

			if (Visited.has(obj)) {
				return '[CIRCULAR_REF]';
			}
			Visited.add(obj);

			const Result: Record<string, any> = Array.isArray(obj) ? [] : {};
			for (const [Key, Value] of Object.entries(obj)) {
				const LowerKey = Key.toLowerCase();
				const IsExactMatch = this.SensitiveKeys.has(LowerKey);

				if (IsExactMatch) {
					// Exact match: keep key, redact value
					Result[Key] = '[REDACTED]';
				} else {
					// Check if key contains any sensitive pattern
					let ContainsSensitivePattern = false;
					for (const SensitivePattern of this.SensitiveKeys) {
						if (LowerKey.includes(SensitivePattern)) {
							ContainsSensitivePattern = true;
							break;
						}
					}

					if (ContainsSensitivePattern) {
						// Contains pattern: redact the key name itself
						Result['[REDACTED_KEY]'] = '[REDACTED]';
					} else {
						// Not sensitive: process normally
						Result[Key] = Sanitize(Value, depth + 1);
					}
				}
			}
			return Result;
		};

		try {
			const Stringified = JSON.stringify(Sanitize(Sanitized), CreateJsonCircularReplacer('[CIRCULAR_REF]'));
			return JSON.parse(Stringified);
		} catch {
			// If JSON.stringify fails, return the sanitized object as-is
			return Sanitize(Sanitized);
		}
	}

	/**
	 * Extract OpenTelemetry trace context
	 * @returns Object with traceId and spanId if available
	 */
	private ExtractTraceContext(): { traceId?: string; spanId?: string } {
		try {
			const Span = trace.getSpan(context.active());
			if (Span) {
				const SpanContext = Span.spanContext();
				return {
					traceId: SpanContext.traceId,
					spanId: SpanContext.spanId,
				};
			}
		} catch {
			// Silently ignore tracing errors
		}
		return {};
	}

	/**
	 * Build metadata with context and trace info
	 * @param logContext - Logger context
	 * @param metadata - IUser-provided metadata
	 * @returns Combined metadata
	 */
	private BuildMetadata(logContext: string, metadata?: ILogMetadata): Record<string, unknown> {
		const { traceId, spanId } = this.ExtractTraceContext();
		const Sanitized = this.SanitizeMetadata(metadata);

		const Result: Record<string, unknown> = {
			context: logContext,
		};

		if (Sanitized) {
			Result.metadata = Sanitized;
		}
		if (traceId) {
			Result.traceId = traceId;
		}
		if (spanId) {
			Result.spanId = spanId;
		}

		return Result;
	}

	/**
	 * Log debug message
	 * @param message - Log message
	 * @param options - Optional context/metadata options
	 */
	public Debug(message: string | Error, options: ILogOptions): void;
	/**
	 * Log debug message
	 * @param message - Log message
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	public Debug(message: string | Error, context?: string, metadata?: ILogMetadata): void;
	/**
	 * Log debug message
	 * @param message - Log message
	 * @param metadata - Optional structured metadata
	 */
	public Debug(message: string | Error, metadata?: ILogMetadata): void;
	public Debug(message: string | Error, contextOrMetadata?: string | ILogMetadata | ILogOptions, metadata?: ILogMetadata): void {
		if (this.ShouldLog(LogLevel.DEBUG)) {
			let Ctx = this.Context;
			let Meta = metadata;

			// Handle options-object form
			if (contextOrMetadata !== undefined && typeof contextOrMetadata === 'object' && !Array.isArray(contextOrMetadata) && 'context' in contextOrMetadata) {
				const Opts = contextOrMetadata as ILogOptions;
				Ctx = Opts.context ?? this.Context;
				Meta = Opts.metadata;
			} else if (typeof contextOrMetadata === 'string') {
				Ctx = contextOrMetadata;
			} else if (typeof contextOrMetadata === 'object' && !('context' in contextOrMetadata)) {
				Meta = contextOrMetadata as ILogMetadata;
			}

			const Msg = message instanceof Error ? message.message : message;
			const BuiltMetadata = this.BuildMetadata(Ctx, Meta);

			void this.PawellsLogger.debug(Msg, BuiltMetadata).catch((err: unknown) => {
				const FallbackMsg = `[AppLogger fallback] ${String(err)}\n`;
				try {
					process.stderr.write(FallbackMsg);
				} catch {
					// Ignore stderr write failures silently as final fallback
				}
			});
		}
	}

	/**
	 * Log debug message (implements IContextualLogger interface)
	 * Delegates to Debug method for PascalCase consistency
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public debug(message: string | Error, options: ILogOptions): void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public debug(message: string | Error, context?: string, metadata?: ILogMetadata): void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public debug(message: string | Error, metadata?: ILogMetadata): void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public debug(message: string | Error, contextOrMetadata?: string | ILogMetadata | ILogOptions, metadata?: ILogMetadata): void {
		return this.Debug(message, contextOrMetadata as any, metadata);
	}

	/**
	 * Log info message
	 * @param message - Log message
	 * @param options - Optional context/metadata options
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public info(message: string | Error, options: ILogOptions): void;
	/**
	 * Log info message
	 * @param message - Log message
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public info(message: string | Error, context?: string, metadata?: ILogMetadata): void;
	/**
	 * Log info message
	 * @param message - Log message
	 * @param metadata - Optional structured metadata
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public info(message: string | Error, metadata?: ILogMetadata): void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public info(message: string | Error, contextOrMetadata?: string | ILogMetadata | ILogOptions, metadata?: ILogMetadata): void {
		if (this.ShouldLog(LogLevel.INFO)) {
			let Ctx = this.Context;
			let Meta = metadata;

			// Handle options-object form
			if (contextOrMetadata !== undefined && typeof contextOrMetadata === 'object' && !Array.isArray(contextOrMetadata) && 'context' in contextOrMetadata) {
				const Opts = contextOrMetadata as ILogOptions;
				Ctx = Opts.context ?? this.Context;
				Meta = Opts.metadata;
			} else if (typeof contextOrMetadata === 'string') {
				Ctx = contextOrMetadata;
			} else if (typeof contextOrMetadata === 'object' && !('context' in contextOrMetadata)) {
				Meta = contextOrMetadata as ILogMetadata;
			}

			const Msg = message instanceof Error ? message.message : message;
			const BuiltMetadata = this.BuildMetadata(Ctx, Meta);

			void this.PawellsLogger.info(Msg, BuiltMetadata).catch((err: unknown) => {
				const FallbackMsg = `[AppLogger fallback] ${String(err)}\n`;
				try {
					process.stderr.write(FallbackMsg);
				} catch {
					// Ignore stderr write failures silently as final fallback
				}
			});
		}
	}

	/**
	 * Log warning message
	 * @param message - Log message
	 * @param options - Optional context/metadata options
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public warn(message: string | Error, options: ILogOptions): void;
	/**
	 * Log warning message
	 * @param message - Log message
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public warn(message: string | Error, context?: string, metadata?: ILogMetadata): void;
	/**
	 * Log warning message
	 * @param message - Log message
	 * @param metadata - Optional structured metadata
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public warn(message: string | Error, metadata?: ILogMetadata): void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public warn(message: string | Error, contextOrMetadata?: string | ILogMetadata | ILogOptions, metadata?: ILogMetadata): void {
		if (this.ShouldLog(LogLevel.WARN)) {
			let Ctx = this.Context;
			let Meta = metadata;

			// Handle options-object form
			if (contextOrMetadata !== undefined && typeof contextOrMetadata === 'object' && !Array.isArray(contextOrMetadata) && 'context' in contextOrMetadata) {
				const Opts = contextOrMetadata as ILogOptions;
				Ctx = Opts.context ?? this.Context;
				Meta = Opts.metadata;
			} else if (typeof contextOrMetadata === 'string') {
				Ctx = contextOrMetadata;
			} else if (typeof contextOrMetadata === 'object' && !('context' in contextOrMetadata)) {
				Meta = contextOrMetadata as ILogMetadata;
			}

			const Msg = message instanceof Error ? message.message : message;
			const BuiltMetadata = this.BuildMetadata(Ctx, Meta);

			void this.PawellsLogger.warn(Msg, BuiltMetadata).catch((err: unknown) => {
				const FallbackMsg = `[AppLogger fallback] ${String(err)}\n`;
				try {
					process.stderr.write(FallbackMsg);
				} catch {
					// Ignore stderr write failures silently as final fallback
				}
			});
		}
	}

	/**
	 * Log error message
	 * @param message - Log message or Error object
	 * @param options - Optional context/trace/metadata options
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public error(message: string | Error, options: ILogOptions): void;
	/**
	 * Log error message
	 * @param message - Log message or Error object
	 * @param trace - Optional stack trace
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public error(message: string | Error, trace?: string, context?: string, metadata?: ILogMetadata): void;
	/**
	 * Log error message
	 * @param message - Log message or Error object
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public error(message: string | Error, context?: string, metadata?: ILogMetadata): void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public error(message: string | Error, traceOrContext?: string | ILogOptions, contextOrMetadata?: string | ILogMetadata, metadata?: ILogMetadata): void {
		if (this.ShouldLog(LogLevel.ERROR)) {
			let Ctx = this.Context;
			let Meta = metadata;
			let Trace: string | undefined;

			// Handle options-object form
			if (traceOrContext !== undefined && typeof traceOrContext === 'object' && !Array.isArray(traceOrContext) && 'context' in traceOrContext) {
				const Opts = traceOrContext as ILogOptions;
				Ctx = Opts.context ?? this.Context;
				Meta = Opts.metadata;
				Trace = Opts.trace;
			} else if (typeof traceOrContext === 'string' && typeof contextOrMetadata === 'string') {
				// error(message, trace, context, metadata?)
				Trace = traceOrContext;
				Ctx = contextOrMetadata;
			} else if (typeof traceOrContext === 'string' && typeof contextOrMetadata === 'object') {
				// error(message, trace, metadata)
				Trace = traceOrContext;
				Meta = contextOrMetadata;
			} else if (typeof traceOrContext === 'string') {
				// error(message, context)
				Ctx = traceOrContext;
			} else if (typeof contextOrMetadata === 'object') {
				// error(message, metadata)
				Meta = contextOrMetadata;
			}

			const Msg = message instanceof Error ? message.message : message;
			const MetaWithTrace = Trace ? { ...Meta, stack: Trace } : Meta;
			const BuiltMetadata = this.BuildMetadata(Ctx, MetaWithTrace);

			void this.PawellsLogger.error(Msg, BuiltMetadata).catch((err: unknown) => {
				const FallbackMsg = `[AppLogger fallback] ${String(err)}\n`;
				try {
					process.stderr.write(FallbackMsg);
				} catch {
					// Ignore stderr write failures silently as final fallback
				}
			});
		}
	}

	/**
	 * Log fatal message
	 * @param message - Log message or Error object
	 * @param options - Optional context/trace/metadata options
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public fatal(message: string | Error, options: ILogOptions): void;
	/**
	 * Log fatal message
	 * @param message - Log message or Error object
	 * @param trace - Optional stack trace
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public fatal(message: string | Error, trace?: string, context?: string, metadata?: ILogMetadata): void;
	/**
	 * Log fatal message
	 * @param message - Log message or Error object
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public fatal(message: string | Error, context?: string, metadata?: ILogMetadata): void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public fatal(message: string | Error, traceOrContext?: string | ILogOptions, contextOrMetadata?: string | ILogMetadata, metadata?: ILogMetadata): void {
		if (this.ShouldLog(LogLevel.FATAL)) {
			let Ctx = this.Context;
			let Meta = metadata;
			let Trace: string | undefined;

			// Handle options-object form
			if (traceOrContext !== undefined && typeof traceOrContext === 'object' && !Array.isArray(traceOrContext) && 'context' in traceOrContext) {
				const Opts = traceOrContext as ILogOptions;
				Ctx = Opts.context ?? this.Context;
				Meta = Opts.metadata;
				Trace = Opts.trace;
			} else if (typeof traceOrContext === 'string' && typeof contextOrMetadata === 'string') {
				Trace = traceOrContext;
				Ctx = contextOrMetadata;
			} else if (typeof traceOrContext === 'string' && typeof contextOrMetadata === 'object') {
				Trace = traceOrContext;
				Meta = contextOrMetadata;
			} else if (typeof traceOrContext === 'string') {
				Ctx = traceOrContext;
			} else if (typeof contextOrMetadata === 'object') {
				Meta = contextOrMetadata;
			}

			const Msg = message instanceof Error ? message.message : message;
			const MetaWithTrace = Trace ? { ...Meta, stack: Trace } : Meta;
			const BuiltMetadata = this.BuildMetadata(Ctx, MetaWithTrace);

			void this.PawellsLogger.fatal(Msg, BuiltMetadata).catch((err: unknown) => {
				const FallbackMsg = `[AppLogger fallback] ${String(err)}\n`;
				try {
					process.stderr.write(FallbackMsg);
				} catch {
					// Ignore stderr write failures silently as final fallback
				}
			});
		}
	}

	/**
	 * Create a contextual logger instance
	 * @param context - Context string
	 * @returns New AppLogger instance with context
	 */
	public CreateContextualLogger(context: string): AppLogger {
		return new AppLogger(this.ConfigService, context);
	}

	/**
	 * Create a contextual logger instance (implements IContextualLogger interface)
	 * @param context - Context string
	 * @returns New AppLogger instance with context
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public createContextualLogger(context: string): IContextualLogger {
		return this.CreateContextualLogger(context);
	}
}
