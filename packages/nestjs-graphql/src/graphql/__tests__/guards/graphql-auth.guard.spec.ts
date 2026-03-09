import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { GraphQLAuthGuard } from '../../guards/graphql-auth.guard.js';

describe('GraphQLAuthGuard', () => {
	let guard: GraphQLAuthGuard;
	let mockExecutionContext: any;
	let mockGqlContext: any;
	let mockRequest: any;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [GraphQLAuthGuard],
		}).compile();

		guard = module.get<GraphQLAuthGuard>(GraphQLAuthGuard);

		mockRequest = {
			headers: {},
			user: null,
		};

		mockGqlContext = {
			getContext: () => ({
				req: mockRequest,
				user: null,
			}),
		};

		mockExecutionContext = {};

		// Mock GqlExecutionContext.create
		(global as any).GqlExecutionContext = {
			create: () => mockGqlContext,
		};
	});

	describe('canActivate', () => {
		it('should allow access with valid Bearer token', async () => {
			mockRequest.headers.authorization = 'Bearer valid-token';
			mockRequest.user = { id: 'user123' };

			// Mock parent canActivate to succeed
			const parentCanActivate = vi.spyOn(Object.getPrototypeOf(guard), 'canActivate');
			parentCanActivate.mockResolvedValue(true);

			const result = await guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
			expect(mockGqlContext.getContext().user).toEqual({ id: 'user123' });
		});

		it('should reject access without token', async () => {
			mockRequest.headers = {};

			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Authentication required');
		});

		it('should reject access with invalid token format', async () => {
			mockRequest.headers.authorization = 'InvalidFormat token';

			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
		});

		it('should handle authentication failure from parent guard', async () => {
			mockRequest.headers.authorization = 'Bearer invalid-token';

			const parentCanActivate = vi.spyOn(Object.getPrototypeOf(guard), 'canActivate');
			parentCanActivate.mockRejectedValue(new Error('Invalid token'));

			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Invalid authentication token');
		});
	});

	describe('extractTokenFromHeader', () => {
		it('should extract token from Bearer authorization header', () => {
			mockRequest.headers.authorization = 'Bearer test-token-123';

			const token = (guard as any).extractTokenFromHeader(mockRequest);

			expect(token).toBe('test-token-123');
		});

		it('should extract token from Authorization header (capitalized)', () => {
			mockRequest.headers.Authorization = 'Bearer another-token';

			const token = (guard as any).extractTokenFromHeader(mockRequest);

			expect(token).toBe('another-token');
		});

		it('should return null for missing authorization header', () => {
			mockRequest.headers = {};

			const token = (guard as any).extractTokenFromHeader(mockRequest);

			expect(token).toBeNull();
		});

		it('should return null for non-Bearer authorization header', () => {
			mockRequest.headers.authorization = 'Basic dXNlcjpwYXNz';

			const token = (guard as any).extractTokenFromHeader(mockRequest);

			expect(token).toBeNull();
		});

		it('should return null for malformed Bearer header', () => {
			mockRequest.headers.authorization = 'Bearer';

			const token = (guard as any).extractTokenFromHeader(mockRequest);

			expect(token).toBeNull();
		});
	});

	describe('handleRequest', () => {
		it('should return user when authentication succeeds', () => {
			const user = { id: 'user123', email: 'test@example.com' };

			const result = (guard as any).handleRequest(null, user, null);

			expect(result).toBe(user);
		});

		it('should throw UnauthorizedException when user is null', () => {
			expect(() => (guard as any).handleRequest(null, null, null)).toThrow(UnauthorizedException);
		});

		it('should throw UnauthorizedException when error is provided', () => {
			const error = new Error('Auth failed');

			expect(() => (guard as any).handleRequest(error, null, null)).toThrow(UnauthorizedException);
		});

		it('should throw provided error when available', () => {
			const error = new Error('Custom auth error');

			expect(() => (guard as any).handleRequest(error, null, null)).toThrow(error);
		});
	});
});
