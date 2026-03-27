import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { BsonResponseInterceptor } from '../bson-response.interceptor.js';
import { BsonSerializationService } from '../bson-serialization.service.js';
import { of } from 'rxjs';

describe('BsonResponseInterceptor', () => {
	let interceptor: BsonResponseInterceptor;
	let bsonService: BsonSerializationService;
	let mockContext: Partial<ExecutionContext>;
	let mockCallHandler: Partial<CallHandler>;
	let mockResponse: any;
	let mockRequest: any;

	beforeEach(() => {
		bsonService = new BsonSerializationService();
		const mockModuleRef = {
			get: vi.fn().mockReturnValue(bsonService),
		} as any;
		interceptor = new BsonResponseInterceptor(mockModuleRef);

		mockResponse = {
			setHeader: vi.fn(),
			end: vi.fn(),
			json: vi.fn(),
		};

		mockRequest = {
			get: vi.fn().mockReturnValue('application/json'),
		};

		mockContext = {
			switchToHttp: vi.fn().mockReturnValue({
				getResponse: vi.fn().mockReturnValue(mockResponse),
				getRequest: vi.fn().mockReturnValue(mockRequest),
			}),
		} as any;

		mockCallHandler = {
			handle: vi.fn(),
		} as any;
	});

	describe('JSON responses (default)', () => {
		it('should pass through for JSON Accept header', async () => {
			const data = { query: 'test', result: 'success' };

			mockRequest.get.mockReturnValue('application/json');
			(mockCallHandler.handle as any).mockReturnValue(of(data));

			await new Promise<void>((resolve) => {
				interceptor.intercept(mockContext as ExecutionContext, mockCallHandler as CallHandler).subscribe({
					next: () => {
						expect(mockResponse.setHeader).not.toHaveBeenCalledWith('Content-Type', 'application/bson');
						resolve();
					},
				});
			});
		});

		it('should not set BSON headers for missing Accept header', async () => {
			const data = { query: 'test' };

			mockRequest.get.mockReturnValue(undefined);
			(mockCallHandler.handle as any).mockReturnValue(of(data));

			await new Promise<void>((resolve) => {
				interceptor.intercept(mockContext as ExecutionContext, mockCallHandler as CallHandler).subscribe({
					next: () => {
						expect(mockResponse.setHeader).not.toHaveBeenCalledWith('Content-Type', 'application/bson');
						resolve();
					},
				});
			});
		});
	});

	describe('BSON responses', () => {
		it('should serialize response to BSON when Accept header includes application/bson', async () => {
			const data = { hello: 'world', number: 42 };

			mockRequest.get.mockReturnValue('application/bson');
			(mockCallHandler.handle as any).mockReturnValue(of(data));

			await new Promise((resolve) => {
				interceptor.intercept(mockContext as ExecutionContext, mockCallHandler as CallHandler).subscribe({
					next: () => {
						expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/bson');
						expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Length', expect.any(Number));
						expect(mockResponse.end).toHaveBeenCalled();
						resolve(null);
					},
				});
			});
		});

		it('should set Content-Length header with buffer size', async () => {
			const data = { test: 'data' };

			mockRequest.get.mockReturnValue('application/bson');
			(mockCallHandler.handle as any).mockReturnValue(of(data));

			await new Promise((resolve) => {
				interceptor.intercept(mockContext as ExecutionContext, mockCallHandler as CallHandler).subscribe({
					next: () => {
						const { calls } = mockResponse.setHeader.mock;
						const contentLengthCall = calls.find((call: any) => call[0] === 'Content-Length');

						expect(contentLengthCall).toBeDefined();
						expect(contentLengthCall[1]).toBeGreaterThan(0);
						resolve(null);
					},
				});
			});
		});

		it('should send buffer directly to response', async () => {
			const data = { graphql: 'response' };

			mockRequest.get.mockReturnValue('application/bson');
			(mockCallHandler.handle as any).mockReturnValue(of(data));

			await new Promise((resolve) => {
				interceptor.intercept(mockContext as ExecutionContext, mockCallHandler as CallHandler).subscribe({
					next: () => {
						expect(mockResponse.end).toHaveBeenCalledWith(expect.any(Buffer));
						resolve(null);
					},
				});
			});
		});

		it('should be case-insensitive for Accept header', async () => {
			const data = { test: 'case' };

			mockRequest.get.mockReturnValue('Application/BSON');
			(mockCallHandler.handle as any).mockReturnValue(of(data));

			await new Promise((resolve) => {
				interceptor.intercept(mockContext as ExecutionContext, mockCallHandler as CallHandler).subscribe({
					next: () => {
						expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/bson');
						resolve(null);
					},
				});
			});
		});

		it('should handle complex GraphQL responses', async () => {
			const data = {
				data: {
					user: {
						id: '123',
						name: 'John Doe',
						email: 'john@example.com',
						posts: [
							{ id: '1', title: 'Post 1' },
							{ id: '2', title: 'Post 2' },
						],
					},
				},
			};

			mockRequest.get.mockReturnValue('application/bson');
			(mockCallHandler.handle as any).mockReturnValue(of(data));

			await new Promise((resolve) => {
				interceptor.intercept(mockContext as ExecutionContext, mockCallHandler as CallHandler).subscribe({
					next: () => {
						expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/bson');
						expect(mockResponse.end).toHaveBeenCalled();
						resolve(null);
					},
				});
			});
		});
	});

	describe('error handling', () => {
		it('should fall back to JSON on serialization error', async () => {
			const data = { test: 'data' };

			mockRequest.get.mockReturnValue('application/bson');
			(mockCallHandler.handle as any).mockReturnValue(of(data));

			// Mock a serialization error
			vi.spyOn(bsonService, 'serialize').mockRejectedValueOnce(new Error('Serialization failed'));

			await new Promise((resolve) => {
				interceptor.intercept(mockContext as ExecutionContext, mockCallHandler as CallHandler).subscribe({
					next: () => {
						expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
						expect(mockResponse.json).toHaveBeenCalledWith(data);
						resolve(null);
					},
				});
			});
		});
	});
});
