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
			Debug: vi.fn(),
			Info: vi.fn(),
			Warn: vi.fn(),
			Error: vi.fn(),
			Fatal: vi.fn(),
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
			adapter.Log('Test message', 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('Test message', 'TestContext');
		});

		it('should call appLogger.info() with message and undefined context when no params', () => {
			adapter.Log('Test message');
			expect(mockLogger.info).toHaveBeenCalledWith('Test message', undefined);
		});

		it('should call appLogger.info() with message and undefined context when only non-string param', () => {
			adapter.Log('Test message', 123);
			expect(mockLogger.info).toHaveBeenCalledWith('Test message', undefined);
		});
	});

	describe('error()', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should call appLogger.error() with stack and context', () => {
			const stack = 'Error: test\n  at line 1';
			adapter.Error('Test error', stack, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Test error', 'TestContext', { stack });
		});

		it('should call appLogger.error() with stack only (no context)', () => {
			const stack = 'Error: test\n  at line 1';
			adapter.Error('Test error', stack);
			expect(mockLogger.error).toHaveBeenCalledWith('Test error', undefined, { stack });
		});

		it('should call appLogger.error() with context only (no stack)', () => {
			adapter.Error('Test error', 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Test error', 'TestContext');
		});

		it('should call appLogger.error() with no params', () => {
			adapter.Error('Test error');
			expect(mockLogger.error).toHaveBeenCalledWith('Test error', undefined);
		});

		it('should detect stack by multiline string', () => {
			const stack = 'at function\n  at line 1\n  at line 2';
			adapter.Error('Test error', stack, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Test error', 'TestContext', { stack });
		});

		it('should detect stack by Error: prefix', () => {
			const stack = 'Error: Something went wrong';
			adapter.Error('Test error', stack, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Test error', 'TestContext', { stack });
		});
	});

	describe('warn()', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should call appLogger.warn() with message and context', () => {
			adapter.Warn('Test warning', 'TestContext');
			expect(mockLogger.warn).toHaveBeenCalledWith('Test warning', 'TestContext');
		});

		it('should call appLogger.warn() with message and undefined context', () => {
			adapter.Warn('Test warning');
			expect(mockLogger.warn).toHaveBeenCalledWith('Test warning', undefined);
		});
	});

	describe('debug()', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should call appLogger.debug() with message and context', () => {
			adapter.Debug('Test debug', 'TestContext');
			expect(mockLogger.debug).toHaveBeenCalledWith('Test debug', 'TestContext');
		});

		it('should call appLogger.debug() with message and undefined context', () => {
			adapter.Debug('Test debug');
			expect(mockLogger.debug).toHaveBeenCalledWith('Test debug', undefined);
		});
	});

	describe('verbose()', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should call appLogger.debug() (maps to debug) with message and context', () => {
			adapter.Verbose('Test verbose', 'TestContext');
			expect(mockLogger.debug).toHaveBeenCalledWith('Test verbose', 'TestContext');
		});

		it('should call appLogger.debug() with message and undefined context', () => {
			adapter.Verbose('Test verbose');
			expect(mockLogger.debug).toHaveBeenCalledWith('Test verbose', undefined);
		});
	});

	describe('fatal()', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should call appLogger.fatal() with message and context', () => {
			adapter.Fatal('Test fatal', 'TestContext');
			expect(mockLogger.fatal).toHaveBeenCalledWith('Test fatal', 'TestContext');
		});

		it('should call appLogger.fatal() with message and undefined context', () => {
			adapter.Fatal('Test fatal');
			expect(mockLogger.fatal).toHaveBeenCalledWith('Test fatal', undefined);
		});
	});

	describe('message formatting', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should extract message from Error object', () => {
			const error = new Error('Test error message');
			adapter.Log(error, 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('Test error message', 'TestContext');
		});

		it('should coerce non-string message to string', () => {
			adapter.Log({ key: 'value' }, 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('[object Object]', 'TestContext');
		});

		it('should handle number message', () => {
			adapter.Log(123, 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('123', 'TestContext');
		});

		it('should handle null message', () => {
			adapter.Log(null, 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('null', 'TestContext');
		});

		it('should handle undefined message', () => {
			adapter.Log(undefined, 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('undefined', 'TestContext');
		});
	});

	describe('stack detection', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should detect multiline stack traces', () => {
			const multilineStack = 'at func1\n  at func2\n  at func3';
			adapter.Error('Error', multilineStack, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Error', 'TestContext', { stack: multilineStack });
		});

		it('should detect stack starting with Error:', () => {
			const errorStack = 'Error: Something failed';
			adapter.Error('Error', errorStack, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Error', 'TestContext', { stack: errorStack });
		});

		it('should not treat single-line non-Error string as stack', () => {
			adapter.Error('Error message', 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Error message', 'TestContext');
		});

		it('should handle stack with complex traceback', () => {
			const stack = `Error: Request failed
  at Object.<anonymous> (/app/file.js:10:5)
  at Module._compile (internal/modules/cjs/loader.js:1144:1)
  at Object.Module._load (internal/modules/cjs/loader.js:970:1)`;
			adapter.Error('Error', stack, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Error', 'TestContext', { stack });
		});
	});

	describe('edge cases', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should handle empty string message', () => {
			adapter.Log('', 'TestContext');
			expect(mockLogger.info).toHaveBeenCalledWith('', 'TestContext');
		});

		it('should handle multiple optional params and extract last string as context', () => {
			adapter.Log('Message', 123, { key: 'value' }, 'LastContext');
			expect(mockLogger.info).toHaveBeenCalledWith('Message', 'LastContext');
		});

		it('should handle error with multiple params', () => {
			const stack = 'Error: test\n  at line 1';
			adapter.Error('Error', stack, 123, 'TestContext');
			expect(mockLogger.error).toHaveBeenCalledWith('Error', 'TestContext', { stack });
		});

		it('should handle boolean param (non-string, treated as context-less)', () => {
			adapter.Warn('Warning', true);
			expect(mockLogger.warn).toHaveBeenCalledWith('Warning', undefined);
		});

		it('should handle object param in context position', () => {
			adapter.Debug('Debug', { data: 'value' });
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
				adapter.Log('Test message', 'TestContext');
			}).not.toThrow();
		});
	});

	describe('LoggerService interface compliance', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should implement all LoggerService methods', () => {
			expect(typeof (adapter as any).Log).toBe('function');
			expect(typeof (adapter as any).Error).toBe('function');
			expect(typeof (adapter as any).Warn).toBe('function');
			expect(typeof (adapter as any).Debug).toBe('function');
			expect(typeof (adapter as any).Verbose).toBe('function');
			expect(typeof (adapter as any).Fatal).toBe('function');
		});

		it('should have correct method signatures', () => {
			const logSignature = (adapter as any).Log.toString();
			const errorSignature = (adapter as any).Error.toString();
			expect(logSignature).toContain('message');
			expect(errorSignature).toContain('message');
		});
	});

	describe('context extraction', () => {
		beforeEach(() => {
			adapter = new NestLoggerAdapter(mockLogger);
		});

		it('should extract context from last string param', () => {
			adapter.Log('Message', 'ContextA', 'ContextB');
			expect(mockLogger.info).toHaveBeenCalledWith('Message', 'ContextB');
		});

		it('should extract context from only string param', () => {
			adapter.Log('Message', 'SingleContext');
			expect(mockLogger.info).toHaveBeenCalledWith('Message', 'SingleContext');
		});

		it('should return undefined when no string params', () => {
			adapter.Log('Message', 123, true, {});
			expect(mockLogger.info).toHaveBeenCalledWith('Message', undefined);
		});

		it('should ignore non-string contexts in error params', () => {
			const stack = 'Error: test\n  at line 1';
			adapter.Error('Error', stack, 123);
			expect(mockLogger.error).toHaveBeenCalledWith('Error', undefined, { stack });
		});
	});
});
