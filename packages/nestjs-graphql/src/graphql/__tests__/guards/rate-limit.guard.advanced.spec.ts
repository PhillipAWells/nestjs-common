
import { vi } from 'vitest';
import { GraphQLRateLimitGuard } from '../../guards/rate-limit.guard.js';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

describe('GraphQL Rate Limit Guard - Advanced Rate Limiting', () => {
	let guard: GraphQLRateLimitGuard;
	let mockRateLimitService: any;
	let mockExecutionContext: any;
	let mockGqlContext: any;
	let mockRequest: any;
	let mockResponse: any;
	let responseHeaders: Record<string, any>;

	beforeEach(() => {
		responseHeaders = {};

		// Manual mock for RateLimitService
		mockRateLimitService = {
			CheckLimit: async (clientId: string) => {
				// Default: allow request
				if ((mockRateLimitService as any)._checkLimitOverride) {
					return (mockRateLimitService as any)._checkLimitOverride(clientId);
				}
				return {
					allowed: true,
					limit: 100,
					remaining: 95,
					resetTime: Date.now() + 60000,
				};
			},
			_checkLimitOverride: undefined as ((clientId: string) => any) | undefined,
		};

		// Manual mock for request/response
		mockRequest = {
			user: undefined,
			ip: '127.0.0.1',
		};

		mockResponse = {
			setHeader: (key: string, value: any) => {
				responseHeaders[key] = value;
			},
		};

		// Manual mock for GqlExecutionContext
		mockGqlContext = {
			getContext: () => ({
				req: mockRequest,
				res: mockResponse,
			}),
		};

		// Manual mock for ExecutionContext
		mockExecutionContext = {
			getHandler: () => ({}),
			getClass: () => ({}),
		};

		const mockModuleRef = {
			get: vi.fn().mockReturnValue(mockRateLimitService),
		} as any;
		guard = new GraphQLRateLimitGuard(mockModuleRef);

		// Mock GqlExecutionContext.create using vi.spyOn (required for static methods)
		vi.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext as any);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('canActivate() - Rate Limit Enforcement', () => {
		it('should allow request within rate limits', async () => {
			mockRateLimitService._checkLimitOverride = async () => ({
				allowed: true,
				limit: 100,
				remaining: 50,
				resetTime: Date.now() + 60000,
			});

			const result = await guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(result).toBe(true);
		});

		it('should throw HttpException when rate limit exceeded', async () => {
			const resetTime = Date.now() + 30000;
			mockRateLimitService._checkLimitOverride = async () => ({
				allowed: false,
				limit: 100,
				remaining: 0,
				resetTime,
			});

			await expect(
				guard.canActivate(mockExecutionContext as ExecutionContext),
			).rejects.toThrow(HttpException);
		});

		it('should include rate limit information in exception', async () => {
			const resetTime = Date.now() + 30000;
			mockRateLimitService._checkLimitOverride = async () => ({
				allowed: false,
				limit: 100,
				remaining: 0,
				resetTime,
			});

			try {
				await guard.canActivate(mockExecutionContext as ExecutionContext);
			} catch (error: any) {
				expect(error).toBeInstanceOf(HttpException);
				expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
				expect(error.getResponse()).toMatchObject({
					message: 'Rate limit exceeded',
					resetTime: new Date(resetTime),
					retryAfter: expect.any(Number),
				});
			}
		});

		it('should set rate limit headers on response', async () => {
			const resetTime = Date.now() + 60000;
			mockRateLimitService._checkLimitOverride = async () => ({
				allowed: true,
				limit: 100,
				remaining: 75,
				resetTime,
			});

			await guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(responseHeaders['X-RateLimit-Limit']).toBe(100);
			expect(responseHeaders['X-RateLimit-Remaining']).toBe(75);
			expect(responseHeaders['X-RateLimit-Reset']).toBe(new Date(resetTime).toISOString());
		});

		it('should use user ID as client identifier when authenticated', async () => {
			let capturedClientId: string | undefined;
			mockRateLimitService._checkLimitOverride = async (clientId: string) => {
				capturedClientId = clientId;
				return {
					allowed: true,
					limit: 100,
					remaining: 90,
					resetTime: Date.now() + 60000,
				};
			};

			mockRequest.user = { id: 'user-123' };

			await guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(capturedClientId).toBe('user:user-123');
		});

		it('should use user sub as client identifier when id not available', async () => {
			let capturedClientId: string | undefined;
			mockRateLimitService._checkLimitOverride = async (clientId: string) => {
				capturedClientId = clientId;
				return {
					allowed: true,
					limit: 100,
					remaining: 90,
					resetTime: Date.now() + 60000,
				};
			};

			mockRequest.user = { sub: 'sub-456' };

			await guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(capturedClientId).toBe('user:sub-456');
		});

		it('should use IP address as client identifier when not authenticated', async () => {
			let capturedClientId: string | undefined;
			mockRateLimitService._checkLimitOverride = async (clientId: string) => {
				capturedClientId = clientId;
				return {
					allowed: true,
					limit: 100,
					remaining: 90,
					resetTime: Date.now() + 60000,
				};
			};

			mockRequest.ip = '192.168.1.100';
			mockRequest.user = undefined;

			await guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(capturedClientId).toBe('ip:192.168.1.100');
		});

		it('should extract IP from X-Forwarded-For header', async () => {
			let capturedClientId: string | undefined;
			mockRateLimitService._checkLimitOverride = async (clientId: string) => {
				capturedClientId = clientId;
				return {
					allowed: true,
					limit: 100,
					remaining: 90,
					resetTime: Date.now() + 60000,
				};
			};

			mockRequest.ip = undefined;
			mockRequest.headers = {
				'x-forwarded-for': '10.0.0.1, 10.0.0.2',
			};

			await guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(capturedClientId).toBe('ip:10.0.0.1');
		});

		it('should throw SERVICE_UNAVAILABLE when rate limit check fails (fail closed)', async () => {
			mockRateLimitService._checkLimitOverride = async () => {
				throw new Error('Rate limit service unavailable');
			};

			await expect(guard.canActivate(mockExecutionContext as ExecutionContext))
				.rejects.toThrow('Rate limit service unavailable');
		});

		it('should not set headers when response is undefined', async () => {
			mockGqlContext.getContext = () => ({
				req: mockRequest,
				res: undefined,
			});

			const result = await guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(result).toBe(true);
			expect(Object.keys(responseHeaders).length).toBe(0);
		});
	});
});
