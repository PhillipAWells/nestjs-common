import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from '../permission.guard.js';
import type { IKeycloakUser } from '../../keycloak/keycloak.types.js';

describe('PermissionGuard', () => {
	let guard: PermissionGuard;
	let mockReflector: Partial<Reflector>;

	beforeEach(() => {
		mockReflector = {
			getAllAndOverride: vi.fn(),
		};

		guard = new PermissionGuard(mockReflector as Reflector);
	});

	describe('canActivate', () => {
		let mockContext: Partial<ExecutionContext>;

		beforeEach(() => {
			mockContext = {
				getHandler: vi.fn(),
				getClass: vi.fn(),
				getType: vi.fn().mockReturnValue('http'),
				switchToHttp: vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue({}),
				}),
			};
		});

		describe('No permission metadata', () => {
			it('should allow access when no @Permissions() metadata is present', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(undefined);

				const mockRequest = { user: { id: 'user-123', realmRoles: [], clientRoles: [] } };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				const result = guard.canActivate(mockContext as ExecutionContext);

				expect(result).toBe(true);
			});

			it('should allow access when @Permissions() is empty', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue([]);

				const mockRequest = { user: { id: 'user-123', realmRoles: [], clientRoles: [] } };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				const result = guard.canActivate(mockContext as ExecutionContext);

				expect(result).toBe(true);
			});
		});

		describe('Unauthenticated user', () => {
			it('should throw UnauthorizedException when request.user is undefined', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(['read:data']);

				const mockRequest = { user: undefined };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(
					UnauthorizedException,
				);
			});

			it('should throw UnauthorizedException when request.user is null', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(['read:data']);

				const mockRequest = { user: null };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(
					UnauthorizedException,
				);
			});
		});

		describe('Insufficient permissions (roles)', () => {
			it('should throw ForbiddenException when user has no matching roles', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(['read:data', 'write:data']);

				const mockUser: IKeycloakUser = {
					id: 'user-123',
					email: 'user@example.com',
					username: 'john',
					name: 'John',
					realmRoles: ['user'],
					clientRoles: ['viewer'],
				};

				const mockRequest = { user: mockUser };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(
					ForbiddenException,
				);
			});
		});

		describe('Sufficient permissions with roles-as-permissions semantics (OR logic)', () => {
			it('should allow access when user has one of required permission roles in realm roles', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(['read:data', 'write:data']);

				const mockUser: IKeycloakUser = {
					id: 'user-123',
					email: 'user@example.com',
					username: 'john',
					name: 'John',
					realmRoles: ['read:data'],
					clientRoles: [],
				};

				const mockRequest = { user: mockUser };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				const result = guard.canActivate(mockContext as ExecutionContext);

				expect(result).toBe(true);
			});

			it('should allow access when user has one of required permission roles in client roles', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(['read:data', 'write:data']);

				const mockUser: IKeycloakUser = {
					id: 'user-123',
					email: 'user@example.com',
					username: 'john',
					name: 'John',
					realmRoles: [],
					clientRoles: ['write:data'],
				};

				const mockRequest = { user: mockUser };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				const result = guard.canActivate(mockContext as ExecutionContext);

				expect(result).toBe(true);
			});

			it('should check both realm and client roles for permission matching', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(['admin', 'viewer']);

				const mockUser: IKeycloakUser = {
					id: 'user-123',
					email: 'user@example.com',
					username: 'john',
					name: 'John',
					realmRoles: ['user'],
					clientRoles: ['viewer'],
				};

				const mockRequest = { user: mockUser };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				const result = guard.canActivate(mockContext as ExecutionContext);

				expect(result).toBe(true);
			});
		});
	});
});
