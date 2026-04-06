/**
 * Structured log entry emitted by {@link AppLogger}.
 * Fields are populated automatically; callers provide `message` and optional `metadata`.
 */
export interface ILogEntry {
	/** ISO 8601 timestamp of the log event. */
	timestamp: string;
	/** Log level string: debug, info, warn, error, fatal, or silent. */
	level: string;
	/** Name of the service producing the log (from `SERVICE_NAME` env var). */
	service: string;
	/** Logger context string, e.g. `"AuthService"` or `"AppLogger"`. */
	context: string;
	/** Human-readable log message. */
	message: string;
	/** Caller-supplied structured metadata, sanitized before output. */
	metadata?: Record<string, any>;
	/** OpenTelemetry trace ID when a span is active. */
	traceId?: string;
	/** OpenTelemetry span ID when a span is active. */
	spanId?: string;
	/** Runtime environment (development, production, etc.). */
	environment: string;
}

/**
 * Arbitrary structured metadata attached to a log entry.
 * Sensitive field names (password, token, secret, etc.) are automatically redacted.
 */
export interface ILogMetadata {
	[key: string]: any;
}
 
const DEBUG_LEVEL = 0;
const INFO_LEVEL = 1;
const WARN_LEVEL = 2;
const ERROR_LEVEL = 3;
const FATAL_LEVEL = 4;
const SILENT_LEVEL = 5;

/** Numeric log level constants used for threshold comparisons inside {@link AppLogger}. */
export enum LogLevel {
	/** Verbose diagnostic output, typically for development. */
	DEBUG = DEBUG_LEVEL,
	/** General informational messages about normal operation. */
	INFO = INFO_LEVEL,
	/** Non-fatal conditions that warrant attention. */
	WARN = WARN_LEVEL,
	/** Failures that affect the current operation but not the process. */
	ERROR = ERROR_LEVEL,
	/** Critical failures that typically require immediate action or process termination. */
	FATAL = FATAL_LEVEL,
	/** Suppresses all log output. */
	SILENT = SILENT_LEVEL,
}

/** Maps each {@link LogLevel} numeric value to its lowercase string name. */
export const LOG_LEVEL_STRINGS: Record<LogLevel, string> = {
	[LogLevel.DEBUG]: 'debug',
	[LogLevel.INFO]: 'info',
	[LogLevel.WARN]: 'warn',
	[LogLevel.ERROR]: 'error',
	[LogLevel.FATAL]: 'fatal',
	[LogLevel.SILENT]: 'silent',
};

/** Maps lowercase level name strings (e.g. `"info"`) to their {@link LogLevel} numeric value. */
export const LOG_LEVEL_FROM_STRING: Record<string, LogLevel> = {
	debug: LogLevel.DEBUG,
	info: LogLevel.INFO,
	warn: LogLevel.WARN,
	error: LogLevel.ERROR,
	fatal: LogLevel.FATAL,
	silent: LogLevel.SILENT,
};
