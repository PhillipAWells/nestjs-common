import { LogMetadata } from './log-entry.interface.js';

/**
 * Basic logging interface following Interface Segregation Principle
 * Provides essential logging methods without contextual logger creation
 */
export interface ILogger {
	/**
	 * Log debug message
	 * @param message - Log message
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	debug(message: string | Error, context?: string, metadata?: LogMetadata): void;
	debug(message: string | Error, metadata?: LogMetadata): void;

	/**
	 * Log info message
	 * @param message - Log message
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	info(message: string | Error, context?: string, metadata?: LogMetadata): void;
	info(message: string | Error, metadata?: LogMetadata): void;

	/**
	 * Log warning message
	 * @param message - Log message
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	warn(message: string | Error, context?: string, metadata?: LogMetadata): void;
	warn(message: string | Error, metadata?: LogMetadata): void;

	/**
	 * Log error message
	 * @param message - Log message or Error object
	 * @param trace - Optional stack trace
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	error(message: string | Error, trace?: string, context?: string, metadata?: LogMetadata): void;
	error(message: string | Error, context?: string, metadata?: LogMetadata): void;

	/**
	 * Log fatal message
	 * @param message - Log message or Error object
	 * @param trace - Optional stack trace
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	fatal(message: string | Error, trace?: string, context?: string, metadata?: LogMetadata): void;
	fatal(message: string | Error, context?: string, metadata?: LogMetadata): void;
}

/**
 * Contextual logging interface extending basic logging
 * Adds capability to create contextual logger instances
 */
export interface IContextualLogger extends ILogger {
	/**
	 * Create a contextual logger instance
	 * @param context - Context string
	 * @returns New logger instance with context
	 */
	createContextualLogger(context: string): IContextualLogger;
}
