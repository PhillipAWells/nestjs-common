import { Logger } from '@nestjs/common';

/**
 * Simple wrapper around NestJS Logger that adds support for the `.info()` method
 * (for backward compatibility with tests and existing usage patterns).
 * Maps `.info()` to `.verbose()` which is the closest equivalent in NestJS Logger.
 */
export class NatsLogger extends Logger {
	public Info(message: string, context?: string): void {
		(this as any).verbose(message, context);
	}

	public Error(message: string, stack?: string, context?: string): void {
		NatsLogger.error(message, stack, context);
	}

	public Warn(message: string, context?: string): void {
		NatsLogger.warn(message, context);
	}

	public Debug(message: string, context?: string): void {
		NatsLogger.debug(message, context);
	}
}
