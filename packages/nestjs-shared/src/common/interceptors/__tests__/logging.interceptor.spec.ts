import { ExecutionContext, CallHandler } from '@nestjs/common';
import { LoggingInterceptor } from '../logging.interceptor.js';
import { AppLogger } from '../../services/logger.service.js';
import { of } from 'rxjs';

describe('LoggingInterceptor', () => {
	let interceptor: LoggingInterceptor;
	let mockLogger: any;

	beforeEach(() => {
		// Manual mock using plain JS object (Phase 2 pattern)
		const logCalls: any[] = [];
		mockLogger = {
			debug(...args: any[]) {
				logCalls.push({ level: 'debug', args });
			},
			info(...args: any[]) {
				logCalls.push({ level: 'info', args });
			},
			warn(...args: any[]) {
				logCalls.push({ level: 'warn', args });
			},
			error(...args: any[]) {
				logCalls.push({ level: 'error', args });
			},
			log(...args: any[]) {
				logCalls.push({ level: 'log', args });
			},
			_calls: logCalls,
		};

		const mockModuleRef = {
			get: (token: any) => {
				if (token === AppLogger) return mockLogger;
				throw new Error('not found');
			},
		} as any;
		interceptor = new LoggingInterceptor(mockModuleRef);
	});

	it('should be defined', () => {
		expect(interceptor).toBeDefined();
		expect(interceptor.intercept).toBeDefined();
	});

	describe('Request/Response Logging', () => {
		it('should log incoming request with method and URL', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						url: '/api/users',
						method: 'GET',
						ip: '192.168.1.1',
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ data: 'users' }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const infoCall = mockLogger._calls.find((c: any) => c.level === 'info' && c.args[0].includes('Incoming'));
					expect(infoCall).toBeDefined();
					expect(infoCall.args[1]).toBe('LoggingInterceptor');
					resolve();
				});
			});
		});

		it('should log completed response with status code and duration', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						url: '/api/users',
						method: 'POST',
						ip: '127.0.0.1',
					}),
					getResponse: () => ({ statusCode: 201 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ id: 123 }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const completedCall = mockLogger._calls.find(
						(c: any) => c.level === 'info' && c.args[0].includes('Request completed'),
					);
					expect(completedCall).toBeDefined();
					expect(completedCall.args[0]).toContain('201');
					expect(completedCall.args[0]).toMatch(/\d+ms/);
					resolve();
				});
			});
		});

		it('should measure request duration and log timing', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						url: '/api/slow-endpoint',
						method: 'GET',
						ip: '127.0.0.1',
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ data: 'slow response' }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const completedCall = mockLogger._calls.find(
						(c: any) => c.level === 'info' && c.args[0].includes('Request completed'),
					);
					expect(completedCall.args[0]).toMatch(/\d+ms/);
					resolve();
				});
			});
		});

		it('should handle health/metrics endpoints at debug level', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						url: '/health',
						method: 'GET',
						ip: '127.0.0.1',
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ status: 'healthy' }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					// Health endpoint should use debug level to reduce noise
					const debugCalls = mockLogger._calls.filter((c: any) => c.level === 'debug');
					expect(debugCalls.length).toBeGreaterThan(0);
					const incomingDebugCall = debugCalls.find((c: any) => c.args[0].includes('Incoming'));
					expect(incomingDebugCall).toBeDefined();
					resolve();
				});
			});
		});
	});

	describe('Non-HTTP Contexts', () => {
		it('should skip logging for RPC contexts', () => {
			mockLogger._calls = [];
			const mockContext = {
				getType: () => 'rpc',
				switchToHttp: () => ({
					getRequest: () => ({}),
					getResponse: () => ({}),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ result: 'rpc' }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const infoCalls = mockLogger._calls.filter((c: any) => c.level === 'info');
					expect(infoCalls.length).toBe(0);
					resolve();
				});
			});
		});
	});

	describe('Edge Cases', () => {
		it('should handle missing IP address gracefully', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						url: '/api/test',
						method: 'GET',
						ip: undefined,
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ data: 'test' }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const infoCalls = mockLogger._calls.filter((c: any) => c.level === 'info');
					expect(infoCalls.length).toBeGreaterThan(0);
					resolve();
				});
			});
		});

		it('should handle URLs with query parameters', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						url: '/api/search?q=test&page=1&limit=10',
						method: 'GET',
						ip: '127.0.0.1',
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of([]),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const incomingCall = mockLogger._calls.find((c: any) => c.level === 'info' && c.args[0].includes('Incoming'));
					expect(incomingCall.args[0]).toContain('/api/search?q=test');
					resolve();
				});
			});
		});
	});
});
