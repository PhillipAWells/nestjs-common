import { ExecutionContext, CallHandler } from '@nestjs/common';
import { HTTPMetricsInterceptor } from '../http-metrics.interceptor.js';
import { MetricsRegistryService } from '../../services/metrics-registry.service.js';
import { of, Observable } from 'rxjs';

describe('HTTPMetricsInterceptor', () => {
	let interceptor: HTTPMetricsInterceptor;
	let mockMetrics: any;

	beforeEach(() => {
		// Manual mock using plain JS object (Phase 2 pattern)
		const recordedMetrics: any[] = [];
		mockMetrics = {
			recordHttpRequest(...args: any[]) {
				recordedMetrics.push({
					method: args[0],
					route: args[1],
					statusCode: args[2],
					duration: args[3],
					contentLength: args[4],
				});
			},
			recordCounter() {},
			recordHistogram() {},
			_metrics: recordedMetrics,
		};

		const mockModuleRef = {
			get: (token: any) => {
				if (token === MetricsRegistryService) return mockMetrics;
				throw new Error('not found');
			},
		} as any;

		interceptor = new HTTPMetricsInterceptor(mockModuleRef);
	});

	it('should be defined', () => {
		expect(interceptor).toBeDefined();
		expect(interceptor.intercept).toBeDefined();
	});

	describe('Metrics Collection', () => {
		it('should record HTTP request metrics with method and route', () => {
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
					expect(mockMetrics._metrics.length).toBeGreaterThan(0);
					// eslint-disable-next-line prefer-destructuring
					const metric = mockMetrics._metrics[0];
					expect(metric.method).toBe('GET');
					expect(metric.route).toBe('/api/users');
					expect(metric.statusCode).toBe(200);
					resolve();
				});
			});
		});

		it('should record request duration in milliseconds', () => {
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
				handle: () => of({ id: 123 }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					// eslint-disable-next-line prefer-destructuring
					const metric = mockMetrics._metrics[0];
					expect(metric.duration).toBeDefined();
					expect(typeof metric.duration).toBe('number');
					expect(metric.duration).toBeGreaterThanOrEqual(0);
					resolve();
				});
			});
		});

		it('should capture HTTP status codes (2xx, 4xx, 5xx)', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'DELETE',
						url: '/api/users/123',
						path: '/api/users/123',
						route: { path: '/api/users/:id' },
						headers: {},
					}),
					getResponse: () => ({ statusCode: 404 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({}),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					// eslint-disable-next-line prefer-destructuring
					const metric = mockMetrics._metrics[0];
					expect(metric.statusCode).toBe(404);
					expect([200, 201, 204, 400, 401, 403, 404, 500, 502, 503]).toContain(metric.statusCode);
					resolve();
				});
			});
		});

		it('should extract content length from request headers', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'PUT',
						url: '/api/users/123',
						path: '/api/users/123',
						route: { path: '/api/users/:id' },
						headers: { 'content-length': '512' },
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({ updated: true }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					// eslint-disable-next-line prefer-destructuring
					const metric = mockMetrics._metrics[0];
					expect(metric.contentLength).toBe(512);
					resolve();
				});
			});
		});
	});

	describe('Edge Cases & Robustness', () => {
		it('should handle missing request method gracefully', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						url: '/api/test',
						path: '/api/test',
						headers: {},
						// Missing method
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({}),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					// Should still pass through
					resolve();
				});
			});
		});

		it('should handle missing route information and fallback to URL', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'GET',
						url: '/api/fallback',
						path: '/api/fallback',
						headers: {},
						// Missing route
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({}),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					// eslint-disable-next-line prefer-destructuring
					const metric = mockMetrics._metrics[0];
					// Should fallback to path or URL
					expect(metric.route).toBeDefined();
					resolve();
				});
			});
		});

		it('should handle invalid content-length header gracefully', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'POST',
						url: '/api/test',
						path: '/api/test',
						headers: { 'content-length': 'invalid-number' },
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;
			const mockCallHandler = {
				handle: () => of({}),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					// eslint-disable-next-line prefer-destructuring
					const metric = mockMetrics._metrics[0];
					// Should handle gracefully (undefined or 0)
					expect(metric.contentLength === undefined || metric.contentLength === 0 || isNaN(metric.contentLength)).toBe(true);
					resolve();
				});
			});
		});
	});

	describe('All HTTP Methods', () => {
		it('should record metrics for different HTTP methods', () => {
			const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

			return new Promise<void>((resolve) => {
				let completed = 0;

				methods.forEach((method) => {
					const mockContext = {
						getType: () => 'http',
						switchToHttp: () => ({
							getRequest: () => ({
								method,
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

					interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
						const metric = mockMetrics._metrics[mockMetrics._metrics.length - 1];
						expect(metric.method).toBe(method);
						completed++;
						if (completed === methods.length) {
							resolve();
						}
					});
				});
			});
		});
	});

	describe('Error Handling', () => {
		it('should record metrics even when request throws error', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'POST',
						url: '/api/error',
						path: '/api/error',
						headers: { 'content-length': '100' },
					}),
					getResponse: () => ({ statusCode: 500 }),
				}),
			} as unknown as ExecutionContext;

			const testError = new Error('Request failed');
			const mockCallHandler = {
				handle: () => {
					return new Observable((subscriber) => {
						setTimeout(() => {
							subscriber.error(testError);
						}, 10);
					});
				},
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(
					() => {
						// Should not succeed
						expect(true).toBe(false);
						resolve();
					},
					(error) => {
						// Should catch error
						expect(error).toBe(testError);
						// Metrics should still be recorded
						expect(mockMetrics._metrics.length).toBeGreaterThan(0);
						const metric = mockMetrics._metrics[mockMetrics._metrics.length - 1];
						expect(metric.statusCode).toBe(500);
						expect(metric.duration).toBeDefined();
						expect(metric.contentLength).toBe(100);
						resolve();
					},
				);
			});
		});

		it('should use default status code 500 when response status is not set on error', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'PUT',
						url: '/api/fail',
						path: '/api/fail',
						headers: {},
					}),
					getResponse: () => ({}), // No statusCode set
				}),
			} as unknown as ExecutionContext;

			const testError = new Error('Server error');
			const mockCallHandler = {
				handle: () => {
					return new Observable((subscriber) => {
						subscriber.error(testError);
					});
				},
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(
					() => {
						expect(true).toBe(false);
						resolve();
					},
					(error) => {
						expect(error).toBe(testError);
						const metric = mockMetrics._metrics[mockMetrics._metrics.length - 1];
						expect(metric.statusCode).toBe(500); // Default error status
						resolve();
					},
				);
			});
		});

		it('should record error metrics with partial response status code', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'DELETE',
						url: '/api/item/123',
						path: '/api/item/123',
						headers: { 'content-length': '256' },
					}),
					getResponse: () => ({ statusCode: 404 }), // Custom status code
				}),
			} as unknown as ExecutionContext;

			const testError = new Error('Not found');
			const mockCallHandler = {
				handle: () => {
					return new Observable((subscriber) => {
						subscriber.error(testError);
					});
				},
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(
					() => {
						expect(true).toBe(false);
						resolve();
					},
					(error) => {
						expect(error).toBe(testError);
						const metric = mockMetrics._metrics[mockMetrics._metrics.length - 1];
						expect(metric.statusCode).toBe(404); // Uses response statusCode if available
						expect(metric.contentLength).toBe(256);
						resolve();
					},
				);
			});
		});
	});

	describe('Context Type Handling', () => {
		it('should skip metrics for non-HTTP context types', () => {
			const mockContext = {
				getType: () => 'graphql',
			} as unknown as ExecutionContext;

			const mockCallHandler = {
				handle: () => of({ data: 'test' }),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				const initialCount = mockMetrics._metrics.length;
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					// No metrics should be recorded for non-HTTP context
					expect(mockMetrics._metrics.length).toBe(initialCount);
					resolve();
				});
			});
		});

		it('should skip metrics for websocket context', () => {
			const mockContext = {
				getType: () => 'ws',
			} as unknown as ExecutionContext;

			const mockCallHandler = {
				handle: () => of({}),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				const initialCount = mockMetrics._metrics.length;
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					expect(mockMetrics._metrics.length).toBe(initialCount);
					resolve();
				});
			});
		});
	});

	describe('Request Safety Checks', () => {
		it('should skip metrics when request object is missing method', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						url: '/api/test',
						// Missing method
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;

			const mockCallHandler = {
				handle: () => of({}),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				const initialCount = mockMetrics._metrics.length;
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					// Should skip metrics due to missing method
					expect(mockMetrics._metrics.length).toBe(initialCount);
					resolve();
				});
			});
		});
	});

	describe('Route Fallback Logic', () => {
		it('should use path as route when route.path is undefined', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'GET',
						url: '/api/fallback',
						path: '/api/fallback',
						headers: {},
						// Missing route
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;

			const mockCallHandler = {
				handle: () => of({}),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const metric = mockMetrics._metrics[mockMetrics._metrics.length - 1];
					expect(metric.route).toBe('/api/fallback');
					resolve();
				});
			});
		});

		it('should use /unknown when both route and path are missing', () => {
			const mockContext = {
				getType: () => 'http',
				switchToHttp: () => ({
					getRequest: () => ({
						method: 'GET',
						headers: {},
						// Missing url, path, and route
					}),
					getResponse: () => ({ statusCode: 200 }),
				}),
			} as unknown as ExecutionContext;

			const mockCallHandler = {
				handle: () => of({}),
			} as unknown as CallHandler;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					const metric = mockMetrics._metrics[mockMetrics._metrics.length - 1];
					expect(metric.route).toBe('/unknown');
					resolve();
				});
			});
		});
	});
});
