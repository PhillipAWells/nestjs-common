import { JwtService } from '@nestjs/jwt';
import { TokenValidationService } from '../token-validation.service.js';
import { UnauthorizedException } from '@nestjs/common';
import { vi } from 'vitest';

describe('TokenValidationService', () => {
	let service: TokenValidationService;
	let mockJwtService: any;
	let mockModuleRef: any;

	beforeEach(() => {
		mockJwtService = {
			decode: vi.fn(),
			verify: vi.fn(),
		};

		mockModuleRef = {
			get: (token: any) => {
				if (token === JwtService) {
					return mockJwtService;
				}
				return null;
			},
		};

		service = new TokenValidationService(mockModuleRef);
	});

	describe('validateToken', () => {
		it('should validate correct token', () => {
			const payload = {
				sub: 'user-123',
				email: 'test@example.com',
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
				iss: 'nestjs-app',
				aud: 'nestjs-api',
			};

			const token = 'valid-jwt-token';
			mockJwtService.decode.mockReturnValue(payload);
			mockJwtService.verify.mockReturnValue(payload);

			const result = service.validateToken(token);
			expect(result.sub).toBe('user-123');
			expect(result.email).toBe('test@example.com');
		});

		it('should reject token with missing claims', () => {
			const payload = {
				sub: 'user-123',
				// Missing email, iat, exp
			};

			mockJwtService.decode.mockReturnValue(payload);

			expect(() => service.validateToken('token')).toThrow(UnauthorizedException);
		});

		it('should reject token with invalid email', () => {
			const payload = {
				sub: 'user-123',
				email: 'invalid-email',
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
			};

			mockJwtService.decode.mockReturnValue(payload);

			expect(() => service.validateToken('token')).toThrow(UnauthorizedException);
		});

		it('should reject token with wrong issuer', () => {
			const payload = {
				sub: 'user-123',
				email: 'test@example.com',
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
				iss: 'wrong-issuer',
				aud: 'nestjs-api',
			};

			mockJwtService.decode.mockReturnValue(payload);

			expect(() => service.validateToken('token')).toThrow(UnauthorizedException);
		});
	});
});
