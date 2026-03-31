import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { vi as jest } from 'vitest';
import {
	DetectContextType,
	ExtractRequestFromContext,
	ExtractUserFromContext,
	ExtractAuthTokenFromContext,
} from '../context-utils.js';

function makeHttpCtx(request: any): ExecutionContext {
	return {
		getType: jest.fn().mockReturnValue('http'),
		switchToHttp: jest.fn().mockReturnValue({
			getRequest: () => request,
		}),
		switchToWs: jest.fn(),
	} as unknown as ExecutionContext;
}

function makeGraphQLCtx(req: any): ExecutionContext {
	const ctx = {
		getType: jest.fn().mockReturnValue('graphql'),
		switchToHttp: jest.fn(),
		switchToWs: jest.fn(),
	} as unknown as ExecutionContext;

	jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
		getContext: () => ({ req }),
	} as any);

	return ctx;
}

function makeWsCtx(client: any): ExecutionContext {
	return {
		getType: jest.fn().mockReturnValue('ws'),
		switchToHttp: jest.fn(),
		switchToWs: jest.fn().mockReturnValue({
			getClient: () => client,
		}),
	} as unknown as ExecutionContext;
}

describe('Context Utils', () => {
	describe('detectContextType', () => {
		it('should detect HTTP context', () => {
			const mockHttpCtx = {
				getType: jest.fn().mockReturnValue('http'),
			} as unknown as ExecutionContext;

			const result = DetectContextType(mockHttpCtx);
			expect(result).toBe('http');
		});

		it('should detect GraphQL context', () => {
			const mockGraphQLCtx = {
				getType: jest.fn().mockReturnValue('graphql'),
			} as unknown as ExecutionContext;

			const result = DetectContextType(mockGraphQLCtx);
			expect(result).toBe('graphql');
		});

		it('should detect WebSocket context', () => {
			const mockWsCtx = {
				getType: jest.fn().mockReturnValue('ws'),
			} as unknown as ExecutionContext;

			const result = DetectContextType(mockWsCtx);
			expect(result).toBe('websocket');
		});

		it('should default to http for unknown context type', () => {
			const mockUnknownCtx = {
				getType: jest.fn().mockReturnValue('unknown'),
			} as unknown as ExecutionContext;

			// The new implementation falls back to 'http' instead of throwing
			const result = DetectContextType(mockUnknownCtx);
			expect(result).toBe('http');
		});
	});

	describe('extractRequestFromContext', () => {
		it('should extract request from HTTP context', () => {
			const mockRequest = { user: { id: 1 } };
			const mockHttpCtx = makeHttpCtx(mockRequest);

			const result = ExtractRequestFromContext(mockHttpCtx);
			expect(result).toBe(mockRequest);
		});

		it('should extract request from GraphQL context', () => {
			const mockRequest = { user: { id: 1 } };
			const mockGraphQLCtx = makeGraphQLCtx(mockRequest);

			const result = ExtractRequestFromContext(mockGraphQLCtx);
			expect(result).toBe(mockRequest);
		});

		it('should extract client from WebSocket context', () => {
			const mockClient = { id: 'socket-1' };
			const mockWsCtx = makeWsCtx(mockClient);

			const result = ExtractRequestFromContext(mockWsCtx, { contextType: 'websocket' });
			expect(result).toBe(mockClient);
		});

		it('should throw error for unsupported context type', () => {
			const mockCtx = {} as ExecutionContext;

			expect(() => ExtractRequestFromContext(mockCtx, { contextType: 'unknown' as any, autoDetect: false })).toThrow('Unsupported context type: unknown');
		});

		it('should throw error when context type required but not specified', () => {
			const mockCtx = {} as ExecutionContext;

			expect(() => ExtractRequestFromContext(mockCtx, { autoDetect: false })).toThrow('Context type must be specified when autoDetect is false');
		});
	});

	describe('extractUserFromContext', () => {
		it('should extract user from HTTP context', () => {
			const mockUser = { id: 1, name: 'John' };
			const mockRequest = { user: mockUser };
			const mockHttpCtx = makeHttpCtx(mockRequest);

			const result = ExtractUserFromContext(mockHttpCtx);
			expect(result).toBe(mockUser);
		});

		it('should extract user property from context', () => {
			const mockUser = { id: 1, profile: { name: 'John' } };
			const mockRequest = { user: mockUser };
			const mockHttpCtx = makeHttpCtx(mockRequest);

			const result = ExtractUserFromContext(mockHttpCtx, { property: 'profile.name', contextType: 'http' });
			expect(result).toBe('John');
		});

		it('should return undefined when user not found', () => {
			const mockRequest = {};
			const mockHttpCtx = makeHttpCtx(mockRequest);

			const result = ExtractUserFromContext(mockHttpCtx);
			expect(result).toBeUndefined();
		});

		it('should return undefined when property not found', () => {
			const mockUser = { id: 1 };
			const mockRequest = { user: mockUser };
			const mockHttpCtx = makeHttpCtx(mockRequest);

			const result = ExtractUserFromContext(mockHttpCtx, { property: 'profile.name', contextType: 'http' });
			expect(result).toBeUndefined();
		});
	});

	describe('extractAuthTokenFromContext', () => {
		it('should extract token from Authorization header', () => {
			const mockRequest = {
				headers: { authorization: 'Bearer token123' },
			};
			const mockHttpCtx = makeHttpCtx(mockRequest);

			const result = ExtractAuthTokenFromContext(mockHttpCtx);
			expect(result).toBe('token123');
		});

		it('should extract token without Bearer prefix', () => {
			const mockRequest = {
				headers: { authorization: 'token123' },
			};
			const mockHttpCtx = makeHttpCtx(mockRequest);

			const result = ExtractAuthTokenFromContext(mockHttpCtx);
			expect(result).toBe('token123');
		});

		it('should handle case-insensitive header names', () => {
			const mockRequest = {
				headers: { Authorization: 'Bearer token123' },
			};
			const mockHttpCtx = makeHttpCtx(mockRequest);

			const result = ExtractAuthTokenFromContext(mockHttpCtx);
			expect(result).toBe('token123');
		});

		it('should return undefined when no authorization header', () => {
			const mockRequest = { headers: {} };
			const mockHttpCtx = makeHttpCtx(mockRequest);

			const result = ExtractAuthTokenFromContext(mockHttpCtx);
			expect(result).toBeUndefined();
		});

		it('should return undefined when request not found', () => {
			const mockHttpCtx = makeHttpCtx(null);

			const result = ExtractAuthTokenFromContext(mockHttpCtx);
			expect(result).toBeUndefined();
		});
	});
});
