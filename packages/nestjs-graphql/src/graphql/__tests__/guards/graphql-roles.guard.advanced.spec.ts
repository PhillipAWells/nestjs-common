
import { jest } from '@jest/globals';
import { GraphQLRolesGuard } from '../../guards/graphql-roles.guard.js';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

describe('GraphQL Roles Guard - Advanced Authorization', () => {
	let guard: GraphQLRolesGuard;
	let mockReflector: any;
	let mockExecutionContext: any;
	let mockGqlContext: any;

	beforeEach(() => {
		// Manual mock for Reflector
		mockReflector = {
			getAllAndOverride: (key: string, targets: any[]) => {
				// Default return value for testing
				if ((mockReflector as any)._rolesOverride !== undefined) {
					return (mockReflector as any)._rolesOverride;
				}
				return undefined;
			},
			_rolesOverride: undefined as string[] | undefined
		};

		// Manual mock for GqlExecutionContext
		mockGqlContext = {
			getContext: () => ({
				user: undefined,
				...((mockGqlContext as any)._contextOverride ?? {})
			}),
			_contextOverride: undefined as any
		};

		// Manual mock for ExecutionContext
		mockExecutionContext = {
			getHandler: () => ({}),
			getClass: () => ({}),
			switchToHttp: () => ({
				getRequest: () => ({})
			})
		};

		guard = new GraphQLRolesGuard(mockReflector);

		// Mock GqlExecutionContext.create using jest.spyOn (required for static methods)
		jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('canActivate() - Role Validation', () => {
		it('should allow access when no roles are required', () => {
			mockReflector._rolesOverride = undefined;

			const result = guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(result).toBe(true);
		});

		it('should allow access when roles array is empty', () => {
			mockReflector._rolesOverride = [];

			const result = guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(result).toBe(true);
		});

		it('should allow access when user has required role', () => {
			mockReflector._rolesOverride = ['admin'];
			mockGqlContext._contextOverride = {
				user: {
					id: 'user-123',
					roles: ['admin']
				}
			};

			const result = guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(result).toBe(true);
		});

		it('should allow access when user has one of multiple required roles', () => {
			mockReflector._rolesOverride = ['admin', 'moderator'];
			mockGqlContext._contextOverride = {
				user: {
					id: 'user-123',
					roles: ['moderator', 'user']
				}
			};

			const result = guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(result).toBe(true);
		});

		it('should throw ForbiddenException when user is not authenticated', () => {
			mockReflector._rolesOverride = ['admin'];
			mockGqlContext._contextOverride = {
				user: undefined
			};

			expect(() => {
				guard.canActivate(mockExecutionContext as ExecutionContext);
			}).toThrow(ForbiddenException);
		});

		it('should throw ForbiddenException when user lacks required roles', () => {
			mockReflector._rolesOverride = ['admin'];
			mockGqlContext._contextOverride = {
				user: {
					id: 'user-123',
					roles: ['user']
				}
			};

			expect(() => {
				guard.canActivate(mockExecutionContext as ExecutionContext);
			}).toThrow(ForbiddenException);
		});

		it('should handle user with single role as string', () => {
			mockReflector._rolesOverride = ['editor'];
			mockGqlContext._contextOverride = {
				user: {
					id: 'user-123',
					role: 'editor'
				}
			};

			const result = guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(result).toBe(true);
		});

		it('should handle user with role as array', () => {
			mockReflector._rolesOverride = ['viewer'];
			mockGqlContext._contextOverride = {
				user: {
					id: 'user-123',
					role: ['viewer', 'user']
				}
			};

			const result = guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(result).toBe(true);
		});

		it('should handle user with authorities field', () => {
			mockReflector._rolesOverride = ['ROLE_ADMIN'];
			mockGqlContext._contextOverride = {
				user: {
					id: 'user-123',
					authorities: ['ROLE_ADMIN', 'ROLE_USER']
				}
			};

			const result = guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(result).toBe(true);
		});

		it('should handle user with scope field', () => {
			mockReflector._rolesOverride = ['read:users'];
			mockGqlContext._contextOverride = {
				user: {
					sub: 'user-123',
					scope: ['read:users', 'write:posts']
				}
			};

			const result = guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(result).toBe(true);
		});

		it('should handle user with scopes field (plural)', () => {
			mockReflector._rolesOverride = ['api:access'];
			mockGqlContext._contextOverride = {
				user: {
					sub: 'user-123',
					scopes: ['api:access']
				}
			};

			const result = guard.canActivate(mockExecutionContext as ExecutionContext);

			expect(result).toBe(true);
		});

		it('should handle user with no roles field gracefully', () => {
			mockReflector._rolesOverride = ['admin'];
			mockGqlContext._contextOverride = {
				user: {
					id: 'user-123'
					// No roles field at all
				}
			};

			expect(() => {
				guard.canActivate(mockExecutionContext as ExecutionContext);
			}).toThrow(ForbiddenException);
		});
	});
});
