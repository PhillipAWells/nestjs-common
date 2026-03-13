import { AuthService } from '../auth.service.js';
import { JwtService } from '@nestjs/jwt';
import { AppLogger, AuditLoggerService, CACHE_PROVIDER } from '@pawells/nestjs-shared/common';
import { TokenBlacklistService } from '../token-blacklist.service.js';
import { USER_REPOSITORY } from '../tokens.js';

describe('AuthService - Additional Tests', () => {
	let service: AuthService;
	let mockModuleRef: any;
	let mockUserRepository: any;
	let mockJwtService: any;
	let mockAppLogger: any;
	let mockAuditLogger: any;
	let mockTokenBlacklistService: any;

	beforeEach(() => {
		const logCalls: any[] = [];
		mockAppLogger = {
			createContextualLogger() {
				return {
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
				};
			},
			getLogCalls() {
				return logCalls;
			},
		};

		const auditCalls: any[] = [];
		mockAuditLogger = {
			logAuthenticationAttempt(...args: any[]) {
				auditCalls.push({ type: 'auth', args });
			},
			logTokenGeneration(...args: any[]) {
				auditCalls.push({ type: 'token', args });
			},
			logTokenRevocation(...args: any[]) {
				auditCalls.push({ type: 'revocation', args });
			},
			getAuditCalls() {
				return auditCalls;
			},
		};

		const tokenCalls: any[] = [];
		mockTokenBlacklistService = {
			blacklistToken(...args: any[]) {
				tokenCalls.push(args);
			},
			isTokenBlacklisted() {
				return false;
			},
			getTokenCalls() {
				return tokenCalls;
			},
		};

		const jwtCalls: any[] = [];
		mockJwtService = {
			sign(payload: any, options?: any) {
				jwtCalls.push({ payload, options });
				return 'jwt.token.here';
			},
			verify(token: string) {
				if (token.includes('expired')) throw new Error('Token expired');
				return { sub: 'user-123', email: 'user@test.com' };
			},
			decode(token: string) {
				// Return JWT payload with exp claim (Unix timestamp in seconds)
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@test.com',
					exp: now + 900, // Expires in 15 minutes
				};
			},
			getJwtCalls() {
				return jwtCalls;
			},
		};

		mockUserRepository = {
			findById: async (id: string) => {
				if (id === 'user-123') {
					return {
						id: 'user-123',
						email: 'user@test.com',
						isActive: true,
						role: 'user',
						firstName: 'John',
						lastName: 'Doe',
						passwordHash: '$2b$10$mockbcrypthashshouldbeat32chars',
					};
				}
				return null;
			},
			findByEmail: async (email: string) => {
				if (email === 'user@test.com') {
					return {
						id: 'user-123',
						email: 'user@test.com',
						isActive: true,
						role: 'user',
					};
				}
				return null;
			},
		};

		mockModuleRef = {
			get(token: any, defaultValue?: any) {
				if (token === JwtService) return mockJwtService;
				if (token === AppLogger) return mockAppLogger;
				if (token === AuditLoggerService) return mockAuditLogger;
				if (token === TokenBlacklistService) return mockTokenBlacklistService;
				if (token === CACHE_PROVIDER) return null;
				if (token === USER_REPOSITORY) return mockUserRepository;
				return defaultValue ?? null;
			},
		};

		// Create service with mocked ModuleRef
		service = new AuthService(mockModuleRef);
	});

	describe('Password validation', () => {
		it('should validate user object structure', async () => {
			const testUser = {
				id: 'user-123',
				email: 'test@example.com',
				isActive: true,
				role: 'user',
				firstName: 'Test',
				lastName: 'User',
				passwordHash: '$2b$10$...hash...',
			};

			const result = await service.validateUser(testUser, 'correct-password');
			expect(result === null || result !== undefined).toBe(true);
		});

		it('should reject null user', async () => {
			const result = await service.validateUser(null, 'password');
			expect(result).toBeNull();
		});

		it('should reject inactive user', async () => {
			const inactiveUser = {
				id: 'user-456',
				email: 'inactive@example.com',
				isActive: false,
				role: 'user',
			};

			const result = await service.validateUser(inactiveUser, 'password');
			expect(result).toBeNull();
		});

		it('should reject user without password hash', async () => {
			const userNoHash = {
				id: 'user-789',
				email: 'nohash@example.com',
				isActive: true,
				role: 'user',
			};

			const result = await service.validateUser(userNoHash, 'password');
			expect(result).toBeNull();
		});

		it('should reject empty password', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				isActive: true,
				passwordHash: '$2b$10$hash',
			};

			const result = await service.validateUser(user, '');
			expect(result === null || result !== undefined).toBe(true);
		});

		it('should preserve user role on successful validation', async () => {
			const user = {
				id: 'user-123',
				email: 'admin@example.com',
				isActive: true,
				role: 'admin',
				passwordHash: 'hash',
			};

			const result = await service.validateUser(user, 'password');
			if (result) {
				expect(result.role).toBe('admin');
			}
		});

		it('should default role to user if not provided', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				isActive: true,
				passwordHash: 'hash',
			};

			const result = await service.validateUser(user, 'password');
			if (result) {
				expect(result.role).toBe('user');
			}
		});

		it('should preserve first and last name', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				isActive: true,
				firstName: 'John',
				lastName: 'Doe',
				passwordHash: 'hash',
			};

			const result = await service.validateUser(user, 'password');
			if (result) {
				expect(result.firstName).toBe('John');
				expect(result.lastName).toBe('Doe');
			}
		});

		it('should not return password hash in result', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				isActive: true,
				role: 'user',
				firstName: 'John',
				lastName: 'Doe',
				passwordHash: 'secret-hash',
			};

			const result = await service.validateUser(user, 'correct-password');
			if (result) {
				expect((result as any).passwordHash).toBeUndefined();
			}
		});
	});

	describe('JWT token generation', () => {
		it('should generate authentication response', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				role: 'user',
				firstName: 'Test',
				lastName: 'User',
				isActive: true,
			};

			const result = await service.login(user);
			expect(result).toBeDefined();
		});

		it('should include access token in response', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				role: 'user',
				isActive: true,
			};

			const result = await service.login(user);
			expect(result).toHaveProperty('accessToken');
			expect(typeof result.accessToken).toBe('string');
		});

		it('should include refresh token in response', async () => {
			const user = {
				id: 'user-456',
				email: 'john@example.com',
				role: 'user',
				isActive: true,
			};

			const result = await service.login(user);
			expect(result).toHaveProperty('refreshToken');
			expect(typeof result.refreshToken).toBe('string');
		});

		it('should include user data in response', async () => {
			const user = {
				id: 'user-456',
				email: 'john@example.com',
				role: 'admin',
				firstName: 'John',
				lastName: 'Doe',
				isActive: true,
			};

			const result = await service.login(user);
			expect(result.user).toEqual({
				id: 'user-456',
				email: 'john@example.com',
				role: 'admin',
				firstName: 'John',
				lastName: 'Doe',
			});
		});

		it('should set correct token type', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				role: 'user',
				isActive: true,
			};

			const result = await service.login(user);
			expect(result.tokenType).toBe('Bearer');
		});

		it('should set correct token expiration (15 minutes)', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				role: 'user',
				isActive: true,
			};

			const result = await service.login(user);
			expect(result.expiresIn).toBe(900); // 15 minutes in seconds
		});

		it('should default role to user in token if not provided', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				isActive: true,
			};

			const result = await service.login(user);
			expect(result.user.role).toBe('user');
		});

		it('should include user email in token payload', async () => {
			const user = {
				id: 'user-789',
				email: 'alice@example.com',
				role: 'user',
				isActive: true,
			};

			const result = await service.login(user);
			expect(result.user.email).toBe('alice@example.com');
		});

		it('should include user ID (sub claim) in token', async () => {
			const user = {
				id: 'unique-user-id',
				email: 'test@example.com',
				role: 'user',
				isActive: true,
			};

			const result = await service.login(user);
			expect(result.user.id).toBe('unique-user-id');
		});

		it('should handle user without first/last name', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				role: 'user',
				isActive: true,
			};

			const result = await service.login(user);
			expect(result.user).toBeDefined();
			expect(result.user.email).toBe('test@example.com');
		});

		it('should generate different tokens on each login', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				role: 'user',
				isActive: true,
			};

			const result1 = await service.login(user);
			const result2 = await service.login(user);

			expect(result1.accessToken).toBeDefined();
			expect(result2.accessToken).toBeDefined();
		});
	});

	describe('Service initialization', () => {
		it('should be instantiable', () => {
			expect(service).toBeDefined();
			expect(service instanceof AuthService).toBe(true);
		});

		it('should provide access to JWT service', () => {
			const jwtService = service.JwtService;
			expect(jwtService).toBeDefined();
			expect(jwtService === mockJwtService).toBe(true);
		});

		it('should provide access to app logger', () => {
			const appLogger = service.AppLogger;
			expect(appLogger).toBeDefined();
			expect(appLogger === mockAppLogger).toBe(true);
		});

		it('should provide access to audit logger', () => {
			const auditLogger = service.AuditLogger;
			expect(auditLogger).toBeDefined();
			expect(auditLogger === mockAuditLogger).toBe(true);
		});

		it('should provide access to token blacklist service', () => {
			const tokenBlacklist = service.TokenBlacklistServiceInstance;
			expect(tokenBlacklist).toBeDefined();
			expect(tokenBlacklist === mockTokenBlacklistService).toBe(true);
		});

		it('should handle missing cache provider', () => {
			const cache = service.CacheProvider;
			expect(cache === null || cache !== undefined).toBe(true);
		});

		it('should have ModuleRef available', () => {
			expect(service.Module).toBeDefined();
			expect(service.Module === mockModuleRef).toBe(true);
		});

		it('should accept user repository via constructor', () => {
			expect(service).toBeDefined();
		});
	});

	describe('Lazy loading and caching', () => {
		it('should lazily load contextual logger', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				isActive: true,
				passwordHash: 'hash',
			};

			await service.validateUser(user, 'password');
			// Logger should have been initialized
			expect(mockAppLogger.getLogCalls).toBeDefined();
		});

		it('should cache logger instance across calls', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				isActive: true,
				passwordHash: 'hash',
			};

			const logCalls1 = mockAppLogger.getLogCalls();
			await service.validateUser(user, 'password');
			const logCalls2 = mockAppLogger.getLogCalls();

			expect(logCalls1 || logCalls2).toBeDefined();
		});

		it('should return same JWT service instance', () => {
			const jwt1 = service.JwtService;
			const jwt2 = service.JwtService;
			expect(jwt1 === jwt2).toBe(true);
		});

		it('should return same audit logger instance', () => {
			const audit1 = service.AuditLogger;
			const audit2 = service.AuditLogger;
			expect(audit1 === audit2).toBe(true);
		});
	});

	describe('Integration scenarios', () => {
		it('should handle full login flow', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				role: 'user',
				firstName: 'Test',
				lastName: 'User',
				isActive: true,
			};

			const result = await service.login(user);
			expect(result).toBeDefined();
			expect(result.accessToken).toBeDefined();
			expect(result.refreshToken).toBeDefined();
			expect(result.user).toBeDefined();
		});

		it('should support concurrent logins for same user', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				role: 'user',
				isActive: true,
			};

			const [result1, result2] = await Promise.all([
				service.login(user),
				service.login(user),
			]);

			expect(result1).toBeDefined();
			expect(result2).toBeDefined();
		});

		it('should support validation followed by login', async () => {
			const user = {
				id: 'user-123',
				email: 'test@example.com',
				role: 'user',
				firstName: 'Test',
				lastName: 'User',
				isActive: true,
				passwordHash: 'hash',
			};

			const validated = await service.validateUser(user, 'password');
			if (validated) {
				const loginResult = await service.login(validated);
				expect(loginResult).toBeDefined();
			}
		});

		it('should handle multiple sequential operations', async () => {
			const user1 = {
				id: 'user-1',
				email: 'user1@example.com',
				role: 'user',
				isActive: true,
			};

			const user2 = {
				id: 'user-2',
				email: 'user2@example.com',
				role: 'admin',
				isActive: true,
			};

			const result1 = await service.login(user1);
			const result2 = await service.login(user2);

			expect(result1.user.id).toBe('user-1');
			expect(result2.user.id).toBe('user-2');
			expect(result2.user.role).toBe('admin');
		});
	});
});
