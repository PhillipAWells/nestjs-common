export interface LogEntry {
	timestamp: string;        // ISO 8601 format
	level: string;            // Log level: debug, info, warn, error, fatal
	service: string;          // Service name
	context: string;          // Logger context (e.g., "AuthService")
	message: string;          // Human-readable message
	metadata?: Record<string, any>; // Structured metadata
	traceId?: string;         // OpenTelemetry trace ID
	spanId?: string;          // OpenTelemetry span ID
	environment: string;      // Environment (dev, staging, prod)
}

export interface LogMetadata {
	[key: string]: any;
}
 
const DEBUG_LEVEL = 0;
const INFO_LEVEL = 1;
const WARN_LEVEL = 2;
const ERROR_LEVEL = 3;
const FATAL_LEVEL = 4;
const SILENT_LEVEL = 5;

export enum LogLevel {
	DEBUG = DEBUG_LEVEL,
	INFO = INFO_LEVEL,
	WARN = WARN_LEVEL,
	ERROR = ERROR_LEVEL,
	FATAL = FATAL_LEVEL,
	/** Suppresses all log output. */
	SILENT = SILENT_LEVEL,
}

export const LOG_LEVEL_STRINGS: Record<LogLevel, string> = {
	[LogLevel.DEBUG]: 'debug',
	[LogLevel.INFO]: 'info',
	[LogLevel.WARN]: 'warn',
	[LogLevel.ERROR]: 'error',
	[LogLevel.FATAL]: 'fatal',
	[LogLevel.SILENT]: 'silent',
};

export const LOG_LEVEL_FROM_STRING: Record<string, LogLevel> = {
	debug: LogLevel.DEBUG,
	info: LogLevel.INFO,
	warn: LogLevel.WARN,
	error: LogLevel.ERROR,
	fatal: LogLevel.FATAL,
	silent: LogLevel.SILENT,
};
