
import { AuthService } from '../auth.service.js';
import * as bcrypt from 'bcryptjs';

describe('Auth Service - User Validation & Token Management', () => {
	let service: AuthService;
	let mockRepository: any;
	let mockModuleRef: any;
	let mockJwtService: any;
	let mockAppLogger: any;
	let mockAuditLogger: any;
	let logCalls: any[];

	beforeEach(async () => {
		logCalls = [];

		mockRepository = {
			FindById: async (id: string) => {
				if (id === 'valid-user-id') {
					return {
						id: 'valid-user-id',
						email: 'user@example.com',
						passwordHash: await bcrypt.hash('password123', 10),
						isActive: true,
						role: 'user',
						firstName: 'John',
						lastName: 'Doe'
					};
				}
				return null;
			}
		};

		mockJwtService = {
			sign: (payload: any) => 'jwt-token-signed',
			verify: (token: string) => ({ sub: 'user-id', iat: Date.now() })
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
				}
			})
		};

		mockAuditLogger = {
			logAuthenticationAttempt: (email: string, success: boolean, userId?: string, reason?: string) => {
				logCalls.push({ method: 'logAuthenticationAttempt', email, success, userId, reason });
			},
			logTokenRefresh: (userId: string, newTokenId: string) => {
				logCalls.push({ method: 'logTokenRefresh', userId, newTokenId });
			}
		};

		mockModuleRef = {
			get: (token: any, defaultValue?: any) => {
				if (token === 'JwtService') return mockJwtService;
				if (token === 'AppLogger') return mockAppLogger;
				if (token === 'AuditLoggerService') return mockAuditLogger;
				if (token === 'TokenBlacklistService') return { isTokenBlacklisted: async () => false };
				if (token === 'CACHE_PROVIDER') return defaultValue ?? null;
				return null;
			}
		};

		service = new AuthService(mockModuleRef, mockRepository);
	});

	describe('validateUser() - Normal Operation', () => {
		it('should validate correct password and return user', async () => {
			const user = {
				id: 'valid-user-id',
				email: 'user@example.com',
				isActive: true,
				role: 'user',
				firstName: 'John',
				lastName: 'Doe',
				passwordHash: await bcrypt.hash('password123', 10)
			};

			const result = await service.validateUser(user, 'password123');

			expect(result).toBeDefined();
			expect(result?.email).toBe('user@example.com');
			expect(result?.id).toBe('valid-user-id');
		});

		it('should return user without passwordHash for security', async () => {
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				role: 'user',
				firstName: 'John',
				lastName: 'Doe',
				passwordHash: await bcrypt.hash('password123', 10)
			};

			const result = await service.validateUser(user, 'password123');

			expect(result).toBeDefined();
			expect((result as any).passwordHash).toBeUndefined();
		});

		it('should log authentication success', async () => {
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				passwordHash: await bcrypt.hash('password123', 10)
			};

			await service.validateUser(user, 'password123');

			const debugLog = logCalls.find(l => l.level === 'debug' && l.args[0].includes('User validation successful'));
			expect(debugLog).toBeDefined();
		});
	});

	describe('validateUser() - Password Validation', () => {
		it('should reject incorrect password', async () => {
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				passwordHash: await bcrypt.hash('password123', 10)
			};

			const result = await service.validateUser(user, 'wrongpassword');

			expect(result).toBeNull();
		});

		it('should log authentication failure for wrong password', async () => {
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				passwordHash: await bcrypt.hash('password123', 10)
			};

			await service.validateUser(user, 'wrongpassword');

			const auditLog = logCalls.find(l => l.method === 'logAuthenticationAttempt');
			expect(auditLog).toBeDefined();
			expect(auditLog.success).toBe(false);
			expect(auditLog.reason).toContain('Invalid password');
		});
	});

	describe('validateUser() - User Status', () => {
		it('should reject inactive users', async () => {
			const inactiveUser = {
				id: 'inactive-user-id',
				email: 'inactive@example.com',
				isActive: false,
				passwordHash: await bcrypt.hash('password123', 10)
			};

			const result = await service.validateUser(inactiveUser, 'password123');

			expect(result).toBeNull();
		});

		it('should log authentication failure for inactive user', async () => {
			const inactiveUser = {
				id: 'inactive-user-id',
				email: 'inactive@example.com',
				isActive: false,
				passwordHash: await bcrypt.hash('password123', 10)
			};

			await service.validateUser(inactiveUser, 'password123');

			const auditLog = logCalls.find(l => l.method === 'logAuthenticationAttempt');
			expect(auditLog).toBeDefined();
			expect(auditLog.success).toBe(false);
			expect(auditLog.reason).toContain('User inactive or not found');
		});

		it('should reject null user', async () => {
			const result = await service.validateUser(null, 'password123');

			expect(result).toBeNull();
		});
	});

	describe('validateUser() - Missing Password Hash', () => {
		it('should reject user without passwordHash', async () => {
			const userWithoutHash = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true
				// No passwordHash property
			};

			const result = await service.validateUser(userWithoutHash as any, 'password123');

			expect(result).toBeNull();
		});

		it('should log audit entry when passwordHash missing', async () => {
			const userWithoutHash = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true
			};

			await service.validateUser(userWithoutHash as any, 'password123');

			const auditLog = logCalls.find(l => l.method === 'logAuthenticationAttempt' && l.reason.includes('No password hash'));
			expect(auditLog).toBeDefined();
		});
	});

	describe('validateUser() - Edge Cases', () => {
		it('should handle empty password string', async () => {
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				passwordHash: await bcrypt.hash('password123', 10)
			};

			const result = await service.validateUser(user, '');

			expect(result).toBeNull();
		});

		it('should handle very long password strings', async () => {
			const longPassword = 'a'.repeat(1000);
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				passwordHash: await bcrypt.hash('password123', 10)
			};

			const result = await service.validateUser(user, longPassword);

			expect(result).toBeNull();
		});

		it('should handle special characters in password', async () => {
			const specialPassword = 'P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?';
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				passwordHash: await bcrypt.hash(specialPassword, 10)
			};

			const result = await service.validateUser(user, specialPassword);

			expect(result).toBeDefined();
		});
	});

	describe('validateUser() - User Profile Construction', () => {
		it('should preserve user id in response', async () => {
			const user = {
				id: 'unique-user-id-123',
				email: 'user@example.com',
				isActive: true,
				role: 'admin',
				firstName: 'John',
				lastName: 'Doe',
				passwordHash: await bcrypt.hash('password123', 10)
			};

			const result = await service.validateUser(user, 'password123');

			expect(result?.id).toBe('unique-user-id-123');
		});

		it('should preserve email in response', async () => {
			const user = {
				id: 'user-id',
				email: 'specific@example.com',
				isActive: true,
				role: 'user',
				firstName: 'John',
				lastName: 'Doe',
				passwordHash: await bcrypt.hash('password123', 10)
			};

			const result = await service.validateUser(user, 'password123');

			expect(result?.email).toBe('specific@example.com');
		});

		it('should default role to "user" if not provided', async () => {
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				// No role property
				passwordHash: await bcrypt.hash('password123', 10)
			};

			const result = await service.validateUser(user as any, 'password123');

			expect(result?.role).toBe('user');
		});

		it('should preserve role if provided', async () => {
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				role: 'admin',
				firstName: 'John',
				lastName: 'Doe',
				passwordHash: await bcrypt.hash('password123', 10)
			};

			const result = await service.validateUser(user, 'password123');

			expect(result?.role).toBe('admin');
		});

		it('should preserve firstName and lastName', async () => {
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				role: 'user',
				firstName: 'Jane',
				lastName: 'Smith',
				passwordHash: await bcrypt.hash('password123', 10)
			};

			const result = await service.validateUser(user, 'password123');

			expect(result?.firstName).toBe('Jane');
			expect(result?.lastName).toBe('Smith');
		});
	});

	describe('validateUser() - Bcrypt Integration', () => {
		it('should use bcrypt.compare for password validation', async () => {
			const compareSpy = jest.spyOn(bcrypt, 'compare');
			const hashedPassword = await bcrypt.hash('password123', 10);
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				passwordHash: hashedPassword
			};

			await service.validateUser(user, 'password123');

			expect(compareSpy).toHaveBeenCalledWith('password123', hashedPassword);
			compareSpy.mockRestore();
		});

		it('should handle bcrypt errors gracefully', async () => {
			const errorHashPassword = 'invalid-hash-format-not-bcrypt';
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				passwordHash: errorHashPassword
			};

			await expect(service.validateUser(user, 'password123')).rejects.toThrow();
		});
	});

	describe('Lazy ModuleRef Pattern', () => {
		it('should have JwtService getter', () => {
			expect(service.JwtService).toBeDefined();
		});

		it('should have AppLogger getter', () => {
			expect(service.AppLogger).toBeDefined();
		});

		it('should have AuditLogger getter', () => {
			expect(service.AuditLogger).toBeDefined();
		});

		it('should have TokenBlacklistServiceInstance getter', () => {
			expect(service.TokenBlacklistServiceInstance).toBeDefined();
		});

		it('should have CacheProvider getter', () => {
			const cacheProvider = service.CacheProvider;
			expect(cacheProvider === null || cacheProvider === undefined).toBe(true);
		});
	});

	describe('Audit Logging', () => {
		it('should log with user email when available', async () => {
			const user = {
				id: 'user-id',
				email: 'test@example.com',
				isActive: true,
				passwordHash: await bcrypt.hash('password123', 10)
			};

			await service.validateUser(user, 'password123');

			const auditLog = logCalls.find(l => l.method === 'logAuthenticationAttempt');
			expect(auditLog?.email).toBe('test@example.com');
		});

		it('should log success status correctly', async () => {
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				passwordHash: await bcrypt.hash('password123', 10)
			};

			await service.validateUser(user, 'password123');

			const successLog = logCalls.find(l => l.method === 'logAuthenticationAttempt' && l.success === true);
			expect(successLog).toBeDefined();
		});

		it('should log failure status correctly', async () => {
			const user = {
				id: 'user-id',
				email: 'user@example.com',
				isActive: true,
				passwordHash: await bcrypt.hash('password123', 10)
			};

			await service.validateUser(user, 'wrongpassword');

			const failureLog = logCalls.find(l => l.method === 'logAuthenticationAttempt' && l.success === false);
			expect(failureLog).toBeDefined();
		});
	});
});
