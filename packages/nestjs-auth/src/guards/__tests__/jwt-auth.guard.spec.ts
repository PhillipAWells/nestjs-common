import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../jwt-auth.guard.js';
import { KeycloakTokenValidationService } from '../../keycloak/services/keycloak-token-validation.service.js';
import type { KeycloakUser, KeycloakTokenClaims } from '../../keycloak/keycloak.types.js';

describe('JwtAuthGuard', () => {
	let guard: JwtAuthGuard;
	let mockTokenValidationService: Partial<KeycloakTokenValidationService>;
	let mockReflector: Partial<Reflector>;

	beforeEach(() => {
		mockTokenValidationService = {
			validateToken: vi.fn(),
			extractUser: vi.fn(),
		};

		mockReflector = {
			getAllAndOverride: vi.fn(),
		};

		guard = new JwtAuthGuard(
			mockReflector as Reflector,
			mockTokenValidationService as KeycloakTokenValidationService,
		);
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

		describe('@Public() decorator', () => {
			it('should allow access when handler has Public metadata', async () => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(true);

				const result = await guard.canActivate(mockContext as ExecutionContext);

				expect(result).toBe(true);
				expect(mockTokenValidationService.validateToken).not.toHaveBeenCalled();
			});
		});

		describe('Authorization header', () => {
			beforeEach(() => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(false);
			});

			it('should throw UnauthorizedException when Authorization header is missing', async () => {
				const mockRequest = { headers: {} };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				await expect(guard.canActivate(mockContext as ExecutionContext)).rejects.toThrow(
					UnauthorizedException,
				);
			});

			it('should throw UnauthorizedException when Authorization header is not a string', async () => {
				const mockRequest = { headers: { authorization: 123 } };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				await expect(guard.canActivate(mockContext as ExecutionContext)).rejects.toThrow(
					UnauthorizedException,
				);
			});

			it('should throw UnauthorizedException when Bearer token is empty', async () => {
				const mockRequest = { headers: { authorization: 'Bearer ' } };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});

				await expect(guard.canActivate(mockContext as ExecutionContext)).rejects.toThrow(
					UnauthorizedException,
				);
			});
		});

		describe('Token validation', () => {
			let mockRequest: any;

			beforeEach(() => {
				(mockReflector.getAllAndOverride as Mock).mockReturnValue(false);
				mockRequest = { headers: { authorization: 'Bearer valid.jwt.token' } };
				mockContext.switchToHttp = vi.fn().mockReturnValue({
					getRequest: vi.fn().mockReturnValue(mockRequest),
				});
			});

			it('should set request.user and request.keycloakClaims on successful validation', async () => {
				const mockClaims: KeycloakTokenClaims = {
					sub: 'user-123',
					email: 'user@example.com',
					preferred_username: 'john_doe',
					name: 'John Doe',
					realm_access: { roles: ['admin'] },
					aud: ['my-client'],
				} as KeycloakTokenClaims;

				const mockUser: KeycloakUser = {
					id: 'user-123',
					email: 'user@example.com',
					username: 'john_doe',
					name: 'John Doe',
					realmRoles: ['admin'],
					clientRoles: [],
				};

				(mockTokenValidationService.validateToken as Mock).mockResolvedValue({
					valid: true,
					claims: mockClaims,
				});
				(mockTokenValidationService.extractUser as Mock).mockReturnValue(mockUser);

				const result = await guard.canActivate(mockContext as ExecutionContext);

				expect(result).toBe(true);
				expect(mockRequest.user).toEqual(mockUser);
				expect(mockRequest.keycloakClaims).toEqual(mockClaims);
			});

			it('should throw UnauthorizedException when token is invalid', async () => {
				(mockTokenValidationService.validateToken as Mock).mockResolvedValue({
					valid: false,
					error: 'token_expired',
				});

				await expect(guard.canActivate(mockContext as ExecutionContext)).rejects.toThrow(
					UnauthorizedException,
				);
			});

			it('should throw UnauthorizedException when claims are missing', async () => {
				(mockTokenValidationService.validateToken as Mock).mockResolvedValue({
					valid: true,
				});

				await expect(guard.canActivate(mockContext as ExecutionContext)).rejects.toThrow(
					UnauthorizedException,
				);
			});
		});
	});
});
