import { ILogMetadata } from './log-entry.interface.js';

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
	debug(message: string | Error, context?: string, metadata?: ILogMetadata): void;
	debug(message: string | Error, metadata?: ILogMetadata): void;

	/**
	 * Log info message
	 * @param message - Log message
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	info(message: string | Error, context?: string, metadata?: ILogMetadata): void;
	info(message: string | Error, metadata?: ILogMetadata): void;

	/**
	 * Log warning message
	 * @param message - Log message
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	warn(message: string | Error, context?: string, metadata?: ILogMetadata): void;
	warn(message: string | Error, metadata?: ILogMetadata): void;

	/**
	 * Log error message
	 * @param message - Log message or Error object
	 * @param trace - Optional stack trace
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	error(message: string | Error, trace?: string, context?: string, metadata?: ILogMetadata): void;
	error(message: string | Error, context?: string, metadata?: ILogMetadata): void;

	/**
	 * Log fatal message
	 * @param message - Log message or Error object
	 * @param trace - Optional stack trace
	 * @param context - Optional context override
	 * @param metadata - Optional structured metadata
	 */
	fatal(message: string | Error, trace?: string, context?: string, metadata?: ILogMetadata): void;
	fatal(message: string | Error, context?: string, metadata?: ILogMetadata): void;
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
