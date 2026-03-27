import { vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';

/**
 * Global test setup: suppress all console and NestJS Logger output.
 *
 * Three output paths are silenced:
 * 1. process.stdout/stderr — used by AppLogger → @pawells/logger → ConsoleTransport (1.2.2+
 *    writes directly to process.stdout.write, no longer routes through console.log)
 * 2. console.* — used by some NestJS internals and legacy paths
 * 3. Logger (NestJS) — instance/static methods that write [Nest] lines to stdout
 */
beforeEach(() => {
	// Suppress @pawells/logger ConsoleTransport (1.2.2+: writes to process.stdout.write directly)
	vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
	vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

	// Suppress console.* for any remaining console-based output paths
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'info').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'debug').mockImplementation(() => {});

	// Suppress NestJS Logger instance methods (writes [Nest] ... lines to stdout)
	vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
	vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
	vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
	vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
	vi.spyOn(Logger.prototype, 'verbose').mockImplementation(() => {});
	vi.spyOn(Logger.prototype, 'fatal').mockImplementation(() => {});

	// Suppress NestJS Logger static methods
	vi.spyOn(Logger, 'log').mockImplementation(() => {});
	vi.spyOn(Logger, 'warn').mockImplementation(() => {});
	vi.spyOn(Logger, 'error').mockImplementation(() => {});
	vi.spyOn(Logger, 'debug').mockImplementation(() => {});
	vi.spyOn(Logger, 'verbose').mockImplementation(() => {});
	vi.spyOn(Logger, 'fatal').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});
