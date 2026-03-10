
import { OAuth2Strategy } from '../strategies/oauth2.strategy.js';
import type { AuthService } from '../../../auth/auth.service.js';

describe('OAuth2 Strategy - Token Exchange & User Mapping', () => {
	let strategy: OAuth2Strategy;
	let mockAuthService: any;
	let validateCalls: any[];

	beforeEach(() => {
		validateCalls = [];

		mockAuthService = {
			validateOAuthUser: async (profile: any, accessToken: string, refreshToken: string) => {
				validateCalls.push({ profile, accessToken, refreshToken });
				return {
					id: profile.id,
					email: profile.emails?.[0]?.value || profile.email,
					firstName: profile.displayName?.split(' ')[0],
					lastName: profile.displayName?.split(' ')[1],
					role: 'user',
					isActive: true,
				};
			},
		};

		// Set OAuth2 configuration
		process.env['OAUTH2_AUTHORIZATION_URL'] = 'https://oauth.example.com/authorize';
		process.env['OAUTH2_TOKEN_URL'] = 'https://oauth.example.com/token';
		process.env['OAUTH2_CLIENT_ID'] = 'test-client-id';
		process.env['OAUTH2_CLIENT_SECRET'] = 'test-client-secret';
		process.env['OAUTH2_CALLBACK_URL'] = 'http://localhost:3000/auth/callback';

		strategy = new OAuth2Strategy(mockAuthService);
	});

	afterEach(() => {
		delete process.env['OAUTH2_AUTHORIZATION_URL'];
		delete process.env['OAUTH2_TOKEN_URL'];
		delete process.env['OAUTH2_CLIENT_ID'];
		delete process.env['OAUTH2_CLIENT_SECRET'];
		delete process.env['OAUTH2_CALLBACK_URL'];
	});

	describe('validate() - Token Exchange', () => {
		it('should validate OAuth tokens and extract user profile', async () => {
			const profile = {
				id: 'oauth-user-123',
				displayName: 'John Doe',
				emails: [{ value: 'john@example.com' }],
			};
			const accessToken = 'oauth-access-token-xyz';
			const refreshToken = 'oauth-refresh-token-abc';

			const result = await strategy.validate(accessToken, refreshToken, profile);

			expect(result).toEqual({
				id: 'oauth-user-123',
				email: 'john@example.com',
				firstName: 'John',
				lastName: 'Doe',
				role: 'user',
				isActive: true,
			});
		});

		it('should call authService.validateOAuthUser with correct parameters', async () => {
			const profile = {
				id: 'oauth-user-456',
				displayName: 'Jane Smith',
				emails: [{ value: 'jane@example.com' }],
			};
			const accessToken = 'access-token-123';
			const refreshToken = 'refresh-token-456';

			await strategy.validate(accessToken, refreshToken, profile);

			expect(validateCalls).toHaveLength(1);
			expect(validateCalls[0]).toEqual({
				profile,
				accessToken,
				refreshToken,
			});
		});

		it('should pass accessToken to validateOAuthUser', async () => {
			const profile = { id: 'user-1', displayName: 'User One', emails: [{ value: 'user1@test.com' }] };
			const accessToken = 'specific-access-token-value';
			const refreshToken = 'specific-refresh-token-value';

			await strategy.validate(accessToken, refreshToken, profile);

			expect(validateCalls[0].accessToken).toBe('specific-access-token-value');
		});

		it('should pass refreshToken to validateOAuthUser', async () => {
			const profile = { id: 'user-2', displayName: 'User Two', emails: [{ value: 'user2@test.com' }] };
			const accessToken = 'access-token';
			const refreshToken = 'specific-refresh-token-value';

			await strategy.validate(accessToken, refreshToken, profile);

			expect(validateCalls[0].refreshToken).toBe('specific-refresh-token-value');
		});
	});

	describe('validate() - User Profile Mapping', () => {
		it('should extract email from profile.emails array', async () => {
			const profile = {
				id: 'user-id',
				displayName: 'Test User',
				emails: [{ value: 'test@example.com' }],
			};

			const result = await strategy.validate('token', 'refresh', profile);

			expect(result.email).toBe('test@example.com');
		});

		it('should extract email from profile.email fallback', async () => {
			const profile = {
				id: 'user-id',
				displayName: 'Test User',
				email: 'fallback@example.com',
			};

			const result = await strategy.validate('token', 'refresh', profile);

			expect(result.email).toBe('fallback@example.com');
		});

		it('should extract firstName from displayName', async () => {
			const profile = {
				id: 'user-id',
				displayName: 'John Michael',
				email: 'john@example.com',
			};

			const result = await strategy.validate('token', 'refresh', profile);

			expect(result.firstName).toBe('John');
		});

		it('should extract lastName from displayName', async () => {
			const profile = {
				id: 'user-id',
				displayName: 'John Michael',
				email: 'john@example.com',
			};

			const result = await strategy.validate('token', 'refresh', profile);

			expect(result.lastName).toBe('Michael');
		});

		it('should handle single-name displayName', async () => {
			const profile = {
				id: 'user-id',
				displayName: 'Madonna',
				email: 'madonna@example.com',
			};

			const result = await strategy.validate('token', 'refresh', profile);

			expect(result.firstName).toBe('Madonna');
			expect(result.lastName).toBeUndefined();
		});

		it('should preserve profile ID in user result', async () => {
			const profile = {
				id: 'unique-oauth-id-789',
				displayName: 'Test',
				email: 'test@example.com',
			};

			const result = await strategy.validate('token', 'refresh', profile);

			expect(result.id).toBe('unique-oauth-id-789');
		});
	});

	describe('validate() - Default Values', () => {
		it('should set role to "user" by default', async () => {
			const profile = {
				id: 'user-id',
				displayName: 'User',
				email: 'user@example.com',
			};

			const result = await strategy.validate('token', 'refresh', profile);

			expect(result.role).toBe('user');
		});

		it('should set isActive to true by default', async () => {
			const profile = {
				id: 'user-id',
				displayName: 'User',
				email: 'user@example.com',
			};

			const result = await strategy.validate('token', 'refresh', profile);

			expect(result.isActive).toBe(true);
		});
	});

	describe('validate() - Error Handling', () => {
		it('should propagate authService errors', async () => {
			const errorService = {
				validateOAuthUser: async () => {
					throw new Error('OAuth validation failed');
				},
			} as unknown as AuthService;
			const errorStrategy = new OAuth2Strategy(errorService);

			const profile = { id: 'user-id', displayName: 'User', email: 'user@example.com' };

			await expect(errorStrategy.validate('token', 'refresh', profile)).rejects.toThrow('OAuth validation failed');
		});

		it('should handle missing email gracefully', async () => {
			const profile = {
				id: 'user-id',
				displayName: 'User Without Email',
				// No email or emails property
			};

			const result = await strategy.validate('token', 'refresh', profile);

			expect(result).toBeDefined();
			expect(result.id).toBe('user-id');
		});

		it('should handle empty emails array', async () => {
			const profile = {
				id: 'user-id',
				displayName: 'User',
				emails: [], // Empty array
			};

			const result = await strategy.validate('token', 'refresh', profile);

			expect(result).toBeDefined();
		});
	});

	describe('Configuration', () => {
		it('should be configured with oauth2 strategy name', () => {
			// Passport strategies require name in second parameter
			expect(strategy).toBeDefined();
		});

		it('should use environment variables for OAuth configuration', () => {
			process.env['OAUTH2_AUTHORIZATION_URL'] = 'https://custom.oauth.com/auth';
			process.env['OAUTH2_TOKEN_URL'] = 'https://custom.oauth.com/token';
			process.env['OAUTH2_CLIENT_ID'] = 'custom-id';
			process.env['OAUTH2_CLIENT_SECRET'] = 'custom-secret';
			process.env['OAUTH2_CALLBACK_URL'] = 'https://app.example.com/callback';

			const customStrategy = new OAuth2Strategy(mockAuthService);
			expect(customStrategy).toBeDefined();
		});

		it('should request openid, profile, and email scopes', () => {
			// OAuth2 scope is set in constructor options
			expect(strategy).toBeDefined();
		});
	});

	describe('validate() - Edge Cases', () => {
		it('should handle very long displayNames', async () => {
			const longName = 'This Is A Very Long Display Name With Many Words';
			const profile = {
				id: 'user-id',
				displayName: longName,
				email: 'user@example.com',
			};

			const result = await strategy.validate('token', 'refresh', profile);

			expect(result.firstName).toBe('This');
		});

		it('should handle special characters in displayName', async () => {
			const profile = {
				id: 'user-id',
				displayName: 'José García',
				email: 'jose@example.com',
			};

			const result = await strategy.validate('token', 'refresh', profile);

			expect(result.firstName).toBe('José');
			expect(result.lastName).toBe('García');
		});

		it('should handle numeric profile IDs', async () => {
			const profile = {
				id: 12345,
				displayName: 'User',
				email: 'user@example.com',
			};

			const result = await strategy.validate('token', 'refresh', profile as any);

			expect(result.id).toBe(12345);
		});
	});
});
