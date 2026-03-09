import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError, from } from 'rxjs';
import { ProfilingInterceptor } from './profiling.interceptor.js';
import { PyroscopeService } from '../service.js';

describe('ProfilingInterceptor', () => {
	let interceptor: ProfilingInterceptor;
	let mockPyroscopeService: jest.Mocked<PyroscopeService>;
	let mockExecutionContext: jest.Mocked<ExecutionContext>;
	let mockCallHandler: jest.Mocked<CallHandler>;

	beforeEach(async () => {
		mockPyroscopeService = {
			isEnabled: jest.fn().mockReturnValue(true),
			startProfiling: jest.fn(),
			stopProfiling: jest.fn().mockReturnValue({
				cpuTime: 0,
				memoryUsage: 0,
				duration: 10,
				timestamp: Date.now()
			})
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ProfilingInterceptor,
				{
					provide: PyroscopeService,
					useValue: mockPyroscopeService
				}
			]
		}).compile();

		interceptor = module.get<ProfilingInterceptor>(ProfilingInterceptor);
	});

	beforeEach(() => {
		// Set up mock execution context
		const mockRequest = {
			method: 'GET',
			url: '/api/users',
			route: { path: '/api/users' },
			get: jest.fn((header: string) => {
				if (header === 'User-Agent') return 'Mozilla/5.0';
				return undefined;
			})
		};

		const mockResponse = {
			statusCode: 200
		};

		mockExecutionContext = {
			switchToHttp: jest.fn().mockReturnValue({
				getRequest: () => mockRequest,
				getResponse: () => mockResponse
			})
		} as any;

		mockCallHandler = {
			handle: jest.fn()
		} as any;
	});

	describe('intercept', () => {
		it('should profile HTTP requests', (done) => {
			mockCallHandler.handle.mockReturnValue(of('response data'));

			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
				next: (data) => {
					expect(data).toBe('response data');
					expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
						expect.objectContaining({
							functionName: 'HTTP GET /api/users',
							tags: expect.objectContaining({
								method: 'GET',
								path: '/api/users',
								userAgent: 'Mozilla/5.0'
							})
						})
					);
					expect(mockPyroscopeService.stopProfiling).toHaveBeenCalledWith(
						expect.objectContaining({
							tags: expect.objectContaining({
								method: 'GET',
								path: '/api/users',
								statusCode: '200',
								success: 'true'
							})
						})
					);
					done();
				}
			});
		});

		it('should not profile when disabled', (done) => {
			mockPyroscopeService.isEnabled.mockReturnValue(false);
			mockCallHandler.handle.mockReturnValue(of('response data'));

			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
				next: (data) => {
					expect(data).toBe('response data');
					expect(mockPyroscopeService.startProfiling).not.toHaveBeenCalled();
					expect(mockPyroscopeService.stopProfiling).not.toHaveBeenCalled();
					done();
				}
			});
		});

		it('should use request URL when route path is not available', (done) => {
			const mockRequest = {
				method: 'POST',
				url: '/dynamic/path',
				route: undefined,
				get: jest.fn().mockReturnValue('test-agent')
			};

			mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
				getRequest: () => mockRequest,
				getResponse: () => ({ statusCode: 201 })
			});

			mockCallHandler.handle.mockReturnValue(of('created'));

			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
				next: () => {
					expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
						expect.objectContaining({
							functionName: 'HTTP POST /dynamic/path',
							tags: expect.objectContaining({
								path: '/dynamic/path'
							})
						})
					);
					done();
				}
			});
		});

		it('should handle unknown User-Agent', (done) => {
			const mockRequest = {
				method: 'GET',
				url: '/api/test',
				route: { path: '/api/test' },
				get: jest.fn().mockReturnValue(undefined)
			};

			mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
				getRequest: () => mockRequest,
				getResponse: () => ({ statusCode: 200 })
			});

			mockCallHandler.handle.mockReturnValue(of('data'));

			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
				next: () => {
					expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
						expect.objectContaining({
							tags: expect.objectContaining({
								userAgent: 'unknown'
							})
						})
					);
					done();
				}
			});
		});

		it('should profile different HTTP methods', (done) => {
			const mockRequest = {
				method: 'POST',
				url: '/api/users',
				route: { path: '/api/users' },
				get: jest.fn().mockReturnValue('test')
			};

			mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
				getRequest: () => mockRequest,
				getResponse: () => ({ statusCode: 201 })
			});

			mockCallHandler.handle.mockReturnValue(of({ id: 1, name: 'Test User' }));

			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
				next: () => {
					expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
						expect.objectContaining({
							functionName: 'HTTP POST /api/users',
							tags: expect.objectContaining({
								method: 'POST'
							})
						})
					);
					done();
				}
			});
		});

		it('should handle errors and profile them', (done) => {
			const error = new Error('Request failed');
			(error as any).status = 500;

			mockCallHandler.handle.mockReturnValue(throwError(() => error));

			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
				error: (err) => {
					expect(err).toBe(error);
					expect(mockPyroscopeService.startProfiling).toHaveBeenCalled();
					expect(mockPyroscopeService.stopProfiling).toHaveBeenCalledWith(
						expect.objectContaining({
							error,
							tags: expect.objectContaining({
								statusCode: '500',
								success: 'false',
								error: 'Request failed'
							})
						})
					);
					done();
				}
			});
		});

		it('should handle errors without status code', (done) => {
			const error = new Error('Unknown error');

			mockCallHandler.handle.mockReturnValue(throwError(() => error));

			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
				error: (err) => {
					expect(err).toBe(error);
					expect(mockPyroscopeService.stopProfiling).toHaveBeenCalledWith(
						expect.objectContaining({
							tags: expect.objectContaining({
								statusCode: '500'
							})
						})
					);
					done();
				}
			});
		});

		it('should handle errors without message', (done) => {
			const error = new Error();
			(error as any).status = 400;

			mockCallHandler.handle.mockReturnValue(throwError(() => error));

			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
				error: () => {
					expect(mockPyroscopeService.stopProfiling).toHaveBeenCalledWith(
						expect.objectContaining({
							tags: expect.objectContaining({
								error: 'unknown',
								statusCode: '400'
							})
						})
					);
					done();
				}
			});
		});

		it('should handle different response status codes', (done) => {
			const mockResponse = {
				statusCode: 404
			};

			mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
				getRequest: () => ({
					method: 'GET',
					url: '/api/not-found',
					route: { path: '/api/not-found' },
					get: jest.fn().mockReturnValue('test')
				}),
				getResponse: () => mockResponse
			});

			mockCallHandler.handle.mockReturnValue(of(null));

			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
				next: () => {
					expect(mockPyroscopeService.stopProfiling).toHaveBeenCalledWith(
						expect.objectContaining({
							tags: expect.objectContaining({
								statusCode: '404'
							})
						})
					);
					done();
				}
			});
		});

		it('should handle missing status code in response', (done) => {
			const mockResponse = {
				statusCode: undefined
			};

			mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
				getRequest: () => ({
					method: 'GET',
					url: '/api/test',
					route: { path: '/api/test' },
					get: jest.fn().mockReturnValue('test')
				}),
				getResponse: () => mockResponse
			});

			mockCallHandler.handle.mockReturnValue(of('data'));

			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
				next: () => {
					expect(mockPyroscopeService.stopProfiling).toHaveBeenCalledWith(
						expect.objectContaining({
							tags: expect.objectContaining({
								statusCode: 'unknown'
							})
						})
					);
					done();
				}
			});
		});

		it('should preserve original response data', (done) => {
			const responseData = { id: 123, data: 'test data', nested: { value: 'nested' } };
			mockCallHandler.handle.mockReturnValue(of(responseData));

			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
				next: (data) => {
					expect(data).toEqual(responseData);
					expect(data).toBe(responseData); // Same reference
					done();
				}
			});
		});

		it('should work with async handlers', (done) => {
			mockCallHandler.handle.mockReturnValue(
				from(new Promise((resolve) => {
					setTimeout(() => resolve('async response'), 10);
				}))
			);

			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
				complete: () => {
					expect(mockPyroscopeService.startProfiling).toHaveBeenCalled();
					expect(mockPyroscopeService.stopProfiling).toHaveBeenCalled();
					done();
				}
			});
		});
	});
});
