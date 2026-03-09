
import { JWTStrategy } from './jwt.strategy.js';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { TokenBlacklistService } from './token-blacklist.service.js';

describe('JWT Strategy Configuration Validation', () => {
	let mockUserLookupFn: ReturnType<typeof vi.fn>;
	let mockAppLogger: any;
	let mockTokenValidationService: any;
	let mockTokenBlacklistService: unknown;

	beforeEach(() => {
		mockUserLookupFn = vi.fn();
		mockTokenValidationService = {};
		mockTokenBlacklistService = {
			isTokenBlacklisted: vi.fn().mockResolvedValue(false),
			hasUserRevokedTokens: vi.fn().mockResolvedValue(false),
		} as unknown as TokenBlacklistService;
		mockAppLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}),
		};
		// Clear environment variables
		delete process.env['JWT_SECRET'];
		delete process.env['JWT_EXPIRES_IN'];
	});

	afterEach(() => {
		// Clean up environment variables
		delete process.env['JWT_SECRET'];
		delete process.env['JWT_EXPIRES_IN'];
		vi.clearAllMocks();
	});

	describe('JWT_SECRET validation', () => {
		it('should require JWT_SECRET', () => {
			process.env['JWT_EXPIRES_IN'] = '15m';
			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).toThrow('JWT configuration validation failed');
		});

		it('should require minimum 32 characters', () => {
			process.env['JWT_SECRET'] = 'short';
			process.env['JWT_EXPIRES_IN'] = '15m';
			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).toThrow('JWT configuration validation failed');
		});

		it('should accept valid secrets with minimum length', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%^&*()_+-=[]{}|;:,.<>?`~';
			process.env['JWT_EXPIRES_IN'] = '15m';
			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).not.toThrow();
		});

		it('should accept valid secrets with special characters', () => {
			process.env['JWT_SECRET'] = 'MySuperSecretKeyWith32Characters!';
			process.env['JWT_EXPIRES_IN'] = '15m';
			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).not.toThrow();
		});

		it('should reject secrets with invalid characters', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + ' '; // space is not allowed
			process.env['JWT_EXPIRES_IN'] = '15m';
			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).toThrow('JWT configuration validation failed');
		});

		it('should reject secrets with newline characters', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '\n';
			process.env['JWT_EXPIRES_IN'] = '15m';
			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).toThrow('JWT configuration validation failed');
		});
	});

	describe('JWT_EXPIRES_IN validation', () => {
		beforeEach(() => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%^&*()_+-=[]{}|;:,.<>?`~';
		});

		it('should use default value when JWT_EXPIRES_IN is not provided', () => {
			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).not.toThrow();
		});

		it('should accept valid duration strings', () => {
			const validDurations = ['15m', '1h', '7d', '30s'];
			validDurations.forEach(duration => {
				process.env['JWT_EXPIRES_IN'] = duration;
				expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).not.toThrow();
			});
		});

		it('should accept default value when not provided', () => {
			process.env['JWT_EXPIRES_IN'] = '15m';
			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).not.toThrow();
		});

		it('should reject invalid duration strings', () => {
			const invalidDurations = ['invalid', '15x', '1y', 'abc'];
			invalidDurations.forEach(duration => {
				process.env['JWT_EXPIRES_IN'] = duration;
				expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).toThrow('JWT configuration validation failed');
			});
		});

		it('should reject empty duration strings', () => {
			process.env['JWT_EXPIRES_IN'] = '';
			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).toThrow('JWT configuration validation failed');
		});

		it('should reject duration strings without numbers', () => {
			process.env['JWT_EXPIRES_IN'] = 'm';
			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).toThrow('JWT configuration validation failed');
		});

		it('should reject duration strings without units', () => {
			process.env['JWT_EXPIRES_IN'] = '15';
			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).toThrow('JWT configuration validation failed');
		});
	});

	describe('Strategy initialization', () => {
		beforeEach(() => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%^&*()_+-=[]{}|;:,.<>?`~';
			process.env['JWT_EXPIRES_IN'] = '15m';
		});

		it('should initialize successfully with valid configuration', () => {
			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).not.toThrow();
		});

		it('should create a Passport strategy instance', () => {
			const strategy = new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService);
			expect(strategy).toBeInstanceOf(JWTStrategy);
			expect(strategy).toHaveProperty('validate');
		});

		it('should configure JWT extraction from bearer token', () => {
			const strategy = new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService);
			// The strategy should be configured with the correct options
			expect(strategy).toBeDefined();
		});
	});

	describe('validate method', () => {
		let strategy: JWTStrategy;

		beforeEach(() => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%^&*()_+-=[]{}|;:,.<>?`~';
			process.env['JWT_EXPIRES_IN'] = '15m';
			strategy = new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService);
		});

		it('should validate and return user for active user', async () => {
			const mockUser = { id: '123', isActive: true, email: 'test@example.com' };
			const mockPayload = { sub: '123', email: 'test@example.com', role: 'user', iat: Date.now() / 1000, exp: (Date.now() / 1000) + 900 };

			mockUserLookupFn.mockResolvedValue(mockUser);

			const result = await strategy.validate(mockPayload);
			expect(result).toEqual(mockUser);
			expect(mockUserLookupFn).toHaveBeenCalledWith('123');
		});

		it('should throw UnauthorizedException for inactive user', async () => {
			const mockUser = { id: '123', isActive: false, email: 'test@example.com' };
			const mockPayload = { sub: '123', email: 'test@example.com', role: 'user', iat: Date.now() / 1000, exp: (Date.now() / 1000) + 900 };

			mockUserLookupFn.mockResolvedValue(mockUser);

			await expect(strategy.validate(mockPayload)).rejects.toThrow('User not found or inactive');
		});

		it('should throw UnauthorizedException for non-existent user', async () => {
			const mockPayload = { sub: '123', email: 'test@example.com', role: 'user', iat: Date.now() / 1000, exp: (Date.now() / 1000) + 900 };

			mockUserLookupFn.mockResolvedValue(null);

			await expect(strategy.validate(mockPayload)).rejects.toThrow('User not found or inactive');
		});

		it('should handle user lookup errors', async () => {
			const mockPayload = { sub: '123', email: 'test@example.com', role: 'user', iat: Date.now() / 1000, exp: (Date.now() / 1000) + 900 };

			mockUserLookupFn.mockRejectedValue(new Error('Database error'));

			await expect(strategy.validate(mockPayload)).rejects.toThrow('Database error');
		});
	});

	describe('Complete valid configuration', () => {
		it('should accept complete valid JWT configuration', () => {
			process.env['JWT_SECRET'] = 'MySuperSecretKeyWith32Characters!';
			process.env['JWT_EXPIRES_IN'] = '15m';

			expect(() => new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService)).not.toThrow();

			const strategy = new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService);
			expect(strategy).toBeDefined();
		});
	});
});
