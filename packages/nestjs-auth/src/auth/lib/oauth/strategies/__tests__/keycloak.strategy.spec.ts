import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { KeycloakStrategy } from '../keycloak.strategy.js';
import { AppLogger } from '@pawells/nestjs-shared/common';

describe('KeycloakStrategy', () => {
	let strategy: KeycloakStrategy;

	beforeEach(async () => {
		const mockLogger = {
			createContextualLogger: jest.fn().mockReturnValue({
				debug: jest.fn(),
				error: jest.fn(),
			}),
		};

		const module = await Test.createTestingModule({
			providers: [
				KeycloakStrategy,
				{
					provide: AppLogger,
					useValue: mockLogger,
				},
			],
		}).compile();

		strategy = module.get<KeycloakStrategy>(KeycloakStrategy);
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
			jest.fn(),
		);

		expect(user).toBeDefined();
		expect(user.id).toBe('keycloak_user_123');
		expect(user.email).toBe('keycloak@example.com');
		expect(user.oauthProvider).toBe('keycloak');
	});

	it('should handle validation errors', async () => {
		const profile = {
			sub: 'keycloak_user_123',
			email: 'keycloak@example.com',
			name: 'Keycloak User',
		};

		// Mock the validate method to throw an error
		jest.spyOn(strategy, 'validate').mockImplementation(() => {
			throw new Error('Validation error');
		});

		await expect(
			strategy.validate(
				'access-token',
				'refresh-token',
				profile,
				jest.fn(),
			),
		).rejects.toThrow();
	});

	it('should throw error when profile missing user identifier', async () => {
		const profile = {
			email: 'test@example.com',
			name: 'Test User',
			// missing sub and id
		};

		await expect(
			strategy.validate(
				'access-token',
				'refresh-token',
				profile,
				jest.fn(),
			),
		).rejects.toThrow('user identifier');
	});

	it('should throw error when profile missing email', async () => {
		const profile = {
			sub: 'user_123',
			name: 'Test User',
			// missing email
		};

		await expect(
			strategy.validate(
				'access-token',
				'refresh-token',
				profile,
				jest.fn(),
			),
		).rejects.toThrow('email address');
	});
});
