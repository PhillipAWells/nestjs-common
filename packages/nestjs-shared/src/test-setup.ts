import { vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';

/**
 * Global test setup: suppress all console and NestJS Logger output.
 *
 * Two output paths are silenced:
 * 1. console.* — used by AppLogger → Logger → ConsoleTransport
 * 2. Logger (NestJS) — uses process.stdout.write directly, bypassing console.*
 *    Affected sources: ApplySecurityMiddleware, BaseMetricsCollector, etc.
 */
beforeEach(() => {
	// Suppress console.* (covers Logger / ConsoleTransport)
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
