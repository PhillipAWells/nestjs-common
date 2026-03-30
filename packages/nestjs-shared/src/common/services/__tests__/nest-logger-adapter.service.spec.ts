import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppLogger } from '../logger.service.js';
import { NestLoggerAdapter } from '../nest-logger-adapter.service.js';

describe('NestLoggerAdapter', () => {
	let adapter: NestLoggerAdapter;
	let mockLogger: AppLogger;

	beforeEach(() => {
		mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			fatal: vi.fn(),
		} as any;
	});

	describe('constructor', () => {
		it('should create own AppLogger when none provided', () => {
			adapter = new NestLoggerAdapter();
			expect(adapter).toBeDefined();
			expect((adapter as any).Logger).toBeInstanceOf(AppLogger);
		});

		it('should use provided AppLogger instance', () => {
			adapter = new NestLoggerAdapter(mockLogger);
			expect((adapter as any).Logger).toBe(mockLogger);
		});
	});

	describe('log()', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should call appLogger.info() with message and context', () => {
			adapter.log('Test message', 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('Test message', 'TestContext');
		});

		it('should call appLogger.info() with message and undefined context when no params', () => {
			adapter.log('Test message');
			expect(mockLogger.info).toHaveBeenCalledWith('Test message', undefined);
		});

		it('should call appLogger.info() with message and undefined context when only non-string param', () => {
			adapter.log('Test message', 123);
			expect(mockLogger.info).toHaveBeenCalledWith('Test message', undefined);
		});
	});

	describe('error()', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should call appLogger.error() with stack and context', () => {
			const stack = 'Error: test\n  at line 1';
			adapter.error('Test error', stack, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Test error', 'TestContext', { stack });
		});

		it('should call appLogger.error() with stack only (no context)', () => {
			const stack = 'Error: test\n  at line 1';
			adapter.error('Test error', stack);
			expect(mockLogger.error).toHaveBeenCalledWith('Test error', undefined, { stack });
		});

		it('should call appLogger.error() with context only (no stack)', () => {
			adapter.error('Test error', 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Test error', 'TestContext');
		});

		it('should call appLogger.error() with no params', () => {
			adapter.error('Test error');
			expect(mockLogger.error).toHaveBeenCalledWith('Test error', undefined);
		});

		it('should detect stack by multiline string', () => {
			const stack = 'at function\n  at line 1\n  at line 2';
			adapter.error('Test error', stack, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Test error', 'TestContext', { stack });
		});

		it('should detect stack by Error: prefix', () => {
			const stack = 'Error: Something went wrong';
			adapter.error('Test error', stack, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Test error', 'TestContext', { stack });
		});
	});

	describe('warn()', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should call appLogger.warn() with message and context', () => {
			adapter.warn('Test warning', 'TestContext');
			expect(mockLogger.warn).toHaveBeenCalledWith('Test warning', 'TestContext');
		});

		it('should call appLogger.warn() with message and undefined context', () => {
			adapter.warn('Test warning');
			expect(mockLogger.warn).toHaveBeenCalledWith('Test warning', undefined);
		});
	});

	describe('debug()', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should call appLogger.debug() with message and context', () => {
			adapter.debug('Test debug', 'TestContext');
			expect(mockLogger.debug).toHaveBeenCalledWith('Test debug', 'TestContext');
		});

		it('should call appLogger.debug() with message and undefined context', () => {
			adapter.debug('Test debug');
			expect(mockLogger.debug).toHaveBeenCalledWith('Test debug', undefined);
		});
	});

	describe('verbose()', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should call appLogger.debug() (maps to debug) with message and context', () => {
			adapter.verbose('Test verbose', 'TestContext');
			expect(mockLogger.debug).toHaveBeenCalledWith('Test verbose', 'TestContext');
		});

		it('should call appLogger.debug() with message and undefined context', () => {
			adapter.verbose('Test verbose');
			expect(mockLogger.debug).toHaveBeenCalledWith('Test verbose', undefined);
		});
	});

	describe('fatal()', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should call appLogger.fatal() with message and context', () => {
			adapter.fatal('Test fatal', 'TestContext');
			expect(mockLogger.fatal).toHaveBeenCalledWith('Test fatal', 'TestContext');
		});

		it('should call appLogger.fatal() with message and undefined context', () => {
			adapter.fatal('Test fatal');
			expect(mockLogger.fatal).toHaveBeenCalledWith('Test fatal', undefined);
		});
	});

	describe('message formatting', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should extract message from Error object', () => {
			const error = new Error('Test error message');
			adapter.log(error, 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('Test error message', 'TestContext');
		});

		it('should coerce non-string message to string', () => {
			adapter.log({ key: 'value' }, 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('[object Object]', 'TestContext');
		});

		it('should handle number message', () => {
			adapter.log(123, 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('123', 'TestContext');
		});

		it('should handle null message', () => {
			adapter.log(null, 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('null', 'TestContext');
		});

		it('should handle undefined message', () => {
			adapter.log(undefined, 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('undefined', 'TestContext');
		});
	});

	describe('stack detection', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should detect multiline stack traces', () => {
			const multilineStack = 'at func1\n  at func2\n  at func3';
			adapter.error('Error', multilineStack, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Error', 'TestContext', { stack: multilineStack });
		});

		it('should detect stack starting with Error:', () => {
			const errorStack = 'Error: Something failed';
			adapter.error('Error', errorStack, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Error', 'TestContext', { stack: errorStack });
		});

		it('should not treat single-line non-Error string as stack', () => {
			adapter.error('Error message', 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Error message', 'TestContext');
		});

		it('should handle stack with complex traceback', () => {
			const stack = `Error: Request failed
  at Object.<anonymous> (/app/file.js:10:5)
  at Module._compile (internal/modules/cjs/loader.js:1144:1)
  at Object.Module._load (internal/modules/cjs/loader.js:970:1)`;
			adapter.error('Error', stack, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Error', 'TestContext', { stack });
		});
	});

	describe('edge cases', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should handle empty string message', () => {
			adapter.log('', 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('', 'TestContext');
		});

		it('should handle multiple optional params and extract last string as context', () => {
			adapter.log('Message', 123, { key: 'value' }, 'LastContext');
			expect(mockLogger.info).toHaveBeenCalledWith('Message', 'LastContext');
		});

		it('should handle error with multiple params', () => {
			const stack = 'Error: test\n  at line 1';
			adapter.error('Error', stack, 123, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Error', 'TestContext', { stack });
		});

		it('should handle boolean param (non-string, treated as context-less)', () => {
			adapter.warn('Warning', true);
			expect(mockLogger.warn).toHaveBeenCalledWith('Warning', undefined);
		});

		it('should handle object param in context position', () => {
			adapter.debug('Debug', { data: 'value' });
			expect(mockLogger.debug).toHaveBeenCalledWith('Debug', undefined);
		});
	});

	describe('integration with real AppLogger', () => {
		it('should create adapter with real AppLogger', () => {
			adapter = new NestLoggerAdapter();
			expect((adapter as any).Logger).toBeInstanceOf(AppLogger);
		});

		it('should not throw when logging with real AppLogger', () => {
			adapter = new NestLoggerAdapter();
			expect(() => {
				adapter.log('Test message', 'TestContext');
			}).not.toThrow();
		});
	});

	describe('LoggerService interface compliance', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should implement all LoggerService methods', () => {
			expect(typeof adapter.log).toBe('function');
			expect(typeof adapter.error).toBe('function');
			expect(typeof adapter.warn).toBe('function');
			expect(typeof adapter.debug).toBe('function');
			expect(typeof adapter.verbose).toBe('function');
			expect(typeof adapter.fatal).toBe('function');
		});

		it('should have correct method signatures', () => {
			const logSignature = adapter.log.toString();
			const errorSignature = adapter.error.toString();
			expect(logSignature).toContain('message');
			expect(errorSignature).toContain('message');
		});
	});

	describe('context extraction', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should extract context from last string param', () => {
			adapter.log('Message', 'ContextA', 'ContextB');
			expect(mockLogger.info).toHaveBeenCalledWith('Message', 'ContextB');
		});

		it('should extract context from only string param', () => {
			adapter.log('Message', 'SingleContext');
			expect(mockLogger.info).toHaveBeenCalledWith('Message', 'SingleContext');
		});

		it('should return undefined when no string params', () => {
			adapter.log('Message', 123, true, {});
			expect(mockLogger.info).toHaveBeenCalledWith('Message', undefined);
		});

		it('should ignore non-string contexts in error params', () => {
			const stack = 'Error: test\n  at line 1';
			adapter.error('Error', stack, 123);
			expect(mockLogger.error).toHaveBeenCalledWith('Error', undefined, { stack });
		});
	});
});
