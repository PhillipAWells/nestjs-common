import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger as PawellsLogger, LogLevel as PawellsLogLevel } from '@pawells/logger';
import { CreateJsonCircularReplacer } from '@pawells/typescript-common';
import { trace, context } from '@opentelemetry/api';
import { LogLevel, LogMetadata, LOG_LEVEL_FROM_STRING } from '../interfaces/log-entry.interface.js';
import { IContextualLogger } from '../interfaces/logger.interface.js';

import { MAX_SANITIZE_DEPTH } from '../utils/sanitization.utils.js';

/**
 * Options object for logging methods.
 * Provides a cleaner alternative to positional parameters.
 */
export interface LogOptions {
	context?: string;
	trace?: string;
	metadata?: LogMetadata;
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
 * logger.info('User logged in', 'AuthService', { userId: '123' });
 * logger.error('Database error', error.stack, 'DatabaseService', { query: '...' });
 * logger.debug('Cache hit', { metadata: { key: 'users:123' } });
 * ```
 */

@Injectable()
export class AppLogger implements IContextualLogger {
	private readonly pawellsLogger: PawellsLogger;

	private readonly minLevel: number;

	private readonly serviceName: string;

	/**
	 * Set of field names that contain sensitive information requiring redaction in logs.
	 * Stored as lowercase for case-insensitive matching against object keys.
	 * Prevents leaking credentials, tokens, and other security-sensitive data into log output.
	 * Includes passwords, API keys, tokens, and payment card information.
	 */
	private readonly sensitiveKeys = new Set([
		'password', 'passwd', 'pwd',
		'token', 'authorization', 'auth', 'authtoken', 'refreshtoken', 'accesstoken', 'bearertoken', 'sessiontoken',
		'secret', 'api_key', 'apikey', 'apisecret', 'privatekey', 'encryptionkey',
		'credit_card', 'creditcard', 'cc_number', 'ccnumber', 'cardnumber',
		'ssn', 'social_security', 'socialsecurity',
		'cookie', 'session',
	]);

	constructor(
		@Inject(ConfigService) @Optional() private readonly configService?: ConfigService,
		@Optional() private readonly context: string = 'AppLogger',
	) {
		this.serviceName = this.configService?.get('SERVICE_NAME', 'unknown-service') ?? 'unknown-service';
		this.minLevel = this.parseLogLevel();

		// Create instance of @pawells/logger
		const pawellsLogLevel = this.mapNestjsLogLevelToPawells(this.minLevel);
		this.pawellsLogger = new PawellsLogger({
			service: this.serviceName,
			level: pawellsLogLevel,
			format: 'json',
		});
	}

	/**
	 * Parse LOG_LEVEL environment variable
	 * @returns LogLevel enum value (numeric)
	 */
	private parseLogLevel(): number {
		if (!this.configService) {
			return LogLevel.INFO;
		}
		const level = this.configService.get<string>('LOG_LEVEL', 'info').toLowerCase();
		const parsedLevel = LOG_LEVEL_FROM_STRING[level];

		// Warn if the LOG_LEVEL value is invalid and log valid values
		if (parsedLevel === undefined) {
			const validLevels = Object.keys(LOG_LEVEL_FROM_STRING).join(', ');
			const message = `[AppLogger] Invalid LOG_LEVEL value: "${level}". Valid values are: ${validLevels}. Falling back to "info".`;
			try {
				console.error(message);
			} catch {
				// Ignore console error failures silently
			}
			return LogLevel.INFO;
		}

		return parsedLevel;
	}

	/**
	 * Map nestjs-shared numeric LogLevel to @pawells/logger LogLevel
	 * @param level - Numeric LogLevel from nestjs-shared
	 * @returns String LogLevel for @pawells/logger
	 */
	private mapNestjsLogLevelToPawells(level: number): PawellsLogLevel {
		const mapping: Record<number, PawellsLogLevel> = {
			[LogLevel.DEBUG]: PawellsLogLevel.DEBUG,
			[LogLevel.INFO]: PawellsLogLevel.INFO,
			[LogLevel.WARN]: PawellsLogLevel.WARN,
			[LogLevel.ERROR]: PawellsLogLevel.ERROR,
			[LogLevel.FATAL]: PawellsLogLevel.FATAL,
			[LogLevel.SILENT]: PawellsLogLevel.SILENT,
		};
		return mapping[level] ?? PawellsLogLevel.INFO;
	}

	/**
	 * Check if a log level should be output
	 * @param level - Level to check
	 * @returns true if level should be logged
	 */
	private shouldLog(level: number): boolean {
		return level >= this.minLevel;
	}

	/**
	 * Sanitize metadata to remove sensitive information and handle circular references
	 * @param metadata - Metadata to sanitize
	 * @returns Sanitized metadata with circular references replaced by '[CIRCULAR_REF]'
	 */
	private sanitizeMetadata(metadata?: LogMetadata): LogMetadata | undefined {
		if (!metadata) return undefined;

		const sanitized: Record<string, any> = { ...metadata };
		const visited = new WeakSet();

		const sanitize = (obj: any, depth: number = 0): any => {
			if (depth >= MAX_SANITIZE_DEPTH) return '[DEPTH_EXCEEDED]';
			if (typeof obj !== 'object' || obj === null) return obj;

			if (visited.has(obj)) {
				return '[CIRCULAR_REF]';
			}
			visited.add(obj);

			const result: Record<string, any> = Array.isArray(obj) ? [] : {};
			for (const [key, value] of Object.entries(obj)) {
				const lowerKey = key.toLowerCase();
				const isExactMatch = this.sensitiveKeys.has(lowerKey);

				if (isExactMatch) {
					// Exact match: keep key, redact value
					result[key] = '[REDACTED]';
				} else {
					// Check if key contains any sensitive pattern
					let containsSensitivePattern = false;
					for (const sensitivePattern of this.sensitiveKeys) {
						if (lowerKey.includes(sensitivePattern)) {
							containsSensitivePattern = true;
							break;
						}
					}

					if (containsSensitivePattern) {
						// Contains pattern: redact the key name itself
						result['[REDACTED_KEY]'] = '[REDACTED]';
					} else {
						// Not sensitive: process normally
						result[key] = sanitize(value, depth + 1);
					}
				}
			}
			return result;
		};

		try {
			const stringified = JSON.stringify(sanitize(sanitized), CreateJsonCircularReplacer('[CIRCULAR_REF]'));
			return JSON.parse(stringified);
		} catch {
			// If JSON.stringify fails, return the sanitized object as-is
			return sanitize(sanitized);
		}
	}

	/**
	 * Extract OpenTelemetry trace context
	 * @returns Object with traceId and spanId if available
	 */
	private extractTraceContext(): { traceId?: string; spanId?: string } {
		try {
			const span = trace.getSpan(context.active());
			if (span) {
				const spanContext = span.spanContext();
				return {
					traceId: spanContext.traceId,
					spanId: spanContext.spanId,
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
	 * @param metadata - User-provided metadata
	 * @returns Combined metadata
	 */
	private buildMetadata(logContext: string, metadata?: LogMetadata): Record<string, unknown> {
		const { traceId, spanId } = this.extractTraceContext();
		const sanitized = this.sanitizeMetadata(metadata);

		const result: Record<string, unknown> = {
			context: logContext,
		};

		if (sanitized) {
			result.metadata = sanitized;
		}
		if (traceId) {
			result.traceId = traceId;
		}
		if (spanId) {
			result.spanId = spanId;
		}

		return result;
	}

	/**
	 * Log debug message
	 * @param message - Log message
	 * @param options - Optional context/metadata options
	 */
	public debug(message: string | Error, options: LogOptions): void;
	/**
	 * Log debug message
	 * @param message - Log message
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	public debug(message: string | Error, context?: string, metadata?: LogMetadata): void;
	/**
	 * Log debug message
	 * @param message - Log message
	 * @param metadata - Optional structured metadata
	 */
	public debug(message: string | Error, metadata?: LogMetadata): void;
	public debug(message: string | Error, contextOrMetadata?: string | LogMetadata | LogOptions, metadata?: LogMetadata): void {
		if (this.shouldLog(LogLevel.DEBUG)) {
			let ctx = this.context;
			let meta = metadata;

			// Handle options-object form
			if (contextOrMetadata !== undefined && typeof contextOrMetadata === 'object' && !Array.isArray(contextOrMetadata) && 'context' in contextOrMetadata) {
				const opts = contextOrMetadata as LogOptions;
				ctx = opts.context ?? this.context;
				meta = opts.metadata;
			} else if (typeof contextOrMetadata === 'string') {
				ctx = contextOrMetadata;
			} else if (typeof contextOrMetadata === 'object' && !('context' in contextOrMetadata)) {
				meta = contextOrMetadata as LogMetadata;
			}

			const msg = message instanceof Error ? message.message : message;
			const builtMetadata = this.buildMetadata(ctx, meta);

			void this.pawellsLogger.debug(msg, builtMetadata).catch((err: unknown) => {
				const fallbackMsg = `[AppLogger fallback] ${String(err)}\n`;
				try {
					process.stderr.write(fallbackMsg);
				} catch {
					// Ignore stderr write failures silently as final fallback
				}
			});
		}
	}

	/**
	 * Log info message
	 * @param message - Log message
	 * @param options - Optional context/metadata options
	 */
	public info(message: string | Error, options: LogOptions): void;
	/**
	 * Log info message
	 * @param message - Log message
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	public info(message: string | Error, context?: string, metadata?: LogMetadata): void;
	/**
	 * Log info message
	 * @param message - Log message
	 * @param metadata - Optional structured metadata
	 */
	public info(message: string | Error, metadata?: LogMetadata): void;
	public info(message: string | Error, contextOrMetadata?: string | LogMetadata | LogOptions, metadata?: LogMetadata): void {
		if (this.shouldLog(LogLevel.INFO)) {
			let ctx = this.context;
			let meta = metadata;

			// Handle options-object form
			if (contextOrMetadata !== undefined && typeof contextOrMetadata === 'object' && !Array.isArray(contextOrMetadata) && 'context' in contextOrMetadata) {
				const opts = contextOrMetadata as LogOptions;
				ctx = opts.context ?? this.context;
				meta = opts.metadata;
			} else if (typeof contextOrMetadata === 'string') {
				ctx = contextOrMetadata;
			} else if (typeof contextOrMetadata === 'object' && !('context' in contextOrMetadata)) {
				meta = contextOrMetadata as LogMetadata;
			}

			const msg = message instanceof Error ? message.message : message;
			const builtMetadata = this.buildMetadata(ctx, meta);

			void this.pawellsLogger.info(msg, builtMetadata).catch((err: unknown) => {
				const fallbackMsg = `[AppLogger fallback] ${String(err)}\n`;
				try {
					process.stderr.write(fallbackMsg);
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
	public warn(message: string | Error, options: LogOptions): void;
	/**
	 * Log warning message
	 * @param message - Log message
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	public warn(message: string | Error, context?: string, metadata?: LogMetadata): void;
	/**
	 * Log warning message
	 * @param message - Log message
	 * @param metadata - Optional structured metadata
	 */
	public warn(message: string | Error, metadata?: LogMetadata): void;
	public warn(message: string | Error, contextOrMetadata?: string | LogMetadata | LogOptions, metadata?: LogMetadata): void {
		if (this.shouldLog(LogLevel.WARN)) {
			let ctx = this.context;
			let meta = metadata;

			// Handle options-object form
			if (contextOrMetadata !== undefined && typeof contextOrMetadata === 'object' && !Array.isArray(contextOrMetadata) && 'context' in contextOrMetadata) {
				const opts = contextOrMetadata as LogOptions;
				ctx = opts.context ?? this.context;
				meta = opts.metadata;
			} else if (typeof contextOrMetadata === 'string') {
				ctx = contextOrMetadata;
			} else if (typeof contextOrMetadata === 'object' && !('context' in contextOrMetadata)) {
				meta = contextOrMetadata as LogMetadata;
			}

			const msg = message instanceof Error ? message.message : message;
			const builtMetadata = this.buildMetadata(ctx, meta);

			void this.pawellsLogger.warn(msg, builtMetadata).catch((err: unknown) => {
				const fallbackMsg = `[AppLogger fallback] ${String(err)}\n`;
				try {
					process.stderr.write(fallbackMsg);
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
	public error(message: string | Error, options: LogOptions): void;
	/**
	 * Log error message
	 * @param message - Log message or Error object
	 * @param trace - Optional stack trace
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	public error(message: string | Error, trace?: string, context?: string, metadata?: LogMetadata): void;
	/**
	 * Log error message
	 * @param message - Log message or Error object
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	public error(message: string | Error, context?: string, metadata?: LogMetadata): void;
	public error(message: string | Error, traceOrContext?: string | LogOptions, contextOrMetadata?: string | LogMetadata, metadata?: LogMetadata): void {
		if (this.shouldLog(LogLevel.ERROR)) {
			let ctx = this.context;
			let meta = metadata;
			let trace: string | undefined;

			// Handle options-object form
			if (traceOrContext !== undefined && typeof traceOrContext === 'object' && !Array.isArray(traceOrContext) && 'context' in traceOrContext) {
				const opts = traceOrContext as LogOptions;
				ctx = opts.context ?? this.context;
				meta = opts.metadata;
				trace = opts.trace;
			} else if (typeof traceOrContext === 'string' && typeof contextOrMetadata === 'string') {
				// error(message, trace, context, metadata?)
				trace = traceOrContext;
				ctx = contextOrMetadata;
			} else if (typeof traceOrContext === 'string' && typeof contextOrMetadata === 'object') {
				// error(message, trace, metadata)
				trace = traceOrContext;
				meta = contextOrMetadata;
			} else if (typeof traceOrContext === 'string') {
				// error(message, context)
				ctx = traceOrContext;
			} else if (typeof contextOrMetadata === 'object') {
				// error(message, metadata)
				meta = contextOrMetadata;
			}

			const msg = message instanceof Error ? message.message : message;
			const metaWithTrace = trace ? { ...meta, stack: trace } : meta;
			const builtMetadata = this.buildMetadata(ctx, metaWithTrace);

			void this.pawellsLogger.error(msg, builtMetadata).catch((err: unknown) => {
				const fallbackMsg = `[AppLogger fallback] ${String(err)}\n`;
				try {
					process.stderr.write(fallbackMsg);
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
	public fatal(message: string | Error, options: LogOptions): void;
	/**
	 * Log fatal message
	 * @param message - Log message or Error object
	 * @param trace - Optional stack trace
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	public fatal(message: string | Error, trace?: string, context?: string, metadata?: LogMetadata): void;
	/**
	 * Log fatal message
	 * @param message - Log message or Error object
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	public fatal(message: string | Error, context?: string, metadata?: LogMetadata): void;
	public fatal(message: string | Error, traceOrContext?: string | LogOptions, contextOrMetadata?: string | LogMetadata, metadata?: LogMetadata): void {
		if (this.shouldLog(LogLevel.FATAL)) {
			let ctx = this.context;
			let meta = metadata;
			let trace: string | undefined;

			// Handle options-object form
			if (traceOrContext !== undefined && typeof traceOrContext === 'object' && !Array.isArray(traceOrContext) && 'context' in traceOrContext) {
				const opts = traceOrContext as LogOptions;
				ctx = opts.context ?? this.context;
				meta = opts.metadata;
				trace = opts.trace;
			} else if (typeof traceOrContext === 'string' && typeof contextOrMetadata === 'string') {
				trace = traceOrContext;
				ctx = contextOrMetadata;
			} else if (typeof traceOrContext === 'string' && typeof contextOrMetadata === 'object') {
				trace = traceOrContext;
				meta = contextOrMetadata;
			} else if (typeof traceOrContext === 'string') {
				ctx = traceOrContext;
			} else if (typeof contextOrMetadata === 'object') {
				meta = contextOrMetadata;
			}

			const msg = message instanceof Error ? message.message : message;
			const metaWithTrace = trace ? { ...meta, stack: trace } : meta;
			const builtMetadata = this.buildMetadata(ctx, metaWithTrace);

			void this.pawellsLogger.fatal(msg, builtMetadata).catch((err: unknown) => {
				const fallbackMsg = `[AppLogger fallback] ${String(err)}\n`;
				try {
					process.stderr.write(fallbackMsg);
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
	public createContextualLogger(context: string): AppLogger {
		return new AppLogger(this.configService, context);
	}
}
