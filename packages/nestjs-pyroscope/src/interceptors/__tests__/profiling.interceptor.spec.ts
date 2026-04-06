import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError, from } from 'rxjs';
import { ModuleRef } from '@nestjs/core';
import { ProfilingInterceptor } from '../profiling.interceptor.js';

describe('ProfilingInterceptor', () => {
	let interceptor: ProfilingInterceptor;
	let mockPyroscopeService: any;
	let mockExecutionContext: any;
	let mockCallHandler: any;

	beforeEach(async () => {
		mockPyroscopeService = {
			IsEnabled: vi.fn().mockReturnValue(true),
			StartProfiling: vi.fn(),
			StopProfiling: vi.fn().mockReturnValue({
				cpuTime: 0,
				memoryUsage: 0,
				duration: 10,
				timestamp: Date.now(),
			}),
		} as any;

		const mockModuleRef = {
			get: vi.fn().mockReturnValue(mockPyroscopeService),
		} as unknown as ModuleRef;

		// Directly instantiate the interceptor with the mocked ModuleRef
		interceptor = new ProfilingInterceptor(mockModuleRef);

		// Set up mock execution context
		const mockRequest = {
			method: 'GET',
			url: '/api/users',
			route: { path: '/api/users' },
			get: vi.fn((header: string) => {
				if (header === 'IUser-Agent') return 'Mozilla/5.0';
				return undefined;
			}),
		};

		const mockResponse = {
			statusCode: 200,
		};

		mockExecutionContext = {
			switchToHttp: vi.fn().mockReturnValue({
				getRequest: () => mockRequest,
				getResponse: () => mockResponse,
			}),
		} as any;

		mockCallHandler = {
			handle: vi.fn(),
		} as any;
	});

	describe('intercept', () => {
		it('should gracefully degrade when PyroscopeService is not available', () => {
			const mockModuleRef = {
				get: vi.fn().mockImplementation(() => {
					throw new Error('Provider not found');
				}),
			} as unknown as ModuleRef;

			const degradedInterceptor = new ProfilingInterceptor(mockModuleRef);

			mockCallHandler.handle.mockReturnValue(of('response data'));

			return new Promise<void>((resolve) => {
				degradedInterceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					next: (data) => {
						expect(data).toBe('response data');
						// Should not attempt to profile
						expect(mockCallHandler.handle).toHaveBeenCalled();
						resolve();
					},
				});
			});
		});

		it('should profile HTTP requests', () => {
			mockCallHandler.handle.mockReturnValue(of('response data'));

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					next: (data) => {
						expect(data).toBe('response data');
						expect(mockPyroscopeService.StartProfiling).toHaveBeenCalledWith(
							expect.objectContaining({
								functionName: 'HTTP GET /api/users',
								tags: expect.objectContaining({
									method: 'GET',
									path: '/api/users',
									userAgent: 'Mozilla/5.0',
								}),
							}),
						);
						expect(mockPyroscopeService.StopProfiling).toHaveBeenCalledWith(
							expect.objectContaining({
								tags: expect.objectContaining({
									method: 'GET',
									path: '/api/users',
									statusCode: '200',
									success: 'true',
								}),
							}),
						);
						resolve();
					},
				});
			});
		});

		it('should not profile when disabled', () => {
			mockPyroscopeService.IsEnabled.mockReturnValue(false);
			mockCallHandler.handle.mockReturnValue(of('response data'));

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					next: (data) => {
						expect(data).toBe('response data');
						expect(mockPyroscopeService.StartProfiling).not.toHaveBeenCalled();
						expect(mockPyroscopeService.StopProfiling).not.toHaveBeenCalled();
						resolve();
					},
				});
			});
		});

		it('should use request URL when route path is not available', () => {
			const mockRequest = {
				method: 'POST',
				url: '/dynamic/path',
				route: undefined,
				get: vi.fn().mockReturnValue('test-agent'),
			};

			mockExecutionContext.switchToHttp = vi.fn().mockReturnValue({
				getRequest: () => mockRequest,
				getResponse: () => ({ statusCode: 201 }),
			});

			mockCallHandler.handle.mockReturnValue(of('created'));

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					next: () => {
						expect(mockPyroscopeService.StartProfiling).toHaveBeenCalledWith(
							expect.objectContaining({
								functionName: 'HTTP POST /dynamic/path',
								tags: expect.objectContaining({
									path: '/dynamic/path',
								}),
							}),
						);
						resolve();
					},
				});
			});
		});

		it('should handle unknown IUser-Agent', () => {
			const mockRequest = {
				method: 'GET',
				url: '/api/test',
				route: { path: '/api/test' },
				get: vi.fn().mockReturnValue(undefined),
			};

			mockExecutionContext.switchToHttp = vi.fn().mockReturnValue({
				getRequest: () => mockRequest,
				getResponse: () => ({ statusCode: 200 }),
			});

			mockCallHandler.handle.mockReturnValue(of('data'));

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					next: () => {
						expect(mockPyroscopeService.StartProfiling).toHaveBeenCalledWith(
							expect.objectContaining({
								tags: expect.objectContaining({
									userAgent: 'unknown',
								}),
							}),
						);
						resolve();
					},
				});
			});
		});

		it('should profile different HTTP methods', () => {
			const mockRequest = {
				method: 'POST',
				url: '/api/users',
				route: { path: '/api/users' },
				get: vi.fn().mockReturnValue('test'),
			};

			mockExecutionContext.switchToHttp = vi.fn().mockReturnValue({
				getRequest: () => mockRequest,
				getResponse: () => ({ statusCode: 201 }),
			});

			mockCallHandler.handle.mockReturnValue(of({ id: 1, name: 'Test IUser' }));

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					next: () => {
						expect(mockPyroscopeService.StartProfiling).toHaveBeenCalledWith(
							expect.objectContaining({
								functionName: 'HTTP POST /api/users',
								tags: expect.objectContaining({
									method: 'POST',
								}),
							}),
						);
						resolve();
					},
				});
			});
		});

		it('should handle errors and profile them', () => {
			const error = new Error('Request failed');
			(error as any).status = 500;

			mockCallHandler.handle.mockReturnValue(throwError(() => error));

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					error: (err) => {
						expect(err).toBe(error);
						expect(mockPyroscopeService.StartProfiling).toHaveBeenCalled();
						expect(mockPyroscopeService.StopProfiling).toHaveBeenCalledWith(
							expect.objectContaining({
								error,
								tags: expect.objectContaining({
									statusCode: '500',
									success: 'false',
									error: 'unknown',
								}),
							}),
						);
						resolve();
					},
				});
			});
		});

		it('should handle errors without status code', () => {
			const error = new Error('Unknown error');

			mockCallHandler.handle.mockReturnValue(throwError(() => error));

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					error: (err) => {
						expect(err).toBe(error);
						expect(mockPyroscopeService.StopProfiling).toHaveBeenCalledWith(
							expect.objectContaining({
								tags: expect.objectContaining({
									statusCode: '500',
								}),
							}),
						);
						resolve();
					},
				});
			});
		});

		it('should handle errors without message', () => {
			const error = new Error();
			(error as any).status = 400;

			mockCallHandler.handle.mockReturnValue(throwError(() => error));

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					error: () => {
						expect(mockPyroscopeService.StopProfiling).toHaveBeenCalledWith(
							expect.objectContaining({
								tags: expect.objectContaining({
									error: 'unknown',
									statusCode: '400',
								}),
							}),
						);
						resolve();
					},
				});
			});
		});

		it('should handle different response status codes', () => {
			const mockResponse = {
				statusCode: 404,
			};

			mockExecutionContext.switchToHttp = vi.fn().mockReturnValue({
				getRequest: () => ({
					method: 'GET',
					url: '/api/not-found',
					route: { path: '/api/not-found' },
					get: vi.fn().mockReturnValue('test'),
				}),
				getResponse: () => mockResponse,
			});

			mockCallHandler.handle.mockReturnValue(of(null));

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					next: () => {
						expect(mockPyroscopeService.StopProfiling).toHaveBeenCalledWith(
							expect.objectContaining({
								tags: expect.objectContaining({
									statusCode: '404',
								}),
							}),
						);
						resolve();
					},
				});
			});
		});

		it('should handle missing status code in response', () => {
			const mockResponse = {
				statusCode: undefined,
			};

			mockExecutionContext.switchToHttp = vi.fn().mockReturnValue({
				getRequest: () => ({
					method: 'GET',
					url: '/api/test',
					route: { path: '/api/test' },
					get: vi.fn().mockReturnValue('test'),
				}),
				getResponse: () => mockResponse,
			});

			mockCallHandler.handle.mockReturnValue(of('data'));

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					next: () => {
						expect(mockPyroscopeService.StopProfiling).toHaveBeenCalledWith(
							expect.objectContaining({
								tags: expect.objectContaining({
									statusCode: 'unknown',
								}),
							}),
						);
						resolve();
					},
				});
			});
		});

		it('should preserve original response data', () => {
			const responseData = { id: 123, data: 'test data', nested: { value: 'nested' } };
			mockCallHandler.handle.mockReturnValue(of(responseData));

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					next: (data) => {
						expect(data).toEqual(responseData);
						expect(data).toBe(responseData); // Same reference
						resolve();
					},
				});
			});
		});

		it('should work with async handlers', () => {
			mockCallHandler.handle.mockReturnValue(
				from(new Promise((resolve) => {
					setTimeout(() => resolve('async response'), 10);
				})),
			);

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
					complete: () => {
						expect(mockPyroscopeService.StartProfiling).toHaveBeenCalled();
						expect(mockPyroscopeService.StopProfiling).toHaveBeenCalled();
						resolve();
					},
				});
			});
		});
	});
});
