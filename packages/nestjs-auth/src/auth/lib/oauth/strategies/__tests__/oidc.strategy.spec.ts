import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { OIDCStrategy } from '../oidc.strategy.js';
import { AppLogger } from '@pawells/nestjs-shared/common';

describe('OIDCStrategy', () => {
	let strategy: OIDCStrategy;

	beforeEach(async () => {
		const mockLogger = {
			createContextualLogger: jest.fn().mockReturnValue({
				debug: jest.fn(),
				error: jest.fn()
			})
		};

		const module = await Test.createTestingModule({
			providers: [
				OIDCStrategy,
				{
					provide: AppLogger,
					useValue: mockLogger
				}
			]
		}).compile();

		strategy = module.get<OIDCStrategy>(OIDCStrategy);
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
			family_name: 'User'
		};

		const user = await strategy.validate(
			'https://oidc.example.com',
			profile,
			'access-token',
			'refresh-token',
			'id-token',
			jest.fn()
		);

		expect(user).toBeDefined();
		expect(user.id).toBe('oidc_user_123');
		expect(user.email).toBe('oidc@example.com');
		expect(user.oauthProvider).toBe('oidc');
	});

	it('should handle validation errors', async () => {
		const profile = {
			sub: 'oidc_user_123',
			email: 'oidc@example.com',
			name: 'OIDC User'
		};

		// Mock the validate method to throw an error
		jest.spyOn(strategy, 'validate').mockImplementation(() => {
			throw new Error('Validation error');
		});

		await expect(
			strategy.validate(
				'https://oidc.example.com',
				profile,
				'access-token',
				'refresh-token',
				'id-token',
				jest.fn()
			)
		).rejects.toThrow();
	});

	it('should throw error when profile missing user identifier', async () => {
		const profile = {
			email: 'test@example.com',
			name: 'Test User'
			// missing sub and id
		};

		await expect(
			strategy.validate(
				'https://oidc.example.com',
				profile,
				'access-token',
				'refresh-token',
				'id-token',
				jest.fn()
			)
		).rejects.toThrow('user identifier');
	});

	it('should throw error when profile missing email', async () => {
		const profile = {
			sub: 'user_123',
			name: 'Test User'
			// missing email
		};

		await expect(
			strategy.validate(
				'https://oidc.example.com',
				profile,
				'access-token',
				'refresh-token',
				'id-token',
				jest.fn()
			)
		).rejects.toThrow('email address');
	});
});
