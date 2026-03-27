import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleGuard } from '../role.guard.js';
import type { KeycloakUser } from '../../keycloak/keycloak.types.js';

describe('RoleGuard', () => {
	let guard: RoleGuard;
	let mockReflector: Partial<Reflector>;

	beforeEach(() => {
		mockReflector = {
			getAllAndOverride: vi.fn(),
		};

		guard = new RoleGuard(mockReflector as Reflector);
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

		describe('No role metadata', () => {
			it('should allow access when no @Roles() metadata is present', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(undefined);

				const mockRequest = { user: { id: 'user-123', realmRoles: [], clientRoles: [] } };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				const result = guard.canActivate(mockContext as ExecutionContext);

				expect(result).toBe(true);
			});

			it('should allow access when @Roles() is empty', () => {
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
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(['admin']);

				const mockRequest = { user: undefined };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(
					UnauthorizedException,
				);
			});

			it('should throw UnauthorizedException when request.user is null', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(['admin']);

				const mockRequest = { user: null };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(
					UnauthorizedException,
				);
			});
		});

		describe('Insufficient roles', () => {
			it('should throw ForbiddenException when user has no required roles', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(['admin', 'moderator']);

				const mockUser: KeycloakUser = {
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

		describe('Sufficient roles (OR logic)', () => {
			it('should allow access when user has one of required realm roles', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(['admin', 'moderator']);

				const mockUser: KeycloakUser = {
					id: 'user-123',
					email: 'user@example.com',
					username: 'john',
					name: 'John',
					realmRoles: ['moderator'],
					clientRoles: [],
				};

				const mockRequest = { user: mockUser };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				const result = guard.canActivate(mockContext as ExecutionContext);

				expect(result).toBe(true);
			});

			it('should allow access when user has one of required client roles', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(['read', 'write']);

				const mockUser: KeycloakUser = {
					id: 'user-123',
					email: 'user@example.com',
					username: 'john',
					name: 'John',
					realmRoles: [],
					clientRoles: ['write'],
				};

				const mockRequest = { user: mockUser };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				const result = guard.canActivate(mockContext as ExecutionContext);

				expect(result).toBe(true);
			});

			it('should check both realm and client roles', () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(['admin', 'viewer']);

				const mockUser: KeycloakUser = {
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
