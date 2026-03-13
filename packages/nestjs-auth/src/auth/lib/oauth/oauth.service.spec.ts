import { vi, describe, it, expect, beforeEach } from 'vitest';
import { OAuthService } from './oauth.service.js';
import { AppLogger } from '@pawells/nestjs-shared/common';

describe('OAuthService', () => {
	let service: OAuthService;

	beforeEach(async () => {
		const mockAppLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}),
		};

		const mockModuleRef: any = {
			get(token: any) {
				if (token === AppLogger) return mockAppLogger;
				return undefined;
			},
		};

		service = new OAuthService(mockModuleRef);
		// Initialize httpClient (normally called by NestJS lifecycle)
		service.onModuleInit();
	});

	describe('JWK to PEM conversion', () => {
		it('should convert valid RSA JWK to PEM', async () => {
			const mockJwk = {
				kty: 'RSA',
				n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtmUAmh9K8X1GYTAJwTdfWbLwJHYG',
				e: 'AQAB',
				d: 'X4cTteJY_gn4FYPsXB8rdXix5vwsg1FLN5E3EaG6RJoVH-HLLKD9M7dx5oo7GURknchnrRweUkC7hT5fJLM0WbFAKNLWY2vv7B6NqXSzUvxT0_YSfqijwp3RTzlBaCxWp4doFk5N2o8Gy_nHNKroADIkJ46pRUohsXywbReAdYaMwFs9tv8d_cPVY3i07a3t8MNJLtmcyclZhTQK4MEQKR2L32wcZxlVYqWJ9z4o9DImshTk6XpfTiDbI5_0T7_8V-i3w',
				p: '83i-7IvMGXoMXCskv73TKr8637FiO7Z27zv8oj6pbWUQyLPQBQxtPVnwD20R-60eTDmD2ujnMt5PoqMrm8RfmNh',
				q: '3dfOR9cuYq-0S-mkFLzgItgMEfFzB2q3hWehMuG0Zlca4ZyHn2Q9QgQ2I6VK8w',
				dp: 'G4sPXkc6Ya9y8oJW9_ILj4xuppu0lziCfIEiwOFjZGURcHED3U3z9InSwwHBi',
				dq: 's9wc9r3tAE85TMI3DhSYcfqjzRCwmRsdBNGDvFZncBHd',
				qi: 'GyM_p6JrXySiz1toFgKbWV-JdI3jQ4ypu9rbMWx3rQJBfmt0FoYzgUIZEVFEcOqw',
			};

			// Mock axios response
			const mockAxiosResponse = {
				data: { keys: [mockJwk] },
			};

			// Mock the httpClient.get method
			vi.spyOn((service as any).httpClient, 'get').mockResolvedValue(mockAxiosResponse);

			// Mock getJwksUrl to return a URL
			vi.spyOn(service as any, 'getJwksUrl').mockReturnValue('https://example.com/.well-known/jwks.json');

			const pem = await (service as any).getPublicKey('test-provider');

			expect(pem).toBeDefined();
			expect(typeof pem).toBe('string');
			expect(pem).toContain('-----BEGIN PUBLIC KEY-----');
			expect(pem).toContain('-----END PUBLIC KEY-----');
		});

		it('should handle JWK with leading zeros in key components', async () => {
			const mockJwk = {
				kty: 'RSA',
				n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtmUAmh9K8X1GYTAJwTdfWbLwJHYG',
				e: 'AQAB',
			};

			const mockAxiosResponse = {
				data: { keys: [mockJwk] },
			};

			vi.spyOn((service as any).httpClient, 'get').mockResolvedValue(mockAxiosResponse);
			vi.spyOn(service as any, 'getJwksUrl').mockReturnValue('https://example.com/.well-known/jwks.json');

			const pem = await (service as any).getPublicKey('test-provider');

			expect(pem).toBeDefined();
			expect(typeof pem).toBe('string');
		});

		it('should throw error when JWKS response has no keys', async () => {
			const mockAxiosResponse = {
				data: { keys: [] },
			};

			vi.spyOn((service as any).httpClient, 'get').mockResolvedValue(mockAxiosResponse);
			vi.spyOn(service as any, 'getJwksUrl').mockReturnValue('https://example.com/.well-known/jwks.json');

			await expect((service as any).getPublicKey('test-provider')).rejects.toThrow('No JWK found');
		});

		it('should throw error when JWKS URL is not configured', async () => {
			vi.spyOn(service as any, 'getJwksUrl').mockReturnValue(null);

			await expect((service as any).getPublicKey('test-provider')).rejects.toThrow('JWKS URL not configured for provider test-provider');
		});

		it('should cache converted PEM key', async () => {
			const mockJwk = {
				kty: 'RSA',
				n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtmUAmh9K8X1GYTAJwTdfWbLwJHYG',
				e: 'AQAB',
			};

			const mockAxiosResponse = {
				data: { keys: [mockJwk] },
			};

			const httpClientSpy = vi.spyOn((service as any).httpClient, 'get').mockResolvedValue(mockAxiosResponse);
			vi.spyOn(service as any, 'getJwksUrl').mockReturnValue('https://example.com/.well-known/jwks.json');

			// First call
			const pem1 = await (service as any).getPublicKey('test-provider');
			// Second call should use cache
			const pem2 = await (service as any).getPublicKey('test-provider');

			expect(pem1).toBe(pem2);
			expect(httpClientSpy).toHaveBeenCalledTimes(1); // Only called once due to caching
		});
	});

	describe('token validation', () => {
		it('should validate JWT token with PEM public key', async () => {
			const mockJwk = {
				kty: 'RSA',
				n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtmUAmh9K8X1GYTAJwTdfWbLwJHYG',
				e: 'AQAB',
			};

			const mockAxiosResponse = {
				data: { keys: [mockJwk] },
			};

			vi.spyOn((service as any).httpClient, 'get').mockResolvedValue(mockAxiosResponse);
			vi.spyOn(service as any, 'getJwksUrl').mockReturnValue('https://example.com/.well-known/jwks.json');

			// Mock jwt.verify
			const jwt = require('jsonwebtoken');
			const verifySpy = vi.spyOn(jwt, 'verify').mockImplementation((token: any, key: any, options: any, callback: any) => {
				callback(null, { sub: 'user123', email: 'test@example.com' });
			});

			const result = await service.verifyToken('valid.jwt.token', 'test-provider');

			expect(result).toEqual({
				id: 'user123',
				email: 'test@example.com',
				name: undefined,
				roles: [],
				sub: 'user123',
				preferred_username: undefined,
				given_name: undefined,
				family_name: undefined,
			});

			expect(verifySpy).toHaveBeenCalledWith('valid.jwt.token', expect.any(String), { algorithms: ['RS256'] }, expect.any(Function));
		});
	});
});
