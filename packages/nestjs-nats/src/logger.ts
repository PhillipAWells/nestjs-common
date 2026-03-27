import { Logger } from '@nestjs/common';

/**
 * Simple wrapper around NestJS Logger that adds support for the `.info()` method
 * (for backward compatibility with tests and existing usage patterns).
 * Maps `.info()` to `.verbose()` which is the closest equivalent in NestJS Logger.
 */
export class NatsLogger extends Logger {
	public info(message: string, context?: string): void {
		this.verbose(message, context);
	}
}
