import { ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
import { HTTPInstrumentationInterceptor } from '../http-instrumentation.interceptor.js';
import { of, throwError } from 'rxjs';
import { InstrumentationRegistry } from '../../registry/instrumentation-registry.js';

describe('HTTPInstrumentationInterceptor', () => {
	let interceptor: HTTPInstrumentationInterceptor;
	let mockRegistry: any;

	beforeEach(() => {
		// Manual mock of InstrumentationRegistry
		const recordedMetrics: any[] = [];
		mockRegistry = {
			RecordMetric(name: string, value: number, labels?: Record<string, string | number>) {
				recordedMetrics.push({
					name,
					value,
					labels: labels ?? {},
				});
			},
			_metrics: recordedMetrics,
		};

		const mockModuleRef = {
			get: (token: any) => {
				if (token === InstrumentationRegistry) return mockRegistry;
				throw new Error('not found');
			},
		} as any;

		interceptor = new HTTPInstrumentationInterceptor(mockModuleRef);
	});

	it('should be defined', () => {
		expect(interceptor).toBeDefined();
		expect(interceptor.intercept).toBeDefined();
	});

	describe('Metrics Collection', () => {
		it('should record http_request_duration_seconds, http_requests_total, and content length', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'POST',
						url: '/api/users',
						path: '/api/users',
						route: { path: '/api/users' },
						headers: { 'content-length': '256' },
					}),
					getResponse: () => ({ statusCode: 201 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ data: 'created' }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const expectedMetricCount = 3; // duration, counter, size
					expect(mockRegistry._metrics.length).toBe(expectedMetricCount);
					const [durationMetric, counterMetric, sizeMetric] = mockRegistry._metrics;
					expect(durationMetric.name).toBe('http_request_duration_seconds');
					expect(typeof durationMetric.value).toBe('number');
					expect(durationMetric.value).toBeGreaterThanOrEqual(0);
					expect(durationMetric.labels.method).toBe('POST');
					expect(durationMetric.labels.route).toBe('/api/users');
					expect(durationMetric.labels.status_code).toBe('201');

					expect(counterMetric.name).toBe('http_requests_total');
					expect(counterMetric.value).toBe(1);
					expect(counterMetric.labels.method).toBe('POST');
					expect(counterMetric.labels.route).toBe('/api/users');
					expect(counterMetric.labels.status_code).toBe('201');

					expect(sizeMetric.name).toBe('http_request_size_bytes');
					const expectedContentLength = 256;
					expect(sizeMetric.value).toBe(expectedContentLength);
					expect(sizeMetric.labels.method).toBe('POST');
					expect(sizeMetric.labels.route).toBe('/api/users');
					resolve();
				});
			});
		});

		it('should skip non-HTTP contexts', () => {
			const mockContext = {
				getType: () => 'graphql',
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ data: 'test' }),
			} as unknown as CallHandler;

			mockRegistry._metrics = [];

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					expect(mockRegistry._metrics.length).toBe(0);
					resolve();
				});
			});
		});

		it('should handle requests without content-length header', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'GET',
						url: '/api/users',
						path: '/api/users',
						route: { path: '/api/users' },
						headers: {},
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ data: 'users' }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					expect(mockRegistry._metrics.length).toBe(2); // duration and counter (no size)
					const sizeMetrics = mockRegistry._metrics.filter((m: any) => m.name === 'http_request_size_bytes');
					expect(sizeMetrics.length).toBe(0);
					resolve();
				});
			});
		});

		it('should extract route from express route object', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'GET',
						url: '/api/users/123?filter=active',
						path: '/api/users/123',
						route: { path: '/api/users/:id' },
						headers: {},
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ data: 'user' }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const durationMetric = mockRegistry._metrics.find((m: any) => m.name === 'http_request_duration_seconds');
					expect(durationMetric.labels.route).toBe('/api/users/:id');
					resolve();
				});
			});
		});

		it('should fallback to request.path when route object is not available', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'GET',
						url: '/api/users/123',
						path: '/api/users/123',
						route: undefined,
						headers: {},
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ data: 'user' }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const durationMetric = mockRegistry._metrics.find((m: any) => m.name === 'http_request_duration_seconds');
					expect(durationMetric.labels.route).toBe('/api/users/123');
					resolve();
				});
			});
		});

		it('should handle invalid content-length values gracefully', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'POST',
						url: '/api/users',
						path: '/api/users',
						route: { path: '/api/users' },
						headers: { 'content-length': 'invalid' },
					}),
					getResponse: () => ({ statusCode: 201 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ data: 'created' }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					expect(mockRegistry._metrics.length).toBe(2); // duration and counter (no size due to invalid value)
					const sizeMetrics = mockRegistry._metrics.filter((m: any) => m.name === 'http_request_size_bytes');
					expect(sizeMetrics.length).toBe(0);
					resolve();
				});
			});
		});
	});

	describe('Error Handling', () => {
		it('should record metrics even when HttpException is thrown', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'DELETE',
						url: '/api/users/999',
						path: '/api/users/999',
						route: { path: '/api/users/:id' },
						headers: {},
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => throwError(() => new HttpException('Not Found', 404)),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe({
					error: () => {
						expect(mockRegistry._metrics.length).toBe(2); // duration and counter
						const durationMetric = mockRegistry._metrics.find((m: any) => m.name === 'http_request_duration_seconds');
						expect(durationMetric.labels.status_code).toBe('404');

						const counterMetric = mockRegistry._metrics.find((m: any) => m.name === 'http_requests_total');
						expect(counterMetric.labels.status_code).toBe('404');
						resolve();
					},
				});
			});
		});

		it('should record metrics with 500 status code for non-HttpException Error()s', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'POST',
						url: '/api/users',
						path: '/api/users',
						route: { path: '/api/users' },
						headers: { 'content-length': '100' },
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => throwError(() => new Error('Internal server Error()')),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe({
					error: () => {
						expect(mockRegistry._metrics.length).toBe(2); // duration and counter
						const durationMetric = mockRegistry._metrics.find((m: any) => m.name === 'http_request_duration_seconds');
						expect(durationMetric.labels.status_code).toBe('500');

						const counterMetric = mockRegistry._metrics.find((m: any) => m.name === 'http_requests_total');
						expect(counterMetric.labels.status_code).toBe('500');
						resolve();
					},
				});
			});
		});

		it('should re-throw the Error() after recording metrics', () => {
			const testError = new Error('Test Error()');
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'GET',
						url: '/api/test',
						path: '/api/test',
						route: { path: '/api/test' },
						headers: {},
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => throwError(() => testError),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe({
					error: (err) => {
						expect(err).toBe(testError);
						resolve();
					},
				});
			});
		});
	});

	describe('Route Extraction', () => {
		it('should fallback to unknown route when all extraction methods return undefined', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'GET',
						url: undefined,
						path: undefined,
						route: undefined,
						headers: {},
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({}),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const durationMetric = mockRegistry._metrics.find((m: any) => m.name === 'http_request_duration_seconds');
					expect(durationMetric.labels.route).toBe('/unknown');
					resolve();
				});
			});
		});

		it('should use url when path is not available', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'GET',
						url: '/api/test',
						path: undefined,
						route: undefined,
						headers: {},
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({}),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const durationMetric = mockRegistry._metrics.find((m: any) => m.name === 'http_request_duration_seconds');
					expect(durationMetric.labels.route).toBe('/api/test');
					resolve();
				});
			});
		});
	});

	describe('Duration Measurement', () => {
		it('should record duration in seconds (not milliseconds)', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'GET',
						url: '/api/test',
						path: '/api/test',
						route: { path: '/api/test' },
						headers: {},
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({}),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const durationMetric = mockRegistry._metrics.find((m: any) => m.name === 'http_request_duration_seconds');
					expect(durationMetric.value).toBeLessThan(1); // Should be less than 1 second
					expect(durationMetric.value).toBeGreaterThanOrEqual(0);
					resolve();
				});
			});
		});
	});
});
