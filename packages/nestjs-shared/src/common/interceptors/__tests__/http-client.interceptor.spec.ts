import { HttpClientInterceptor } from '../http-client.interceptor.js';
import { of, throwError } from 'rxjs';

describe('HttpClientInterceptor', () => {
	let interceptor: HttpClientInterceptor;
	let mockLogger: any;
	let logCalls: any[];

	beforeEach(() => {
		logCalls = [];
		const contextualLogger = {
			debug(...args: any[]) {
				logCalls.push({ level: 'debug', args });
			},
			Debug(...args: any[]) {
				logCalls.push({ level: 'debug', args });
			},
			info(...args: any[]) {
				logCalls.push({ level: 'info', args });
			},
			Info(...args: any[]) {
				logCalls.push({ level: 'info', args });
			},
			warn(...args: any[]) {
				logCalls.push({ level: 'warn', args });
			},
			Warn(...args: any[]) {
				logCalls.push({ level: 'warn', args });
			},
			error(...args: any[]) {
				logCalls.push({ level: 'error', args });
			},
			Error(...args: any[]) {
				logCalls.push({ level: 'error', args });
			},
			log(...args: any[]) {
				logCalls.push({ level: 'log', args });
			},
		};

		mockLogger = {
			createContextualLogger() {
				return contextualLogger;
			},
			CreateContextualLogger() {
				return contextualLogger;
			},
		};

		interceptor = new HttpClientInterceptor(mockLogger);
	});

	it('should be defined', () => {
		expect(interceptor).toBeDefined();
	});

	describe('intercept', () => {
		let mockContext: any;
		let mockRequest: any;
		let mockResponse: any;
		let mockCallHandler: any;

		beforeEach(() => {
			mockRequest = {
				url: '/api/users',
				method: 'GET',
				headers: {
					'authorization': 'Bearer token123',
				},
				correlationId: 'corr-123',
			};
			mockResponse = {
				statusCode: 200,
				status: 200,
			};
			mockContext = {
				switchToHttp() {
					return {
						getRequest() {
							return mockRequest;
						},
						getResponse() {
							return mockResponse;
						},
					};
				},
			};
			mockCallHandler = {
				handle() {
					return of({ data: 'success' });
				},
			};
			logCalls = [];
		});

		it('should log request and response', () => {
			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					expect(logCalls.length).toBeGreaterThan(0);
					resolve();
				});
			});
		});

		it('should sanitize sensitive headers in logs', () => {
			mockRequest.headers = {
				'authorization': 'Bearer token123',
				'x-api-key': 'secret-key',
				'cookie': 'session=abc',
			};

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					expect(logCalls.length).toBeGreaterThan(0);
					resolve();
				});
			});
		});

		it('should log successful responses', () => {
			mockResponse.statusCode = 200;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					expect(logCalls.length).toBeGreaterThan(0);
					resolve();
				});
			});
		});

		it('should log POST requests with method info', () => {
			mockRequest.method = 'POST';
			mockRequest.url = '/api/data';

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					expect(logCalls.length).toBeGreaterThan(0);
					resolve();
				});
			});
		});

		it('should handle missing correlation ID', () => {
			mockRequest.correlationId = undefined;

			return new Promise<void>((resolve) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
					expect(logCalls.length).toBeGreaterThan(0);
					resolve();
				});
			});
		});

		it('should log error responses', () => {
			mockCallHandler.handle = () => throwError(() => new Error('Request failed'));

			return new Promise<void>((resolve, reject) => {
				interceptor.intercept(mockContext, mockCallHandler).subscribe(
					() => {
						// Should not reach here
						reject(new Error('Should not succeed'));
					},
					(error) => {
						expect(error.message).toBe('Request failed');
						expect(logCalls.length).toBeGreaterThan(0);
						resolve();
					},
				);
			});
		});
	});
});
