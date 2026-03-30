import * as http from 'http';
import * as https from 'https';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IncomingMessage, ClientRequest } from 'http';
import { HttpClientService } from '../http-client.service.js';
import { ModuleRef } from '@nestjs/core';

// Mock http and https modules
vi.mock('http');
vi.mock('https');

// Helper to create mock IncomingMessage with event listeners
function createMockIncomingMessage(
	statusCode: number,
	body: string,
	headers: Record<string, string> = {},
): Partial<IncomingMessage> {
	const listeners: Record<string, Function[]> = {};

	return {
		statusCode,
		statusMessage: statusCode >= 400 ? 'Error' : 'OK',
		headers,
		on(event: string, callback: Function) {
			if (!listeners[event]) {
				listeners[event] = [];
			}
			listeners[event].push(callback);
			return this as any;
		},
		emit(event: string, ...args: unknown[]) {
			if (listeners[event]) {
				listeners[event].forEach((cb) => cb(...args));
			}
			return true;
		},
	} as any;
}

// Helper to create mock ClientRequest with event listeners
function createMockClientRequest(): Partial<ClientRequest> {
	const listeners: Record<string, Function[]> = {};

	return {
		write: vi.fn(),
		end: vi.fn(),
		destroy: vi.fn(),
		setTimeout: vi.fn() as any,
		on(event: string, callback: Function) {
			if (!listeners[event]) {
				listeners[event] = [];
			}
			listeners[event].push(callback);
			return this as any;
		},
		emit(event: string, ...args: unknown[]) {
			if (listeners[event]) {
				listeners[event].forEach((cb) => cb(...args));
			}
			return true;
		},
	} as any;
}

// Create a test helper that properly chains the mocked HTTP call
function setupHttpMock(
	statusCode: number,
	body: string,
	headers?: Record<string, string>,
	options?: { delayMs?: number; shouldError?: Error; shouldTimeout?: boolean },
): { mockReq: any; mockRes: any; handler: any } {
	const mockReq = createMockClientRequest() as any;
	const mockRes = createMockIncomingMessage(statusCode, body, headers) as any;
	const delay = options?.delayMs ?? 0;

	const handler = (_opts: any, callback: any) => {
		// Call the callback synchronously with the response
		callback(mockRes);

		if (options?.shouldError) {
			if (delay > 0) {
				setTimeout(() => mockReq.emit('error', options.shouldError), delay);
			} else {
				setImmediate(() => mockReq.emit('error', options.shouldError));
			}
		} else if (options?.shouldTimeout) {
			if (delay > 0) {
				setTimeout(() => mockReq.emit('timeout'), delay);
			} else {
				setImmediate(() => mockReq.emit('timeout'));
			}
		} else {
			// Emit data events
			if (delay > 0) {
				setTimeout(() => {
					if (body) {
						mockRes.emit('data', Buffer.from(body));
					}
					mockRes.emit('end');
				}, delay);
			} else {
				setImmediate(() => {
					if (body) {
						mockRes.emit('data', Buffer.from(body));
					}
					mockRes.emit('end');
				});
			}
		}

		return mockReq;
	};

	return { mockReq, mockRes, handler };
}

describe('HttpClientService', () => {
	let service: HttpClientService;
	let mockLogger: any;
	let contextualLogger: any;
	let mockModuleRef: Partial<ModuleRef>;

	beforeEach(() => {
		vi.clearAllMocks();

		contextualLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
		};

		mockLogger = {
			createContextualLogger: vi.fn(() => contextualLogger),
			debug: vi.fn(),
			info: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
		};

		mockModuleRef = {
			get: vi.fn(() => mockLogger),
		};

		service = new HttpClientService(mockModuleRef as ModuleRef);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Service initialization', () => {
		it('should be defined', () => {
			expect(service).toBeDefined();
		});

		it('should have request method', () => {
			expect(typeof service.request).toBe('function');
		});

		it('should have get shortcut method', () => {
			expect(typeof service.get).toBe('function');
		});

		it('should have post shortcut method', () => {
			expect(typeof service.Post).toBe('function');
		});

		it('should have put shortcut method', () => {
			expect(typeof service.put).toBe('function');
		});

		it('should have delete shortcut method', () => {
			expect(typeof service.delete).toBe('function');
		});
	});

	describe('Logger lazy initialization', () => {
		it('should lazily initialize logger on first access', () => {
			expect(mockLogger.createContextualLogger).not.toHaveBeenCalled();

			const logger = service.Logger;

			expect(logger).toBeDefined();
			expect(mockLogger.createContextualLogger).toHaveBeenCalledWith('HttpClientService');
		});

		it('should cache logger after first access', () => {
			const logger1 = service.Logger;
			const logger2 = service.Logger;

			expect(logger1).toBe(logger2);
			expect(mockLogger.createContextualLogger).toHaveBeenCalledTimes(1);
		});
	});

	describe('HTTP request method - GET requests', () => {
		it('should make successful GET request over HTTP', async () => {
			const responseBody = '{"result":"success"}';
			const { handler } = setupHttpMock(200, responseBody, {
				'content-type': 'application/json',
			});

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result).toBeDefined();
			expect(result.status).toBe(200);
			expect(result.statusText).toBe('OK');
			expect(result.data).toEqual({ result: 'success' });
			expect(result.duration).toBeGreaterThanOrEqual(0);
			expect(http.request).toHaveBeenCalled();
		});

		it('should make successful GET request over HTTPS', async () => {
			const responseBody = '{"secure":true}';
			const { handler } = setupHttpMock(200, responseBody, {
				'content-type': 'application/json',
			});

			vi.mocked(https.request).mockImplementation(handler);

			const result = await service.request({
				method: 'GET',
				url: 'https://api.example.com/test',
			});

			expect(result).toBeDefined();
			expect(result.status).toBe(200);
			expect(result.data).toEqual({ secure: true });
			expect(https.request).toHaveBeenCalled();
		});

		it('should include custom headers in GET request', async () => {
			const responseBody = '{}';
			const { handler } = setupHttpMock(200, responseBody);
			let capturedOptions: any;

			vi.mocked(http.request).mockImplementation((options: any, callback: any) => {
				capturedOptions = options;
				return handler(options, callback);
			});

			const customHeaders = {
				'Authorization': 'Bearer token123',
				'X-Custom-Header': 'custom-value',
			};

			await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
				headers: customHeaders,
			});

			expect(capturedOptions.headers).toEqual(
				expect.objectContaining(customHeaders),
			);
		});

		it('should handle empty response body', async () => {
			const { handler } = setupHttpMock(204, '');

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result.status).toBe(204);
			expect(result.data).toBeNull();
		});
	});

	describe('HTTP request method - POST requests', () => {
		it('should make POST request with object body', async () => {
			const responseBody = '{"id":123}';
			const { handler, mockReq } = setupHttpMock(201, responseBody, { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation(handler);

			const requestBody = { name: 'test', value: 42 };

			const result = await service.request({
				method: 'POST',
				url: 'http://api.example.com/users',
				data: requestBody,
			});

			expect(result.status).toBe(201);
			expect(result.data).toEqual({ id: 123 });
			expect(mockReq.write).toHaveBeenCalledWith(
				expect.stringContaining('"name":"test"'),
			);
			expect(mockReq.end).toHaveBeenCalled();
		});

		it('should make POST request with string body', async () => {
			const responseBody = '{"ok":true}';
			const { handler, mockReq } = setupHttpMock(200, responseBody);

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'POST',
				url: 'http://api.example.com/test',
				data: 'raw string data',
			});

			expect(result.status).toBe(200);
			expect(mockReq.write).toHaveBeenCalledWith('raw string data');
		});

		it('should not write body for POST without data', async () => {
			const responseBody = '{}';
			const { handler, mockReq } = setupHttpMock(200, responseBody);

			vi.mocked(http.request).mockImplementation(handler);

			await service.request({
				method: 'POST',
				url: 'http://api.example.com/test',
			});

			expect(mockReq.write).not.toHaveBeenCalled();
		});
	});

	describe('HTTP request method - PUT/PATCH/DELETE', () => {
		it('should make PUT request', async () => {
			const responseBody = '{"updated":true}';
			const { handler } = setupHttpMock(200, responseBody, { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'PUT',
				url: 'http://api.example.com/item/1',
				data: { name: 'updated' },
			});

			expect(result.status).toBe(200);
			expect(result.data).toEqual({ updated: true });
		});

		it('should make DELETE request', async () => {
			const responseBody = '{"deleted":true}';
			const { handler } = setupHttpMock(200, responseBody, { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'DELETE',
				url: 'http://api.example.com/item/1',
			});

			expect(result.status).toBe(200);
			expect(result.data).toEqual({ deleted: true });
		});

		it('should make PATCH request', async () => {
			const responseBody = '{"patched":true}';
			const { handler } = setupHttpMock(200, responseBody);

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'PATCH',
				url: 'http://api.example.com/item/1',
				data: { status: 'active' },
			});

			expect(result.status).toBe(200);
		});
	});

	describe('Response handling - Content-Type parsing', () => {
		it('should parse JSON responses', async () => {
			const responseBody = '{"user":"john","age":30}';
			const { handler } = setupHttpMock(200, responseBody, {
				'content-type': 'application/json',
			});

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result.data).toEqual({ user: 'john', age: 30 });
		});

		it('should handle text/plain responses', async () => {
			const responseBody = 'Hello, World!';
			const { handler } = setupHttpMock(200, responseBody, {
				'content-type': 'text/plain',
			});

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result.data).toBe('Hello, World!');
		});

		it('should handle text/html responses', async () => {
			const responseBody = '<html><body>Test</body></html>';
			const { handler } = setupHttpMock(200, responseBody, {
				'content-type': 'text/html',
			});

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result.data).toBe(responseBody);
		});

		it('should return raw body for unknown content-type', async () => {
			const responseBody = 'some-binary-data';
			const { handler } = setupHttpMock(200, responseBody, {
				'content-type': 'application/octet-stream',
			});

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result.data).toBe(responseBody);
		});

		it('should handle missing content-type header', async () => {
			const responseBody = '{"fallback":"data"}';
			const { handler } = setupHttpMock(200, responseBody);

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result.data).toBe(responseBody);
		});
	});

	describe('Response handling - Multiple chunks', () => {
		it('should concatenate multiple data chunks', async () => {
			setupHttpMock(200, '', {
				'content-type': 'application/json',
			});

			vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
				const mockReq = createMockClientRequest() as any;
				const mockRes = createMockIncomingMessage(200, '', {
					'content-type': 'application/json',
				}) as any;

				callback(mockRes);

				setImmediate(() => {
					mockRes.emit('data', Buffer.from('{"user'));
					mockRes.emit('data', Buffer.from('":"john"'));
					mockRes.emit('data', Buffer.from('}'));
					mockRes.emit('end');
				});

				return mockReq;
			});

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result.data).toEqual({ user: 'john' });
		});

		it('should handle large responses with multiple chunks', async () => {
			vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
				const mockReq = createMockClientRequest() as any;
				const mockRes = createMockIncomingMessage(200, '') as any;

				callback(mockRes);

				setImmediate(() => {
					for (let i = 0; i < 100; i++) {
						mockRes.emit('data', Buffer.from('chunk' + i));
					}
					mockRes.emit('end');
				});

				return mockReq;
			});

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/large',
			});

			expect(result.data).toBeDefined();
			expect(typeof result.data).toBe('string');
		});
	});

	describe('Status codes and headers handling', () => {
		it('should preserve response headers', async () => {
			const responseBody = '{}';
			const responseHeaders = {
				'content-type': 'application/json',
				'x-rate-limit': '100',
				'cache-control': 'no-cache',
				'x-request-id': 'abc123',
			};
			const { handler } = setupHttpMock(200, responseBody, responseHeaders);

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result.headers).toEqual(responseHeaders);
		});

		it('should handle 2xx status codes', async () => {
			const statusCodes = [200, 201, 202, 204];

			for (const statusCode of statusCodes) {
				const body = statusCode === 204 ? '' : '{}';
				const { handler } = setupHttpMock(statusCode, body);

				vi.mocked(http.request).mockImplementation(handler);

				const result = await service.request({
					method: 'GET',
					url: 'http://api.example.com/test',
				});

				expect(result.status).toBe(statusCode);
			}
		});

		it('should handle 4xx status codes', async () => {
			const statusCodes = [400, 401, 403, 404, 409];

			for (const statusCode of statusCodes) {
				const { handler } = setupHttpMock(
					statusCode,
					JSON.stringify({ error: 'Error' }),
				);

				vi.mocked(http.request).mockImplementation(handler);

				const result = await service.request({
					method: 'GET',
					url: 'http://api.example.com/test',
				});

				expect(result.status).toBe(statusCode);
			}
		});

		it('should handle 5xx status codes', async () => {
			const statusCodes = [500, 502, 503, 504];

			for (const statusCode of statusCodes) {
				const { handler } = setupHttpMock(
					statusCode,
					JSON.stringify({ error: 'Server Error' }),
				);

				vi.mocked(http.request).mockImplementation(handler);

				const result = await service.request({
					method: 'GET',
					url: 'http://api.example.com/test',
				});

				expect(result.status).toBe(statusCode);
			}
		});

		it('should use default statusCode if undefined', async () => {
			vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
				const mockReq = createMockClientRequest() as any;
				const mockRes = createMockIncomingMessage(200, '{}') as any;
				mockRes.statusCode = undefined;

				callback(mockRes);

				setImmediate(() => {
					mockRes.emit('data', Buffer.from('{}'));
					mockRes.emit('end');
				});

				return mockReq;
			});

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result.status).toBe(200);
		});
	});

	describe('Error handling - Request errors', () => {
		it('should reject on request error', async () => {
			const testError = new Error('Connection refused');
			const { handler } = setupHttpMock(200, '', undefined, {
				shouldError: testError,
			});

			vi.mocked(http.request).mockImplementation(handler);

			await expect(
				service.request({
					method: 'GET',
					url: 'http://api.example.com/test',
				}),
			).rejects.toThrow('Connection refused');

			expect(contextualLogger.error).toHaveBeenCalled();
		});

		it('should reject on response error event', async () => {
			const testError = new Error('Stream error');
			vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
				const mockReq = createMockClientRequest() as any;
				const mockRes = createMockIncomingMessage(200, '') as any;

				callback(mockRes);

				setImmediate(() => {
					mockRes.emit('error', testError);
				});

				return mockReq;
			});

			await expect(
				service.request({
					method: 'GET',
					url: 'http://api.example.com/test',
				}),
			).rejects.toThrow('Stream error');
		});

		it('should reject on timeout', async () => {
			const { handler, mockReq } = setupHttpMock(200, '', undefined, {
				shouldTimeout: true,
			});

			vi.mocked(http.request).mockImplementation(handler);

			await expect(
				service.request({
					method: 'GET',
					url: 'http://api.example.com/test',
					timeout: 5000,
				}),
			).rejects.toThrow('Request timeout');

			expect(mockReq.destroy).toHaveBeenCalled();
			expect(contextualLogger.warn).toHaveBeenCalled();
		});

		it('should reject on JSON parse error', async () => {
			const responseBody = '{invalid json}';
			const { handler } = setupHttpMock(200, responseBody, {
				'content-type': 'application/json',
			});

			vi.mocked(http.request).mockImplementation(handler);

			await expect(
				service.request({
					method: 'GET',
					url: 'http://api.example.com/test',
				}),
			).rejects.toThrow();

			expect(contextualLogger.error).toHaveBeenCalledWith(
				expect.stringContaining('HTTP response parsing failed'),
				expect.any(String),
			);
		});
	});

	describe('Payload size validation', () => {
		it('should reject payload exceeding size limit on data event', async () => {
			vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
				const mockReq = createMockClientRequest() as any;
				const mockRes = createMockIncomingMessage(200, '') as any;

				callback(mockRes);

				setImmediate(() => {
					const largeBuffer = Buffer.alloc(10_485_761);
					mockRes.emit('data', largeBuffer);
				});

				return mockReq;
			});

			await expect(
				service.request({
					method: 'GET',
					url: 'http://api.example.com/large',
				}),
			).rejects.toThrow('Payload too large');

			expect(contextualLogger.error).toHaveBeenCalledWith(
				expect.stringContaining('HTTP response payload exceeded size limit'),
				expect.any(String),
			);
		});

		it('should reject payload exceeding size limit on end event', async () => {
			vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
				const mockReq = createMockClientRequest() as any;
				const mockRes = createMockIncomingMessage(200, '') as any;

				callback(mockRes);

				setImmediate(() => {
					for (let i = 0; i < 11; i++) {
						mockRes.emit('data', Buffer.alloc(1_000_000));
					}
					mockRes.emit('end');
				});

				return mockReq;
			});

			await expect(
				service.request({
					method: 'GET',
					url: 'http://api.example.com/large',
				}),
			).rejects.toThrow('Payload too large');
		});

		it('should accept payload at exactly 10MB limit', async () => {
			vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
				const mockReq = createMockClientRequest() as any;
				const mockRes = createMockIncomingMessage(200, '') as any;

				callback(mockRes);

				setImmediate(() => {
					mockRes.emit('data', Buffer.alloc(10_485_760));
					mockRes.emit('end');
				});

				return mockReq;
			});

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/large',
			});

			expect(result).toBeDefined();
		});
	});

	describe('Timeout handling', () => {
		it('should apply default timeout', async () => {
			let capturedOptions: any;
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation((options: any, callback: any) => {
				capturedOptions = options;
				return handler(options, callback);
			});

			await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(capturedOptions.timeout).toBeDefined();
			expect(typeof capturedOptions.timeout).toBe('number');
			expect(capturedOptions.timeout).toBeGreaterThan(0);
		});

		it('should apply custom timeout', async () => {
			const customTimeout = 3000;
			let capturedOptions: any;
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation((options: any, callback: any) => {
				capturedOptions = options;
				return handler(options, callback);
			});

			await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
				timeout: customTimeout,
			});

			expect(capturedOptions.timeout).toBe(customTimeout);
		});

		it('should measure request duration', async () => {
			const { handler } = setupHttpMock(200, '{}', undefined, { delayMs: 50 });

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result.duration).toBeGreaterThanOrEqual(40);
			expect(typeof result.duration).toBe('number');
		});
	});

	describe('HTTPS specific options', () => {
		it('should pass rejectUnauthorized option to HTTPS', async () => {
			let capturedOptions: any;
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(https.request).mockImplementation((options: any, callback: any) => {
				capturedOptions = options;
				return handler(options, callback);
			});

			await service.request({
				method: 'GET',
				url: 'https://api.example.com/test',
				rejectUnauthorized: false,
			});

			expect(capturedOptions.rejectUnauthorized).toBe(false);
		});

		it('should default rejectUnauthorized to true', async () => {
			let capturedOptions: any;
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(https.request).mockImplementation((options: any, callback: any) => {
				capturedOptions = options;
				return handler(options, callback);
			});

			await service.request({
				method: 'GET',
				url: 'https://api.example.com/test',
			});

			expect(capturedOptions.rejectUnauthorized).toBe(true);
		});

		it('should pass CA certificate option to HTTPS', async () => {
			let capturedOptions: any;
			const caCert = Buffer.from('-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----');
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(https.request).mockImplementation((options: any, callback: any) => {
				capturedOptions = options;
				return handler(options, callback);
			});

			await service.request({
				method: 'GET',
				url: 'https://api.example.com/test',
				ca: caCert,
			});

			expect(capturedOptions.ca).toBe(caCert);
		});

		it('should not set HTTPS options for HTTP requests', async () => {
			let capturedOptions: any;
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation((options: any, callback: any) => {
				capturedOptions = options;
				return handler(options, callback);
			});

			await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
				rejectUnauthorized: false,
				ca: Buffer.from('test'),
			});

			expect(capturedOptions.rejectUnauthorized).toBeUndefined();
			expect(capturedOptions.ca).toBeUndefined();
		});
	});

	describe('Correlation ID handling', () => {
		it('should include correlation ID in logs', async () => {
			const correlationId = 'corr-123-abc';
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation(handler);

			await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
				correlationId,
			});

			expect(contextualLogger.debug).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining(correlationId),
			);
		});

		it('should handle missing correlation ID', async () => {
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation(handler);

			await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(contextualLogger.debug).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining('unknown'),
			);
		});
	});

	describe('HTTP method shortcuts', () => {
		it('should provide get() shortcut that calls request with GET', async () => {
			const { handler } = setupHttpMock(200, '{"data":"test"}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation((options: any, callback: any) => {
				expect(options.method).toBe('GET');
				return handler(options, callback);
			});

			const result = await service.get('http://api.example.com/data');

			expect(result.data).toEqual({ data: 'test' });
		});

		it('should provide post() shortcut that calls request with POST', async () => {
			const { handler } = setupHttpMock(201, '{"id":1}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation((options: any, callback: any) => {
				expect(options.method).toBe('POST');
				return handler(options, callback);
			});

			const result = await service.Post('http://api.example.com/items', { name: 'test' });

			expect(result.status).toBe(201);
		});

		it('should provide put() shortcut that calls request with PUT', async () => {
			const { handler } = setupHttpMock(200, '{"updated":true}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation((options: any, callback: any) => {
				expect(options.method).toBe('PUT');
				return handler(options, callback);
			});

			const result = await service.put('http://api.example.com/items/1', { name: 'updated' });

			expect(result.data).toEqual({ updated: true });
		});

		it('should provide delete() shortcut that calls request with DELETE', async () => {
			const { handler } = setupHttpMock(200, '{"deleted":true}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation((options: any, callback: any) => {
				expect(options.method).toBe('DELETE');
				return handler(options, callback);
			});

			const result = await service.delete('http://api.example.com/items/1');

			expect(result.data).toEqual({ deleted: true });
		});

		it('should pass options through shortcut methods', async () => {
			let capturedHeaders: any;
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation((options: any, callback: any) => {
				capturedHeaders = options.headers;
				return handler(options, callback);
			});

			const customHeaders = { 'X-Custom': 'value' };

			await service.get('http://api.example.com/test', { headers: customHeaders });

			expect(capturedHeaders).toEqual(expect.objectContaining(customHeaders));
		});
	});

	describe('URL parsing', () => {
		it('should correctly parse HTTP URL', async () => {
			let capturedOptions: any;
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation((options: any, callback: any) => {
				capturedOptions = options;
				return handler(options, callback);
			});

			await service.request({
				method: 'GET',
				url: 'http://api.example.com:8080/path/to/resource?query=value',
			});

			expect(capturedOptions.hostname).toBe('api.example.com');
			expect(capturedOptions.port).toBe('8080');
			expect(capturedOptions.path).toContain('/path/to/resource');
		});

		it('should correctly parse HTTPS URL', async () => {
			let capturedOptions: any;
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(https.request).mockImplementation((options: any, callback: any) => {
				capturedOptions = options;
				return handler(options, callback);
			});

			await service.request({
				method: 'GET',
				url: 'https://secure.example.com:443/api/v1/users',
			});

			expect(capturedOptions.hostname).toBe('secure.example.com');
			expect(https.request).toHaveBeenCalled();
		});
	});

	describe('Logging', () => {
		it('should log request details at debug level', async () => {
			const { handler } = setupHttpMock(200, '{}');

			vi.mocked(http.request).mockImplementation(handler);

			await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
				headers: { Authorization: 'Bearer token' },
			});

			expect(contextualLogger.debug).toHaveBeenCalledWith(
				'Making HTTP request',
				expect.any(String),
			);
		});

		it('should log successful response at info level', async () => {
			const { handler } = setupHttpMock(200, '{}');

			vi.mocked(http.request).mockImplementation(handler);

			await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(contextualLogger.info).toHaveBeenCalledWith(
				'HTTP request successful',
				expect.any(String),
			);
		});

		it('should log request error at error level', async () => {
			const testError = new Error('Test error');
			const { handler } = setupHttpMock(200, '', undefined, {
				shouldError: testError,
			});

			vi.mocked(http.request).mockImplementation(handler);

			try {
				await service.request({
					method: 'GET',
					url: 'http://api.example.com/test',
				});
			} catch {
				// Expected
			}

			expect(contextualLogger.error).toHaveBeenCalledWith(
				'HTTP request failed',
				expect.any(String),
			);
		});

		it('should log timeout at warn level', async () => {
			const { handler } = setupHttpMock(200, '', undefined, {
				shouldTimeout: true,
			});

			vi.mocked(http.request).mockImplementation(handler);

			try {
				await service.request({
					method: 'GET',
					url: 'http://api.example.com/test',
				});
			} catch {
				// Expected
			}

			expect(contextualLogger.warn).toHaveBeenCalledWith(
				'HTTP request timeout',
				expect.any(String),
			);
		});

		it('should sanitize authorization headers in logs', async () => {
			const { handler } = setupHttpMock(200, '{}');

			vi.mocked(http.request).mockImplementation(handler);

			await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
				headers: {
					Authorization: 'Bearer secret-token',
					'X-API-Key': 'api-key-secret',
					Cookie: 'session=secret',
					'X-Custom': 'not-sensitive',
				},
			});

			// eslint-disable-next-line prefer-destructuring
			const [, debugMessage] = contextualLogger.debug.mock.calls[0];
			const loggedHeaders = JSON.parse(debugMessage).headers;
			expect(loggedHeaders.Authorization).toBe('[REDACTED]');
			expect(loggedHeaders['X-API-Key']).toBe('[REDACTED]');
			expect(loggedHeaders.Cookie).toBe('[REDACTED]');
			expect(loggedHeaders['X-Custom']).toBe('not-sensitive');
		});
	});

	describe('Edge cases', () => {
		it('should handle response with no status code', async () => {
			vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
				const mockReq = createMockClientRequest() as any;
				const mockRes = createMockIncomingMessage(200, '{}') as any;
				delete mockRes.statusCode;

				callback(mockRes);

				setImmediate(() => {
					mockRes.emit('data', Buffer.from('{}'));
					mockRes.emit('end');
				});

				return mockReq;
			});

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result.status).toBe(200);
		});

		it('should handle response with no status message', async () => {
			vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
				const mockReq = createMockClientRequest() as any;
				const mockRes = createMockIncomingMessage(200, '{}') as any;
				delete mockRes.statusMessage;

				callback(mockRes);

				setImmediate(() => {
					mockRes.emit('data', Buffer.from('{}'));
					mockRes.emit('end');
				});

				return mockReq;
			});

			const result = await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
			});

			expect(result.statusText).toBe('OK');
		});

		it('should handle empty data object', async () => {
			const { handler } = setupHttpMock(200, '');

			vi.mocked(http.request).mockImplementation(handler);

			const result = await service.request({
				method: 'POST',
				url: 'http://api.example.com/test',
			});

			expect(result.data).toBeNull();
		});
	});

	describe('Private method coverage - sanitizeHeaders', () => {
		it('should sanitize sensitive headers case-insensitively', async () => {
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation(handler);

			await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
				headers: {
					authorization: 'Bearer token',
					'X-API-KEY': 'secret',
					COOKIE: 'session=abc',
				},
			});

			// eslint-disable-next-line prefer-destructuring
			const [, debugMessage] = contextualLogger.debug.mock.calls[0];
			const loggedHeaders = JSON.parse(debugMessage).headers;
			expect(loggedHeaders.authorization).toBe('[REDACTED]');
			expect(loggedHeaders['X-API-KEY']).toBe('[REDACTED]');
			expect(loggedHeaders.COOKIE).toBe('[REDACTED]');
		});

		it('should leave non-sensitive headers unchanged', async () => {
			const { handler } = setupHttpMock(200, '{}', { 'content-type': 'application/json' });

			vi.mocked(http.request).mockImplementation(handler);

			await service.request({
				method: 'GET',
				url: 'http://api.example.com/test',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					'IUser-Agent': 'MyAgent/1.0',
				},
			});

			// eslint-disable-next-line prefer-destructuring
			const [, debugMessage] = contextualLogger.debug.mock.calls[0];
			const loggedHeaders = JSON.parse(debugMessage).headers;
			expect(loggedHeaders['Content-Type']).toBe('application/json');
			expect(loggedHeaders.Accept).toBe('application/json');
			expect(loggedHeaders['IUser-Agent']).toBe('MyAgent/1.0');
		});
	});
});
