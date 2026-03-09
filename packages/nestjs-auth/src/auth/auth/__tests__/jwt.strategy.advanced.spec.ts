
import { UnauthorizedException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JWTStrategy } from '../jwt.strategy.js';
import type { TokenBlacklistService } from '../token-blacklist.service.js';

// Helper to create a mock Express request object
function createMockRequest(authHeader?: string) {
	const headers: Record<string, string> = {};
	if (authHeader) {
		headers['authorization'] = authHeader;
	}

	return {
		headers,
		get: (name: string) => headers[name.toLowerCase()],
	} as any;
}

describe('JWT Strategy - Advanced Validation & Token Handling', () => {
	let strategy: JWTStrategy;
	let mockUserLookupFn: any;
	let mockAppLogger: any;
	let mockTokenValidationService: any;
	let mockTokenBlacklistService: unknown;
	let logCalls: any[];
	let validateTokenCalls: any[];

	beforeEach(() => {
		logCalls = [];
		validateTokenCalls = [];

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
				validateTokenCalls.push({ token, type });
				if (token === 'expired-token') {
					throw new Error('Token expired');
				}
				if (token === 'invalid-token') {
					throw new Error('Invalid signature');
				}
			},
		};

		mockTokenBlacklistService = {
			isTokenBlacklisted: vi.fn().mockResolvedValue(false),
			hasUserRevokedTokens: vi.fn().mockResolvedValue(false),
		} as unknown as TokenBlacklistService;

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

		// Set valid JWT configuration
		process.env['JWT_SECRET'] = 'MySecretKeyWith32CharactersMin!@#$%';
		process.env['JWT_EXPIRES_IN'] = '15m';

		strategy = new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService);
	});

	afterEach(() => {
		delete process.env['JWT_SECRET'];
		delete process.env['JWT_EXPIRES_IN'];
	});

	describe('validate() - Normal Operation', () => {
		it('should validate JWT payload and return active user', async () => {
			const payload = { sub: 'valid-user-id', email: 'user@example.com', role: 'user' };
			const request = createMockRequest('Bearer valid-token');

			const user = await strategy.validate(payload, request);

			expect(user).toEqual({
				id: 'valid-user-id',
				email: 'user@example.com',
				isActive: true,
				role: 'user',
			});

			const infoLog = logCalls.find(l => l.level === 'info');
			expect(infoLog).toBeDefined();
			expect(infoLog.args[0]).toContain('JWT validation successful');
		});

		it('should log debug message when JWT validation initiates', async () => {
			const payload = { sub: 'valid-user-id', email: 'user@example.com', role: 'user' };
			const request = createMockRequest('Bearer valid-token');

			await strategy.validate(payload, request);

			const debugLog = logCalls.find(l => l.level === 'debug' && l.args[0].includes('JWT validation initiated'));
			expect(debugLog).toBeDefined();
		});
	});

	describe('validate() - Token Extraction', () => {
		it('should throw UnauthorizedException when no token in request', async () => {
			const payload = { sub: 'valid-user-id', email: 'user@example.com', role: 'user' };
			const request = createMockRequest();

			await expect(strategy.validate(payload, request)).rejects.toThrow(UnauthorizedException);
			await expect(strategy.validate(payload, request)).rejects.toThrow('No token provided');
		});

		it('should log warning when no token provided', async () => {
			const payload = { sub: 'valid-user-id', email: 'user@example.com', role: 'user' };
			const request = createMockRequest();

			try {
				await strategy.validate(payload, request);
			} catch (e) {
				// Expected
			}

			const warnLog = logCalls.find(l => l.level === 'warn' && l.args[0].includes('no token provided'));
			expect(warnLog).toBeDefined();
		});
	});

	describe('validate() - Token Validation', () => {
		it('should call tokenValidationService for comprehensive token validation', async () => {
			const payload = { sub: 'valid-user-id', email: 'user@example.com', role: 'user' };
			const request = createMockRequest('Bearer valid-token');

			validateTokenCalls = [];
			await strategy.validate(payload, request);

			expect(validateTokenCalls).toHaveLength(1);
			expect(validateTokenCalls[0]).toEqual({ token: 'valid-token', type: 'access' });
		});

		it('should throw error when token validation fails', async () => {
			const payload = { sub: 'valid-user-id', email: 'user@example.com', role: 'user' };
			const request = createMockRequest('Bearer expired-token');

			await expect(strategy.validate(payload, request)).rejects.toThrow('Token expired');
		});

		it('should log warning when token validation fails', async () => {
			const payload = { sub: 'valid-user-id', email: 'user@example.com', role: 'user' };
			const request = createMockRequest('Bearer expired-token');

			try {
				await strategy.validate(payload, request);
			} catch (e) {
				// Expected
			}

			const warnLog = logCalls.find(l => l.level === 'warn' && l.args[0].includes('Token validation failed'));
			expect(warnLog).toBeDefined();
		});
	});

	describe('validate() - User Lookup', () => {
		it('should lookup user by JWT sub claim', async () => {
			const payload = { sub: 'valid-user-id', email: 'user@example.com', role: 'user' };
			const request = createMockRequest('Bearer valid-token');

			const user = await strategy.validate(payload, request);

			// Verify lookupFn was called by checking the returned user
			expect(user).toBeDefined();
			expect(user.id).toBe('valid-user-id');
		});

		it('should throw UnauthorizedException when user not found', async () => {
			const payload = { sub: 'unknown-user-id', email: 'unknown@example.com', role: 'user' };
			const request = createMockRequest('Bearer valid-token');

			await expect(strategy.validate(payload, request)).rejects.toThrow(UnauthorizedException);
			await expect(strategy.validate(payload, request)).rejects.toThrow('User not found or inactive');
		});

		it('should throw UnauthorizedException when user is inactive', async () => {
			const inactiveUserLookup = async () => ({
				id: 'inactive-user-id',
				email: 'inactive@example.com',
				isActive: false,
				role: 'user',
			});

			const inactiveStrategy = new JWTStrategy(inactiveUserLookup, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService);

			const payload = { sub: 'inactive-user-id', email: 'inactive@example.com', role: 'user' };
			const request = createMockRequest('Bearer valid-token');

			await expect(inactiveStrategy.validate(payload, request)).rejects.toThrow(UnauthorizedException);
		});

		it('should log warning when user inactive or not found', async () => {
			const payload = { sub: 'unknown-user-id', email: 'unknown@example.com', role: 'user' };
			const request = createMockRequest('Bearer valid-token');

			try {
				await strategy.validate(payload, request);
			} catch (e) {
				// Expected
			}

			const warnLog = logCalls.find(l => l.level === 'warn' && l.args[0].includes('not found or inactive'));
			expect(warnLog).toBeDefined();
		});
	});

	describe('validate() - Error Handling', () => {
		it('should propagate token validation errors', async () => {
			const payload = { sub: 'valid-user-id', email: 'user@example.com', role: 'user' };
			const request = createMockRequest('Bearer invalid-token');

			await expect(strategy.validate(payload, request)).rejects.toThrow('Invalid signature');
		});

		it('should handle missing payload.sub gracefully', async () => {
			const payload = { sub: null, email: 'test@example.com', role: 'user' };
			const request = createMockRequest('Bearer valid-token');

			await expect(strategy.validate(payload as any, request)).rejects.toThrow();
		});
	});

	describe('Configuration Validation', () => {
		it('should use JWT_SECRET from environment', () => {
			process.env['JWT_SECRET'] = 'AnotherSecretKeyWith32Characters!@';
			process.env['JWT_EXPIRES_IN'] = '1h';

			const newStrategy = new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService);
			expect(newStrategy).toBeDefined();
		});

		it('should use default JWT_EXPIRES_IN when not provided', () => {
			delete process.env['JWT_EXPIRES_IN'];
			process.env['JWT_SECRET'] = 'SecretKeyWith32CharactersRequired!@';

			const newStrategy = new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService);
			expect(newStrategy).toBeDefined();
		});

		it('should throw when JWT_SECRET missing', () => {
			delete process.env['JWT_SECRET'];
			process.env['JWT_EXPIRES_IN'] = '15m';

			expect(() => {
				new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService);
			}).toThrow('JWT configuration validation failed');
		});

		it('should throw when JWT_SECRET too short', () => {
			process.env['JWT_SECRET'] = 'short'; // Less than 32 chars
			process.env['JWT_EXPIRES_IN'] = '15m';

			expect(() => {
				new JWTStrategy(mockUserLookupFn, mockAppLogger, mockTokenValidationService, mockTokenBlacklistService);
			}).toThrow('JWT configuration validation failed');
		});
	});
});
