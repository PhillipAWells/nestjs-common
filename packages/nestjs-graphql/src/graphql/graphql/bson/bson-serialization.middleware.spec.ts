import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BsonSerializationMiddleware } from './bson-serialization.middleware.js';
import { BsonSerializationService } from './bson-serialization.service.js';
import { Request, Response } from 'express';

describe('BsonSerializationMiddleware', () => {
	let middleware: BsonSerializationMiddleware;
	let bsonService: BsonSerializationService;
	let mockRequest: Partial<Request>;
	let mockResponse: Partial<Response>;
	let nextFn: any;

	beforeEach(() => {
		bsonService = new BsonSerializationService();
		middleware = new BsonSerializationMiddleware(bsonService);

		nextFn = vi.fn();
		mockResponse = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis()
		};
	});

	describe('non-BSON requests', () => {
		it('should pass through when Content-Type is not application/bson', () => {
			mockRequest = {
				get: vi.fn().mockReturnValue('application/json'),
				on: vi.fn()
			} as any;

			middleware.use(mockRequest as Request, mockResponse as Response, nextFn);

			expect(nextFn).toHaveBeenCalled();
		});

		it('should pass through when Content-Type header is missing', () => {
			mockRequest = {
				get: vi.fn().mockReturnValue(undefined),
				on: vi.fn()
			} as any;

			middleware.use(mockRequest as Request, mockResponse as Response, nextFn);

			expect(nextFn).toHaveBeenCalled();
		});

		it('should be case-insensitive for Content-Type', () => {
			mockRequest = {
				get: vi.fn().mockReturnValue('Application/JSON'),
				on: vi.fn()
			} as any;

			middleware.use(mockRequest as Request, mockResponse as Response, nextFn);

			expect(nextFn).toHaveBeenCalled();
		});
	});

	describe('BSON requests', () => {
		it('should deserialize BSON body and set req.body', async () => {
			const testData = { hello: 'world', number: 42 };
			const buffer = await bsonService.serialize(testData);

			mockRequest = {
				get: vi.fn().mockReturnValue('application/bson'),
				on: vi.fn((event, handler) => {
					if (event === 'data') {
						// Simulate receiving chunks
						handler(buffer);
					} else if (event === 'end') {
						// Simulate end of stream
						handler();
					}
				}),
				body: undefined
			} as any;

			middleware.use(mockRequest as Request, mockResponse as Response, nextFn);

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(mockRequest.body).toEqual(testData);
			expect((mockRequest as any)._bsonRequest).toBe(true);
			expect(nextFn).toHaveBeenCalled();
		});

		it('should handle multiple data chunks', async () => {
			const testData = { test: 'data', array: [1, 2, 3] };
			const buffer = await bsonService.serialize(testData);

			// Split buffer into chunks
			const chunk1 = buffer.slice(0, Math.floor(buffer.length / 2));
			const chunk2 = buffer.slice(Math.floor(buffer.length / 2));

			mockRequest = {
				get: vi.fn().mockReturnValue('application/bson'),
				on: vi.fn((event, handler) => {
					if (event === 'data') {
						handler(chunk1);
						handler(chunk2);
					} else if (event === 'end') {
						handler();
					}
				}),
				body: undefined
			} as any;

			middleware.use(mockRequest as Request, mockResponse as Response, nextFn);

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(mockRequest.body).toEqual(testData);
			expect(nextFn).toHaveBeenCalled();
		});

		it('should return 400 on deserialization error', async () => {
			const invalidBuffer = Buffer.from([0x00, 0x01, 0x02]);

			mockRequest = {
				get: vi.fn().mockReturnValue('application/bson'),
				on: vi.fn((event, handler) => {
					if (event === 'data') {
						handler(invalidBuffer);
					} else if (event === 'end') {
						handler();
					}
				})
			} as any;

			middleware.use(mockRequest as Request, mockResponse as Response, nextFn);

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(mockResponse.status).toHaveBeenCalledWith(400);
			expect(mockResponse.json).toHaveBeenCalled();
		});

		it('should mark request with _bsonRequest flag', async () => {
			const testData = { test: 'flag' };
			const buffer = await bsonService.serialize(testData);

			mockRequest = {
				get: vi.fn().mockReturnValue('application/bson'),
				on: vi.fn((event, handler) => {
					if (event === 'data') {
						handler(buffer);
					} else if (event === 'end') {
						handler();
					}
				})
			} as any;

			middleware.use(mockRequest as Request, mockResponse as Response, nextFn);

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect((mockRequest as any)._bsonRequest).toBe(true);
		});
	});

	describe('error handling', () => {
		it('should handle request read errors', () => {
			const errorFn = vi.fn();
			mockRequest = {
				get: vi.fn().mockReturnValue('application/bson'),
				on: vi.fn((event, handler) => {
					if (event === 'error') {
						errorFn.mockImplementation(handler);
					}
				})
			} as any;

			middleware.use(mockRequest as Request, mockResponse as Response, nextFn);

			// Simulate error
			const testError = new Error('Read error');
			errorFn(testError);

			expect(mockResponse.status).toHaveBeenCalledWith(400);
			expect(mockResponse.json).toHaveBeenCalled();
		});
	});
});
