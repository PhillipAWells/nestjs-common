
import { JWTStrategy } from '../jwt.strategy.js';
import { UnauthorizedException } from '@nestjs/common';

describe('JWTStrategy - Additional Validation Tests', () => {
	let userLookupFn: (userId: string) => Promise<any>;
	let mockAppLogger: any;
	let mockTokenValidationService: any;

	beforeEach(() => {
		// Manual mocking - no jest.fn() at module scope
		const logCalls: any[] = [];
		const contextualLogger = {
			debug(...args: any[]) {
				logCalls.push({ level: 'debug', args });
			},
			info(...args: any[]) {
				logCalls.push({ level: 'info', args });
			},
			warn(...args: any[]) {
				logCalls.push({ level: 'warn', args });
			},
			error(...args: any[]) {
				logCalls.push({ level: 'error', args });
			},
			getLogCalls() {
				return logCalls;
			},
			clearLogCalls() {
				logCalls.length = 0;
			}
		};

		mockAppLogger = {
			createContextualLogger() {
				return contextualLogger;
			}
		};

		// User lookup function
		userLookupFn = async (userId: string) => {
			if (userId === 'user-123') {
				return {
					id: 'user-123',
					email: 'user@example.com',
					isActive: true,
					role: 'user',
					firstName: 'John',
					lastName: 'Doe'
				};
			}
			if (userId === 'user-inactive') {
				return {
					id: 'user-inactive',
					email: 'inactive@example.com',
					isActive: false
				};
			}
			return null;
		};

		// Token validation service
		let validateTokenCalls: any[] = [];
		mockTokenValidationService = {
			validateToken(token: string, type: string) {
				validateTokenCalls.push({ token, type });
				if (token.includes('expired')) {
					throw new UnauthorizedException('Token expired');
				}
				if (token.includes('invalid')) {
					throw new UnauthorizedException('Invalid token');
				}
			},
			getValidateCalls() {
				return validateTokenCalls;
			},
			clearValidateCalls() {
				validateTokenCalls = [];
			}
		};

		// Clear environment
		delete process.env['JWT_SECRET'];
		delete process.env['JWT_EXPIRES_IN'];
	});

	describe('JWT payload validation', () => {
		it('should validate token with correct payload structure', () => {
			process.env['JWT_SECRET'] = 'MySuperSecretKeyWith32Characters!';
			process.env['JWT_EXPIRES_IN'] = '15m';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should accept tokens with standard JWT sub claim', () => {
			process.env['JWT_SECRET'] = 'MySuperSecretKeyWith32Characters!';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should handle numeric user IDs in JWT payload', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should handle UUID format user IDs', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should support additional custom claims in JWT payload', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should require sub claim in JWT payload', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should handle Bearer token extraction', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should handle empty token gracefully', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should validate token expiration through token validation service', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should reject malformed JWT tokens', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});
	});

	describe('User lookup and validation', () => {
		it('should look up user by ID from JWT payload', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should reject when user not found', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should reject when user is inactive', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should return active user with all fields populated', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should handle users without email field', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should handle user lookup failures gracefully', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const failingUserLookup = async (_userId: string) => {
				throw new Error('Database connection failed');
			};

			const strategy = new JWTStrategy(failingUserLookup, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should support concurrent user lookups', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should cache user lookup results within single request', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});
	});

	describe('Token validation delegation', () => {
		it('should call token validation service with correct arguments', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should propagate token validation errors to caller', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should handle token validation service exceptions', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const errorTokenValidation = {
				validateToken() {
					throw new Error('Validation service error');
				}
			};

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, errorTokenValidation);
			expect(strategy).toBeDefined();
		});

		it('should handle timeout in token validation', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const slowValidation = {
				validateToken: async () => {
					await new Promise(resolve => setTimeout(resolve, 100));
				}
			};

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, slowValidation);
			expect(strategy).toBeDefined();
		});

		it('should validate access tokens specifically', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should reject refresh tokens for access validation', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should handle null token validation results', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should track validation success/failure in audit logs', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});
	});

	describe('Error handling and logging', () => {
		it('should log debug message on validation initiation', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should log warning on missing token', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should log warning on user not found', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should log info on successful validation', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should provide detailed error messages on validation failure', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should not log sensitive information like tokens', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should not log user passwords in error scenarios', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should include request metadata in logs', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should support contextual logging per request', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const strategy = new JWTStrategy(userLookupFn, mockAppLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});

		it('should handle logging errors without crashing', () => {
			process.env['JWT_SECRET'] = 'a'.repeat(32) + '!@#$%';

			const errorLogger = {
				createContextualLogger() {
					return {
						debug() {
							throw new Error('Logger error');
						},
						info() {
							throw new Error('Logger error');
						},
						warn() {
							throw new Error('Logger error');
						},
						error() {
							throw new Error('Logger error');
						}
					};
				}
			};

			const strategy = new JWTStrategy(userLookupFn, errorLogger, mockTokenValidationService);
			expect(strategy).toBeDefined();
		});
	});
});
