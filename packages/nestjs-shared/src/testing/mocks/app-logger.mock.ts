/**
 * Mock App Logger for Testing
 *
 * Provides a no-op IContextualLogger implementation for unit tests.
 * All logging methods are silent no-ops. Consumers that need spy behaviour
 * should wrap methods with vi.fn() / jest.fn() after obtaining the instance.
 */
import { Injectable } from '@nestjs/common';
import type { ILogMetadata } from '../../common/interfaces/log-entry.interface.js';
import type { IContextualLogger } from '../../common/interfaces/logger.interface.js';

/**
 * No-op contextual logger for testing — implements IContextualLogger with silent methods.
 */
@Injectable()
export class MockAppLogger implements IContextualLogger {
	public Debug(
		_message: string | Error,
		_contextOrMetadata?: string | ILogMetadata,
		_metadata?: ILogMetadata,
	): void {
		// No-op
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public debug(message: string | Error, contextOrMetadata?: string | ILogMetadata, metadata?: ILogMetadata): void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public debug(
		_message: string | Error,
		_contextOrMetadata?: string | ILogMetadata,
		_metadata?: ILogMetadata,
	): void {
		// No-op
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public info(
		_message: string | Error,
		_contextOrMetadata?: string | ILogMetadata,
		_metadata?: ILogMetadata,
	): void {
		// No-op
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public warn(
		_message: string | Error,
		_contextOrMetadata?: string | ILogMetadata,
		_metadata?: ILogMetadata,
	): void {
		// No-op
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public error(
		_message: string | Error,
		_traceOrContext?: string,
		_contextOrMetadata?: string | ILogMetadata,
		_metadata?: ILogMetadata,
	): void {
		// No-op
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public fatal(
		_message: string | Error,
		_traceOrContext?: string,
		_contextOrMetadata?: string | ILogMetadata,
		_metadata?: ILogMetadata,
	): void {
		// No-op
	}

	public Info(
		_message: string | Error,
		_contextOrMetadata?: string | ILogMetadata,
		_metadata?: ILogMetadata,
	): void {
		// No-op
	}

	public Warn(
		_message: string | Error,
		_contextOrMetadata?: string | ILogMetadata,
		_metadata?: ILogMetadata,
	): void {
		// No-op
	}

	public Error(
		_message: string | Error,
		_traceOrContext?: string,
		_contextOrMetadata?: string | ILogMetadata,
		_metadata?: ILogMetadata,
	): void {
		// No-op
	}

	public CreateContextualLogger(_context: string): IContextualLogger {
		return this;
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public createContextualLogger(_context: string): IContextualLogger {
		return this;
	}
}
