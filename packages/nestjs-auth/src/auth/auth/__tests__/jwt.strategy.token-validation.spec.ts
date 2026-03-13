
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JWTStrategy } from '../jwt.strategy.js';
import { TokenBlacklistService } from '../token-blacklist.service.js';
import { TokenValidationService } from '../token-validation.service.js';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { USER_LOOKUP_FN } from '../tokens.js';

describe('JWT Strategy - Token Validation & User Lookup', () => {
	let mockUserLookupFn: any;
	let mockAppLogger: any;
	let mockTokenValidationService: any;
	let mockTokenBlacklistService: TokenBlacklistService;
	let mockModuleRef: any;
	let logCalls: any[];

	beforeEach(() => {
		logCalls = [];

		mockUserLookupFn = async (userId: string) => {
			if (userId === 'valid-user-id') {
				return {
					id: 'valid-user-id',
					email: 'user@example.com',
					isActive: true,
					role: 'user',
				};
			}
			return null;
		};

		mockTokenValidationService = {
			validateToken: (token: string, type: string) => {
				if (token === 'expired-token') {
					throw new Error('Token expired');
				}
				if (token === 'invalid-token') {
					throw new Error('Invalid signature');
				}
			},
		};

		mockAppLogger = {
			createContextualLogger: () => ({
				debug: (...args: any[]) => {
					logCalls.push({ level: 'debug', args });
				},
				info: (...args: any[]) => {
					logCalls.push({ level: 'info', args });
				},
				warn: (...args: any[]) => {
					logCalls.push({ level: 'warn', args });
				},
				error: (...args: any[]) => {
					logCalls.push({ level: 'error', args });
				},
			}),
		};

		mockTokenBlacklistService = {
			isTokenBlacklisted: vi.fn().mockResolvedValue(false),
			hasUserRevokedTokens: vi.fn().mockResolvedValue(false),
		} as unknown as TokenBlacklistService;

		mockModuleRef = {
			get(token: any) {
				if (token === USER_LOOKUP_FN) return mockUserLookupFn;
				if (token === AppLogger) return mockAppLogger;
				if (token === TokenValidationService) return mockTokenValidationService;
				if (token === TokenBlacklistService) return mockTokenBlacklistService;
				return null;
			},
		};

		process.env['JWT_SECRET'] = 'MySecretKeyWith32CharactersMin!@#$%';
		process.env['JWT_EXPIRES_IN'] = '15m';
	});

	afterEach(() => {
		delete process.env['JWT_SECRET'];
		delete process.env['JWT_EXPIRES_IN'];
	});

	describe('User Lookup Function', () => {
		it('should return user when userId exists', async () => {
			const user = await mockUserLookupFn('valid-user-id');

			expect(user).toBeDefined();
			expect(user?.email).toBe('user@example.com');
		});

		it('should return null when userId not found', async () => {
			const user = await mockUserLookupFn('unknown-user-id');

			expect(user).toBeNull();
		});

		it('should preserve user properties', async () => {
			const user = await mockUserLookupFn('valid-user-id');

			expect(user?.id).toBe('valid-user-id');
			expect(user?.email).toBe('user@example.com');
			expect(user?.isActive).toBe(true);
			expect(user?.role).toBe('user');
		});

		it('should handle multiple lookup calls', async () => {
			const user1 = await mockUserLookupFn('valid-user-id');
			const user2 = await mockUserLookupFn('valid-user-id');

			expect(user1).toEqual(user2);
		});
	});

	describe('Token Validation Service', () => {
		it('should validate valid tokens without throwing', () => {
			const validateToken = () => {
				mockTokenValidationService.validateToken('valid-token', 'access');
			};

			expect(validateToken).not.toThrow();
		});

		it('should throw for expired tokens', () => {
			const validateToken = () => {
				mockTokenValidationService.validateToken('expired-token', 'access');
			};

			expect(validateToken).toThrow('Token expired');
		});

		it('should throw for invalid tokens', () => {
			const validateToken = () => {
				mockTokenValidationService.validateToken('invalid-token', 'access');
			};

			expect(validateToken).toThrow('Invalid signature');
		});

		it('should accept token type parameter', () => {
			const validateToken = () => {
				mockTokenValidationService.validateToken('valid-token', 'refresh');
			};

			expect(validateToken).not.toThrow();
		});
	});

	describe('JWT Strategy Initialization', () => {
		it('should create strategy with valid configuration', () => {
			const strategy = new JWTStrategy(mockModuleRef);

			expect(strategy).toBeDefined();
		});

		it('should require JWT_SECRET environment variable', () => {
			delete process.env['JWT_SECRET'];
			process.env['JWT_EXPIRES_IN'] = '15m';

			expect(() => {
				new JWTStrategy(mockModuleRef);
			}).toThrow('JWT configuration validation failed');
		});

		it('should require minimum 32 character JWT_SECRET', () => {
			process.env['JWT_SECRET'] = 'short'; // Less than 32 chars
			process.env['JWT_EXPIRES_IN'] = '15m';

			expect(() => {
				new JWTStrategy(mockModuleRef);
			}).toThrow('JWT configuration validation failed');
		});

		it('should accept valid 32+ character secrets', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32);
			process.env['JWT_EXPIRES_IN'] = '15m';

			const strategy = new JWTStrategy(mockModuleRef);

			expect(strategy).toBeDefined();
		});

		it('should use default JWT_EXPIRES_IN when not provided', () => {
			delete process.env['JWT_EXPIRES_IN'];
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(mockModuleRef);

			expect(strategy).toBeDefined();
		});

		it('should reject invalid JWT_EXPIRES_IN format', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';
			process.env['JWT_EXPIRES_IN'] = 'invalid-format';

			expect(() => {
				new JWTStrategy(mockModuleRef);
			}).toThrow('JWT configuration validation failed');
		});

		it('should accept valid JWT_EXPIRES_IN formats', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const validFormats = ['15m', '1h', '7d', '30s'];

			validFormats.forEach(format => {
				process.env['JWT_EXPIRES_IN'] = format;
				const strategy = new JWTStrategy(mockModuleRef);
				expect(strategy).toBeDefined();
			});
		});
	});

	describe('Contextual Logger', () => {
		it('should create contextual logger from appLogger', () => {
			const strategy = new JWTStrategy(mockModuleRef);

			expect(strategy).toBeDefined();
			expect(mockAppLogger.createContextualLogger).toBeDefined();
		});

		it('should create logger with strategy name', () => {
			const loggerCalls: any[] = [];
			const mockLoggerFactory = (name: string) => {
				loggerCalls.push(name);
				return mockAppLogger.createContextualLogger();
			};

			const mockLoggerApp = {
				createContextualLogger: mockLoggerFactory,
			};

			const localModuleRef: any = {
				get(token: any) {
					if (token === USER_LOOKUP_FN) return mockUserLookupFn;
					if (token === AppLogger) return mockLoggerApp;
					if (token === TokenValidationService) return mockTokenValidationService;
					if (token === TokenBlacklistService) return mockTokenBlacklistService;
					return null;
				},
			};
			const strategy = new JWTStrategy(localModuleRef);

			expect(strategy).toBeDefined();
		});
	});

	describe('Passport Strategy Base', () => {
		it('should extend PassportStrategy with JWT strategy', () => {
			const strategy = new JWTStrategy(mockModuleRef);

			expect(strategy).toBeDefined();
			expect(typeof strategy.validate).toBe('function');
		});

		it('should have validate method', () => {
			const strategy = new JWTStrategy(mockModuleRef);

			expect(strategy.validate).toBeDefined();
			expect(typeof strategy.validate).toBe('function');
		});
	});

	describe('Configuration Edge Cases', () => {
		it('should accept special characters in JWT_SECRET', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%^&*()_+-=[]{}|;:,.<>?`~';
			process.env['JWT_EXPIRES_IN'] = '15m';

			const strategy = new JWTStrategy(mockModuleRef);

			expect(strategy).toBeDefined();
		});

		it('should reject space characters in JWT_SECRET', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + ' '; // Space not allowed
			process.env['JWT_EXPIRES_IN'] = '15m';

			expect(() => {
				new JWTStrategy(mockModuleRef);
			}).toThrow('JWT configuration validation failed');
		});

		it('should reject newline characters in JWT_SECRET', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '\n';
			process.env['JWT_EXPIRES_IN'] = '15m';

			expect(() => {
				new JWTStrategy(mockModuleRef);
			}).toThrow('JWT configuration validation failed');
		});

		it('should handle consecutive calls with different configuration', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#';
			const strategy1 = new JWTStrategy(mockModuleRef);

			process.env['JWT_SECRET'] = 'b'.repeat(32) + '$%^';
			const strategy2 = new JWTStrategy(mockModuleRef);

			expect(strategy1).toBeDefined();
			expect(strategy2).toBeDefined();
		});
	});
});
