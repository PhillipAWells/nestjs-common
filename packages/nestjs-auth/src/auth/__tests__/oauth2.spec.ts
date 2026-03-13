import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OAuth2Strategy } from '../lib/oauth/strategies/oauth2.strategy.js';
import { AuthService } from '../auth/auth.service.js';
import { OAuthService } from '../lib/oauth/oauth.service.js';
import { AppLogger } from '@pawells/nestjs-shared/common';

describe('OAuth2 Integration Tests', () => {
	let strategy: OAuth2Strategy;
	let authService: any;
	let oauthService: OAuthService;

	beforeEach(async () => {
		const mockAuthService = {
			validateOAuthUser: vi.fn().mockResolvedValue({}),
		};

		const mockAppLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}),
		};

		// Set OAuth2 environment variables required for OAuth2Strategy constructor
		process.env['OAUTH2_AUTHORIZATION_URL'] = 'https://oauth.example.com/authorize';
		process.env['OAUTH2_TOKEN_URL'] = 'https://oauth.example.com/token';
		process.env['OAUTH2_CLIENT_ID'] = 'test-client-id';
		process.env['OAUTH2_CLIENT_SECRET'] = 'test-client-secret';
		process.env['OAUTH2_CALLBACK_URL'] = 'http://localhost:3000/auth/callback';

		const oauthModuleRef: any = {
			get(token: any) {
				if (token === AppLogger) return mockAppLogger;
				return undefined;
			},
		};

		const strategyModuleRef: any = {
			get(token: any) {
				if (token === AuthService) return mockAuthService;
				return undefined;
			},
		};

		oauthService = new OAuthService(oauthModuleRef);
		// Initialize httpClient (normally called by NestJS lifecycle)
		oauthService.onModuleInit();

		strategy = new OAuth2Strategy(strategyModuleRef);
		authService = mockAuthService;
	});

	afterEach(() => {
		delete process.env['OAUTH2_AUTHORIZATION_URL'];
		delete process.env['OAUTH2_TOKEN_URL'];
		delete process.env['OAUTH2_CLIENT_ID'];
		delete process.env['OAUTH2_CLIENT_SECRET'];
		delete process.env['OAUTH2_CALLBACK_URL'];
		vi.restoreAllMocks();
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
					familyName: 'User',
				},
			};

			const accessToken = 'oauth-access-token';
			const refreshToken = 'oauth-refresh-token';

			// Mock user validation response
			const mockUser = {
				id: 'user_123',
				email: 'test@example.com',
				name: 'Test User',
				roles: ['user'],
				isActive: true,
			};

			authService.validateOAuthUser.mockResolvedValue(mockUser);

			// Execute OAuth2 validation
			const result = await strategy.validate(accessToken, refreshToken, profile);

			// Verify the flow
			expect(authService.validateOAuthUser).toHaveBeenCalledWith(
				profile,
				accessToken,
				refreshToken,
			);
			expect(result).toEqual(mockUser);
		});

		it('should handle OAuth2 token verification with JWK conversion', async () => {
			// Mock JWKS response
			const mockJwk = {
				kty: 'RSA',
				n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtmUAmh9K8X1GYTAJwTdfWbLwJHYG',
				e: 'AQAB',
			};

			const mockAxiosResponse = {
				data: { keys: [mockJwk] },
			};

			// Mock axios
			vi.spyOn((oauthService as any).httpClient, 'get').mockResolvedValue(mockAxiosResponse);
			vi.spyOn(oauthService as any, 'getJwksUrl').mockReturnValue('https://example.com/.well-known/jwks.json');

			// Mock JWT verification
			const jwt = require('jsonwebtoken');
			const verifySpy = vi.spyOn(jwt, 'verify').mockImplementation((token: any, key: any, options: any, callback: any) => {
				callback(null, {
					sub: 'user123',
					email: 'test@example.com',
					iss: 'https://example.com',
					aud: 'client-id',
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
				aud: 'client-id',
			});

			expect(verifySpy).toHaveBeenCalled();
		});

		it('should handle invalid OAuth2 tokens', async () => {
			vi.spyOn(oauthService as any, 'getJwksUrl').mockReturnValue('https://example.com/.well-known/jwks.json');
			vi.spyOn((oauthService as any).httpClient, 'get').mockResolvedValue({
				data: { keys: [{ kty: 'RSA', n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtmUAmh9K8X1GYTAJwTdfWbLwJHYG', e: 'AQAB' }] },
			});

			const jwt = require('jsonwebtoken');
			vi.spyOn(jwt, 'verify').mockImplementation((token: any, key: any, options: any, callback: any) => {
				callback(new Error('Invalid token'), null);
			});

			await expect(oauthService.verifyToken('invalid.jwt.token', 'test-provider'))
				.rejects.toThrow('Invalid token');
		});
	});
});
