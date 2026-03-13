import { vi, describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { OIDCStrategy } from '../oidc.strategy.js';
import { AppLogger } from '@pawells/nestjs-shared/common';

describe('OIDCStrategy', () => {
	let strategy: OIDCStrategy;
	let mockModuleRef: any;

	beforeAll(() => {
		process.env['OIDC_ISSUER'] = 'https://oidc.example.com';
		process.env['OIDC_AUTHORIZATION_URL'] = 'https://oidc.example.com/auth';
		process.env['OIDC_TOKEN_URL'] = 'https://oidc.example.com/token';
		process.env['OIDC_USERINFO_URL'] = 'https://oidc.example.com/userinfo';
		process.env['OIDC_CLIENT_ID'] = 'test-client';
		process.env['OIDC_CLIENT_SECRET'] = 'test-secret';
		process.env['OIDC_CALLBACK_URL'] = 'https://app.example.com/callback';
	});

	afterAll(() => {
		delete process.env['OIDC_ISSUER'];
		delete process.env['OIDC_AUTHORIZATION_URL'];
		delete process.env['OIDC_TOKEN_URL'];
		delete process.env['OIDC_USERINFO_URL'];
		delete process.env['OIDC_CLIENT_ID'];
		delete process.env['OIDC_CLIENT_SECRET'];
		delete process.env['OIDC_CALLBACK_URL'];
	});

	beforeEach(() => {
		const mockLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				error: vi.fn(),
			}),
		};

		mockModuleRef = {
			get: (token: any) => {
				if (token === AppLogger) return mockLogger;
				return null;
			},
		};

		strategy = new OIDCStrategy(mockModuleRef);
	});

	it('should be defined', () => {
		expect(strategy).toBeDefined();
	});

	it('should validate OIDC profile and return user', async () => {
		const profile = {
			sub: 'oidc_user_123',
			email: 'oidc@example.com',
			name: 'OIDC User',
			given_name: 'OIDC',
			family_name: 'User',
		};

		const user = await strategy.validate(
			'https://oidc.example.com',
			profile,
			'access-token',
			'refresh-token',
			'id-token',
			vi.fn(),
		);

		expect(user).toBeDefined();
		expect(user.id).toBe('oidc_user_123');
		expect(user.email).toBe('oidc@example.com');
		expect(user.oauthProvider).toBe('oidc');
	});

	it('should handle validation errors', () => {
		const profile = {
			sub: 'oidc_user_123',
			email: 'oidc@example.com',
			name: 'OIDC User',
		};

		// Mock the validate method to throw an error
		vi.spyOn(strategy, 'validate').mockImplementation(() => {
			throw new Error('Validation error');
		});

		expect(() =>
			strategy.validate(
				'https://oidc.example.com',
				profile,
				'access-token',
				'refresh-token',
				'id-token',
				vi.fn(),
			),
		).toThrow('Validation error');
	});

	it('should throw error when profile missing user identifier', () => {
		const profile = {
			email: 'test@example.com',
			name: 'Test User',
			// missing sub and id
		};

		expect(() =>
			strategy.validate(
				'https://oidc.example.com',
				profile,
				'access-token',
				'refresh-token',
				'id-token',
				vi.fn(),
			),
		).toThrow();
	});

	it('should throw error when profile missing email', () => {
		const profile = {
			sub: 'user_123',
			name: 'Test User',
			// missing email
		};

		expect(() =>
			strategy.validate(
				'https://oidc.example.com',
				profile,
				'access-token',
				'refresh-token',
				'id-token',
				vi.fn(),
			),
		).toThrow();
	});
});
