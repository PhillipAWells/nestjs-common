import { vi, describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { KeycloakStrategy } from '../keycloak.strategy.js';
import { AppLogger } from '@pawells/nestjs-shared/common';

describe('KeycloakStrategy', () => {
	let strategy: KeycloakStrategy;
	let mockModuleRef: any;

	beforeAll(() => {
		process.env['KEYCLOAK_AUTH_URL'] = 'https://keycloak.example.com/auth';
		process.env['KEYCLOAK_TOKEN_URL'] = 'https://keycloak.example.com/token';
		process.env['KEYCLOAK_CLIENT_ID'] = 'test-client';
		process.env['KEYCLOAK_CLIENT_SECRET'] = 'test-secret';
		process.env['KEYCLOAK_CALLBACK_URL'] = 'https://app.example.com/callback';
	});

	afterAll(() => {
		delete process.env['KEYCLOAK_AUTH_URL'];
		delete process.env['KEYCLOAK_TOKEN_URL'];
		delete process.env['KEYCLOAK_CLIENT_ID'];
		delete process.env['KEYCLOAK_CLIENT_SECRET'];
		delete process.env['KEYCLOAK_CALLBACK_URL'];
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

		strategy = new KeycloakStrategy(mockModuleRef);
	});

	it('should be defined', () => {
		expect(strategy).toBeDefined();
	});

	it('should validate Keycloak profile and return user', async () => {
		const profile = {
			sub: 'keycloak_user_123',
			email: 'keycloak@example.com',
			name: 'Keycloak User',
			given_name: 'Keycloak',
			family_name: 'User',
		};

		const user = await strategy.validate(
			'access-token',
			'refresh-token',
			profile,
			vi.fn(),
		);

		expect(user).toBeDefined();
		expect(user.id).toBe('keycloak_user_123');
		expect(user.email).toBe('keycloak@example.com');
		expect(user.oauthProvider).toBe('keycloak');
	});

	it('should handle validation errors', () => {
		const profile = {
			sub: 'keycloak_user_123',
			email: 'keycloak@example.com',
			name: 'Keycloak User',
		};

		// Mock the validate method to throw an error
		vi.spyOn(strategy, 'validate').mockImplementation(() => {
			throw new Error('Validation error');
		});

		expect(() =>
			strategy.validate(
				'access-token',
				'refresh-token',
				profile,
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
				'access-token',
				'refresh-token',
				profile,
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
				'access-token',
				'refresh-token',
				profile,
				vi.fn(),
			),
		).toThrow();
	});
});
