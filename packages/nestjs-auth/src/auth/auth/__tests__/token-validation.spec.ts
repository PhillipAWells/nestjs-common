import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { TokenValidationService } from '../token-validation.service.js';
import { UnauthorizedException } from '@nestjs/common';

describe('TokenValidationService', () => {
	let service: TokenValidationService;
	let jwtService: JwtService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TokenValidationService,
				{
					provide: JwtService,
					useValue: {
						decode: jest.fn(),
						verify: jest.fn()
					}
				}
			]
		}).compile();

		service = module.get<TokenValidationService>(TokenValidationService);
		jwtService = module.get<JwtService>(JwtService);
	});

	describe('validateToken', () => {
		it('should validate correct token', () => {
			const payload = {
				sub: 'user-123',
				email: 'test@example.com',
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
				iss: 'nestjs-app',
				aud: 'nestjs-api'
			};

			const token = 'valid-jwt-token';
			jest.spyOn(jwtService, 'decode').mockReturnValue(payload);
			jest.spyOn(jwtService, 'verify').mockReturnValue(payload);

			const result = service.validateToken(token);
			expect(result.sub).toBe('user-123');
			expect(result.email).toBe('test@example.com');
		});

		it('should reject token with missing claims', () => {
			const payload = {
				sub: 'user-123'
				// Missing email, iat, exp
			};

			jest.spyOn(jwtService, 'decode').mockReturnValue(payload);

			expect(() => service.validateToken('token')).toThrow(UnauthorizedException);
		});

		it('should reject token with invalid email', () => {
			const payload = {
				sub: 'user-123',
				email: 'invalid-email',
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600
			};

			jest.spyOn(jwtService, 'decode').mockReturnValue(payload);

			expect(() => service.validateToken('token')).toThrow(UnauthorizedException);
		});

		it('should reject token with wrong issuer', () => {
			const payload = {
				sub: 'user-123',
				email: 'test@example.com',
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
				iss: 'wrong-issuer',
				aud: 'nestjs-api'
			};

			jest.spyOn(jwtService, 'decode').mockReturnValue(payload);

			expect(() => service.validateToken('token')).toThrow(UnauthorizedException);
		});
	});
});
