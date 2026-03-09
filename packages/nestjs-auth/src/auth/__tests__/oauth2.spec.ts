import { Test, TestingModule } from '@nestjs/testing';
import { OAuth2Strategy } from '../lib/oauth/strategies/oauth2.strategy.js';
import { AuthService } from '../auth/auth.service.js';
import { OAuthService } from '../lib/oauth/oauth.service.js';
import { AppLogger } from '@pawells/nestjs-shared/common';

describe('OAuth2 Integration Tests', () => {
	let strategy: OAuth2Strategy;
	let authService: AuthService;
	let oauthService: OAuthService;

	beforeEach(async () => {
		const mockAuthService = {
			validateOAuthUser: jest.fn().mockResolvedValue({})
		};

		const mockAppLogger = {
			createContextualLogger: jest.fn().mockReturnValue({
				debug: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn()
			})
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				OAuth2Strategy,
				OAuthService,
				{
					provide: AuthService,
					useValue: mockAuthService
				},
				{
					provide: AppLogger,
					useValue: mockAppLogger
				}
			]
		}).compile();

		strategy = module.get<OAuth2Strategy>(OAuth2Strategy);
		authService = module.get(AuthService);
		oauthService = module.get<OAuthService>(OAuthService);
	});

	describe('OAuth2 Flow Integration', () => {
		it('should complete full OAuth2 authentication flow', async () => {
			// Mock OAuth2 profile
			const profile = {
				id: 'oauth2-user-123',
				displayName: 'Test User',
				emails: [{ value: 'test@example.com' }],
				name: {
					givenName: 'Test',
					familyName: 'User'
				}
			};

			const accessToken = 'oauth-access-token';
			const refreshToken = 'oauth-refresh-token';

			// Mock user validation response
			const mockUser = {
				id: 'user_123',
				email: 'test@example.com',
				name: 'Test User',
				roles: ['user'],
				isActive: true
			};

			(authService as any).validateOAuthUser.mockResolvedValue(mockUser);

			// Execute OAuth2 validation
			const result = await strategy.validate(accessToken, refreshToken, profile);

			// Verify the flow
			expect(authService.validateOAuthUser).toHaveBeenCalledWith(
				profile,
				accessToken,
				refreshToken
			);
			expect(result).toEqual(mockUser);
		});

		it('should handle OAuth2 token verification with JWK conversion', async () => {
			// Mock JWKS response
			const mockJwk = {
				kty: 'RSA',
				n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtmUAmh9K8X1GYTAJwTdfWbLwJHYG',
				e: 'AQAB'
			};

			const mockAxiosResponse = {
				data: { keys: [mockJwk] }
			};

			// Mock axios
			jest.spyOn((oauthService as any).httpClient, 'get').mockResolvedValue(mockAxiosResponse);
			jest.spyOn(oauthService as any, 'getJwksUrl').mockReturnValue('https://example.com/.well-known/jwks.json');

			// Mock JWT verification
			const jwt = require('jsonwebtoken');
			const verifySpy = jest.spyOn(jwt, 'verify').mockImplementation((token, key, options, callback: any) => {
				callback(null, {
					sub: 'user123',
					email: 'test@example.com',
					iss: 'https://example.com',
					aud: 'client-id'
				});
			});

			const result = await oauthService.verifyToken('valid.jwt.token', 'test-provider');

			expect(result).toEqual({
				id: 'user123',
				email: 'test@example.com',
				name: undefined,
				roles: [],
				sub: 'user123',
				preferred_username: undefined,
				given_name: undefined,
				family_name: undefined,
				iss: 'https://example.com',
				aud: 'client-id'
			});

			expect(verifySpy).toHaveBeenCalled();
		});

		it('should handle invalid OAuth2 tokens', async () => {
			const jwt = require('jsonwebtoken');
			jest.spyOn(jwt, 'verify').mockImplementation((token, key, options, callback: any) => {
				callback(new Error('Invalid token'), null);
			});

			await expect(oauthService.verifyToken('invalid.jwt.token', 'test-provider'))
				.rejects.toThrow('Invalid token');
		});
	});
});
