import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { jest } from '@jest/globals';
import {
	detectContextType,
	extractRequestFromContext,
	extractUserFromContext,
	extractAuthTokenFromContext
} from '../context-utils.js';

describe('Context Utils', () => {
	describe('detectContextType', () => {
		it('should detect HTTP context', () => {
			const mockHttpCtx = {
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: () => ({})
				}),
				switchToWs: jest.fn().mockImplementation(() => {
					throw new Error('Not WebSocket context');
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = detectContextType(mockHttpCtx);
			expect(result).toBe('http');
		});

		it('should detect GraphQL context', () => {
			const mockGraphQLCtx = {} as ExecutionContext;

			// Mock GqlExecutionContext.create to succeed
			jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
				getContext: () => ({})
			} as any);

			const result = detectContextType(mockGraphQLCtx);
			expect(result).toBe('graphql');
		});

		it('should detect WebSocket context', () => {
			const mockWsCtx = {
				switchToHttp: jest.fn().mockImplementation(() => {
					throw new Error('Not HTTP context');
				}),
				switchToWs: jest.fn().mockReturnValue({
					getClient: () => ({})
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = detectContextType(mockWsCtx);
			expect(result).toBe('websocket');
		});

		it('should throw error for unknown context', () => {
			const mockUnknownCtx = {
				switchToHttp: jest.fn().mockImplementation(() => {
					throw new Error('Not HTTP context');
				}),
				switchToWs: jest.fn().mockImplementation(() => {
					throw new Error('Not WebSocket context');
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			expect(() => detectContextType(mockUnknownCtx)).toThrow('Unable to determine execution context type');
		});
	});

	describe('extractRequestFromContext', () => {
		it('should extract request from HTTP context', () => {
			const mockRequest = { user: { id: 1 } };
			const mockHttpCtx = {
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: () => mockRequest
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = extractRequestFromContext(mockHttpCtx);
			expect(result).toBe(mockRequest);
		});

		it('should extract request from GraphQL context', () => {
			const mockRequest = { user: { id: 1 } };
			const mockGraphQLCtx = {} as ExecutionContext;

			// Mock GqlExecutionContext.create to return context with req
			jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
				getContext: () => ({ req: mockRequest })
			} as any);

			const result = extractRequestFromContext(mockGraphQLCtx);
			expect(result).toBe(mockRequest);
		});

		it('should extract client from WebSocket context', () => {
			const mockClient = { id: 'socket-1' };
			const mockWsCtx = {
				switchToWs: jest.fn().mockReturnValue({
					getClient: () => mockClient
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = extractRequestFromContext(mockWsCtx, { contextType: 'websocket' });
			expect(result).toBe(mockClient);
		});

		it('should throw error for unsupported context type', () => {
			const mockCtx = {} as ExecutionContext;

			expect(() => extractRequestFromContext(mockCtx, { contextType: 'unknown' as any, autoDetect: false })).toThrow('Unsupported context type: unknown');
		});

		it('should throw error when context type required but not specified', () => {
			const mockCtx = {} as ExecutionContext;

			expect(() => extractRequestFromContext(mockCtx, { autoDetect: false })).toThrow('Context type must be specified when autoDetect is false');
		});
	});

	describe('extractUserFromContext', () => {
		it('should extract user from HTTP context', () => {
			const mockUser = { id: 1, name: 'John' };
			const mockRequest = { user: mockUser };
			const mockHttpCtx = {
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: () => mockRequest
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = extractUserFromContext(mockHttpCtx);
			expect(result).toBe(mockUser);
		});

		it('should extract user property from context', () => {
			const mockUser = { id: 1, profile: { name: 'John' } };
			const mockRequest = { user: mockUser };
			const mockHttpCtx = {
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: () => mockRequest
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw for HTTP context
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = extractUserFromContext(mockHttpCtx, { property: 'profile.name', contextType: 'http' });
			expect(result).toBe('John');
		});

		it('should return undefined when user not found', () => {
			const mockRequest = {};
			const mockHttpCtx = {
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: () => mockRequest
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = extractUserFromContext(mockHttpCtx);
			expect(result).toBeUndefined();
		});

		it('should return undefined when property not found', () => {
			const mockUser = { id: 1 };
			const mockRequest = { user: mockUser };
			const mockHttpCtx = {
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: () => mockRequest
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw for HTTP context
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = extractUserFromContext(mockHttpCtx, { property: 'profile.name', contextType: 'http' });
			expect(result).toBeUndefined();
		});
	});

	describe('extractAuthTokenFromContext', () => {
		it('should extract token from Authorization header', () => {
			const mockRequest = {
				headers: { authorization: 'Bearer token123' }
			};
			const mockHttpCtx = {
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: () => mockRequest
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = extractAuthTokenFromContext(mockHttpCtx);
			expect(result).toBe('token123');
		});

		it('should extract token without Bearer prefix', () => {
			const mockRequest = {
				headers: { authorization: 'token123' }
			};
			const mockHttpCtx = {
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: () => mockRequest
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = extractAuthTokenFromContext(mockHttpCtx);
			expect(result).toBe('token123');
		});

		it('should handle case-insensitive header names', () => {
			const mockRequest = {
				headers: { Authorization: 'Bearer token123' }
			};
			const mockHttpCtx = {
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: () => mockRequest
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = extractAuthTokenFromContext(mockHttpCtx);
			expect(result).toBe('token123');
		});

		it('should return undefined when no authorization header', () => {
			const mockRequest = { headers: {} };
			const mockHttpCtx = {
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: () => mockRequest
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = extractAuthTokenFromContext(mockHttpCtx);
			expect(result).toBeUndefined();
		});

		it('should return undefined when request not found', () => {
			const mockHttpCtx = {
				switchToHttp: jest.fn().mockReturnValue({
					getRequest: () => null
				})
			} as unknown as ExecutionContext;

			// Mock GqlExecutionContext.create to throw
			jest.spyOn(GqlExecutionContext, 'create').mockImplementation(() => {
				throw new Error('Not GraphQL context');
			});

			const result = extractAuthTokenFromContext(mockHttpCtx);
			expect(result).toBeUndefined();
		});
	});
});
