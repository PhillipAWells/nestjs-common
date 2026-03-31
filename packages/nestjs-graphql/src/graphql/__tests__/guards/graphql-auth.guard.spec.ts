import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLAuthGuard } from '../../guards/graphql-auth.guard.js';

vi.mock('@nestjs/graphql', () => ({
	GqlExecutionContext: {
		create: vi.fn(),
	},
}));

describe('GraphQLAuthGuard', () => {
	let guard: GraphQLAuthGuard;
	let mockExecutionContext: any;
	let mockGqlContextData: any;
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

		mockGqlContextData = { req: mockRequest, user: null as any };

		vi.mocked(GqlExecutionContext.create).mockReturnValue({
			getContext: () => mockGqlContextData,
		} as any);

		mockExecutionContext = {};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('canActivate', () => {
		it('should allow access with valid Bearer token', () => {
			mockRequest.headers.authorization = 'Bearer valid-token';
			mockRequest.user = { id: 'user123' };

			const result = guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
			expect(mockGqlContextData.user).toEqual({ id: 'user123' });
		});

		it('should reject access without token', () => {
			mockRequest.headers = {};

			expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
			expect(() => guard.canActivate(mockExecutionContext)).toThrow('Authentication required');
		});

		it('should reject access with invalid token format', () => {
			mockRequest.headers.authorization = 'InvalidFormat token';

			expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
		});

		it('should reject access when user is not set on request', () => {
			mockRequest.headers.authorization = 'Bearer valid-token';
			mockRequest.user = null;

			expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
			expect(() => guard.canActivate(mockExecutionContext)).toThrow('Invalid authentication token');
		});
	});

	describe('extractTokenFromHeader', () => {
		it('should extract token from Bearer authorization header', () => {
			mockRequest.headers.authorization = 'Bearer test-token-123';

			const token = (guard as any).ExtractTokenFromHeader(mockRequest);

			expect(token).toBe('test-token-123');
		});

		it('should return null for capitalized Authorization header (Node.js lowercases headers)', () => {
			// Node.js normalizes all HTTP header names to lowercase;
			// a capitalized key set directly on the object is never seen in real requests.
			mockRequest.headers.Authorization = 'Bearer another-token';

			const token = (guard as any).ExtractTokenFromHeader(mockRequest);

			expect(token).toBeNull();
		});

		it('should return null for missing authorization header', () => {
			mockRequest.headers = {};

			const token = (guard as any).ExtractTokenFromHeader(mockRequest);

			expect(token).toBeNull();
		});

		it('should return null for non-Bearer authorization header', () => {
			mockRequest.headers.authorization = 'Basic dXNlcjpwYXNz';

			const token = (guard as any).ExtractTokenFromHeader(mockRequest);

			expect(token).toBeNull();
		});

		it('should return null for malformed Bearer header', () => {
			mockRequest.headers.authorization = 'Bearer';

			const token = (guard as any).ExtractTokenFromHeader(mockRequest);

			expect(token).toBeNull();
		});
	});

	describe('Guard structure', () => {
		it('should implement CanActivate without handleRequest (not a Passport AuthGuard)', () => {
			expect(typeof (guard as any).handleRequest).toBe('undefined');
			expect(typeof guard.canActivate).toBe('function');
		});
	});
});
