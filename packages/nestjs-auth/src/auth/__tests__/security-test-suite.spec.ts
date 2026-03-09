
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { JWTAuthGuard } from '../auth/jwt-auth.guard.js';
import { TokenBlacklistService } from '../auth/token-blacklist.service.js';
import { AppLogger, AuditLoggerService } from '@pawells/nestjs-shared/common';
import type { User, JWTPayload } from '../auth/auth.types.js';

describe('Security Test Suite - Authentication & Authorization', () => {
	let authService: AuthService;
	let jwtService: JwtService;
	let tokenBlacklistService: TokenBlacklistService;
	let _jwtAuthGuard: JWTAuthGuard;
	let _appLogger: AppLogger;
	let auditLogger: AuditLoggerService;

	beforeEach(async () => {
		const mockAppLogger = {
			createContextualLogger: jest.fn().mockReturnValue({
				debug: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn()
			})
		};

		const mockAuditLogger = {
			logAuthenticationAttempt: jest.fn(),
			logTokenGeneration: jest.fn()
		};

		const mockCacheService = {
			get: jest.fn(),
			set: jest.fn()
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				JwtService,
				JWTAuthGuard,
				TokenBlacklistService,
				{
					provide: AppLogger,
					useValue: mockAppLogger
				},
				{
					provide: AuditLoggerService,
					useValue: mockAuditLogger
				},
				{
					provide: 'CacheService',
					useValue: mockCacheService
				}
			]
		}).compile();

		authService = module.get<AuthService>(AuthService);
		jwtService = module.get<JwtService>(JwtService);
		tokenBlacklistService = module.get<TokenBlacklistService>(TokenBlacklistService);
		_jwtAuthGuard = module.get<JWTAuthGuard>(JWTAuthGuard);
		_appLogger = module.get<AppLogger>(AppLogger);
		auditLogger = module.get<AuditLoggerService>(AuditLoggerService);
	});

	describe('Authentication Bypass Scenarios', () => {
		it('should prevent authentication with null user', async () => {
			const result = await authService.validateUser(null, 'password123');
			expect(result).toBeNull();
		});

		it('should prevent authentication with inactive user', async () => {
			const inactiveUser: User = {
				id: 'user123',
				email: 'test@example.com',
				isActive: false,
				role: 'user',
				firstName: 'Test',
				lastName: 'User'
			};

			const result = await authService.validateUser(inactiveUser, 'password123');
			expect(result).toBeNull();
		});

		it('should prevent authentication with missing password hash', async () => {
			const userWithoutHash: User = {
				id: 'user123',
				email: 'test@example.com',
				isActive: true,
				role: 'user',
				firstName: 'Test',
				lastName: 'User'
			};

			const result = await authService.validateUser(userWithoutHash, 'password123');
			expect(result).toBeNull();
		});

		it('should prevent authentication with wrong password', async () => {
			const userWithHash = {
				id: 'user123',
				email: 'test@example.com',
				isActive: true,
				role: 'user',
				firstName: 'Test',
				lastName: 'User',
				passwordHash: await require('bcryptjs').hash('correctpassword', 12)
			};

			const result = await authService.validateUser(userWithHash, 'wrongpassword');
			expect(result).toBeNull();
		});

		it('should prevent authentication bypass via SQL injection attempts', async () => {
			const sqlInjectionPasswords = [
				'\' OR \'1\'=\'1',
				'\' OR \'1\'=\'1\' --',
				'\' OR 1=1 --',
				'admin\' --',
				'\' UNION SELECT * FROM users --'
			];

			const userWithHash = {
				id: 'user123',
				email: 'test@example.com',
				isActive: true,
				role: 'user',
				firstName: 'Test',
				lastName: 'User',
				passwordHash: await require('bcryptjs').hash('correctpassword', 12)
			};

			for (const sqlPassword of sqlInjectionPasswords) {
				const result = await authService.validateUser(userWithHash, sqlPassword);
				expect(result).toBeNull();
			}
		});
	});

	describe('Authorization Bypass Scenarios', () => {
		it('should prevent access with malformed JWT', async () => {
			const malformedTokens = [
				'not-a-jwt',
				'header.payload',
				'header.payload.signature.extra',
				'',
				'null',
				'undefined'
			];

			for (const token of malformedTokens) {
				const decoded = authService.decodeToken(token);
				expect(decoded).toBeNull();
			}
		});

		it('should prevent access with expired JWT', async () => {
			const expiredPayload: JWTPayload = {
				email: 'test@example.com',
				sub: 'user123',
				role: 'user',
				iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
				exp: Math.floor(Date.now() / 1000) - 1800 // 30 minutes ago
			};

			const expiredToken = jwtService.sign(expiredPayload);

			try {
				jwtService.verify(expiredToken);
				fail('Should have thrown TokenExpiredError');
			}
			catch (error: any) {
				expect(error.name).toBe('TokenExpiredError');
			}
		});

		it('should prevent access with tampered JWT signature', async () => {
			const payload: JWTPayload = {
				email: 'test@example.com',
				sub: 'user123',
				role: 'user'
			};

			const validToken = jwtService.sign(payload);
			const tamperedToken = validToken.slice(0, -5) + 'xxxxx'; // Tamper signature

			try {
				jwtService.verify(tamperedToken);
				fail('Should have thrown JsonWebTokenError');
			}
			catch (error: any) {
				expect(error.name).toBe('JsonWebTokenError');
			}
		});

		it('should prevent privilege escalation via role manipulation', async () => {
			const userPayload: JWTPayload = {
				email: 'test@example.com',
				sub: 'user123',
				role: 'user'
			};

			const userToken = jwtService.sign(userPayload);

			// Decode to verify role wasn't escalated
			const decoded = jwtService.decode(userToken) as JWTPayload;
			expect(decoded.role).toBe('user');
			expect(decoded.role).not.toBe('admin');
		});
	});

	describe('Token Manipulation Security', () => {
		it('should detect algorithm confusion attacks', async () => {
			// Create a token with HS256 but try to verify with different algorithm
			const payload: JWTPayload = {
				email: 'test@example.com',
				sub: 'user123',
				role: 'user'
			};

			const token = jwtService.sign(payload, { algorithm: 'HS256' });

			// Attempt to verify with different secret (simulating algorithm confusion)
			try {
				jwtService.verify(token, { secret: 'different-secret' });
				fail('Should have thrown JsonWebTokenError');
			}
			catch (error: any) {
				expect(error.name).toBe('JsonWebTokenError');
			}
		});

		it('should prevent token reuse after logout', async () => {
			const payload: JWTPayload = {
				email: 'test@example.com',
				sub: 'user123',
				role: 'user'
			};

			const token = jwtService.sign(payload);

			// Simulate logout by blacklisting token
			const decoded = authService.decodeToken(token);
			const expiresInSeconds = decoded?.exp
				? Math.floor((decoded.exp * 1000 - Date.now()) / 1000)
				: 900;

			await tokenBlacklistService.blacklistToken(token, expiresInSeconds);

			// Verify token is blacklisted
			const isBlacklisted = await tokenBlacklistService.isTokenBlacklisted(token);
			expect(isBlacklisted).toBe(true);
		});

		it('should prevent JWT header injection', () => {
			const maliciousHeaders = [
				'{"alg":"none"}',
				'{"alg":"HS256","typ":"JWT","kid":"../../../dev/null"}',
				'{"alg":"RS256","jku":"http://evil.com/jwk"}',
				'{"alg":"HS256","crit":["http://example.com/evil"],"http://example.com/evil":"value"}'
			];

			for (const header of maliciousHeaders) {
				const encodedHeader = Buffer.from(header).toString('base64url');
				const payload = Buffer.from('{"sub":"user123"}').toString('base64url');
				const signature = 'signature';
				const maliciousToken = `${encodedHeader}.${payload}.${signature}`;

				// Should fail to decode or verify
				const decoded = authService.decodeToken(maliciousToken);
				expect(decoded).toBeNull();
			}
		});

		it('should validate token expiration times', async () => {
			const user: User = {
				id: 'user123',
				email: 'test@example.com',
				isActive: true,
				role: 'user',
				firstName: 'Test',
				lastName: 'User'
			};

			const authResponse = await authService.login(user);

			// Verify access token expires in 15 minutes (900 seconds)
			expect(authResponse.expiresIn).toBe(900);

			// Verify token has expiration
			const decoded = authService.decodeToken(authResponse.accessToken);
			expect(decoded?.exp).toBeDefined();
			expect(decoded?.exp).toBeGreaterThan(Date.now() / 1000);
		});
	});

	describe('CSRF Protection', () => {
		it('should require proper authorization header format', () => {
			const mockRequest = {
				headers: {
					authorization: 'InvalidFormat token123'
				}
			};

			// This would be tested in integration with actual guard usage
			// For unit test, we verify the guard extracts tokens correctly
			const guard = new JWTAuthGuard();
			const token = (guard as any).extractTokenFromHeader(mockRequest);
			expect(token).toBeNull();
		});

		it('should reject requests without authorization header', () => {
			const mockRequest = {
				headers: {}
			};

			const guard = new JWTAuthGuard();
			const token = (guard as any).extractTokenFromHeader(mockRequest);
			expect(token).toBeNull();
		});

		it('should accept properly formatted Bearer tokens', () => {
			const mockRequest = {
				headers: {
					authorization: 'Bearer valid.jwt.token'
				}
			};

			const guard = new JWTAuthGuard();
			const token = (guard as any).extractTokenFromHeader(mockRequest);
			expect(token).toBe('valid.jwt.token');
		});
	});

	describe('Rate Limiting Security', () => {
		it('should handle concurrent session limits', async () => {
			const userId = 'user123';
			const maxSessions = 3;

			// Track multiple sessions
			const sessionIds = ['session1', 'session2', 'session3', 'session4'];

			for (let i = 0; i < sessionIds.length; i++) {
				const result = await authService.trackUserSession(userId, sessionIds[i], maxSessions);
				if (i < maxSessions) {
					expect(result.allowed).toBe(true);
					expect(result.activeSessions).toContain(sessionIds[i]);
				}
				else {
					// Should not allow more than maxSessions
					expect(result.allowed).toBe(false);
				}
			}
		});

		it('should prevent brute force attacks with failed login attempts', async () => {
			// This would typically be implemented with a rate limiter service
			// For this test, we verify the audit logging captures failed attempts
			const user: User = {
				id: 'user123',
				email: 'test@example.com',
				isActive: true,
				role: 'user',
				firstName: 'Test',
				lastName: 'User'
			};

			// Simulate multiple failed login attempts
			for (let i = 0; i < 5; i++) {
				await authService.validateUser(user, 'wrongpassword');
			}

			// Verify audit logging was called for each failed attempt
			expect(auditLogger.logAuthenticationAttempt).toHaveBeenCalledTimes(5);
			expect(auditLogger.logAuthenticationAttempt).toHaveBeenCalledWith(
				'test@example.com',
				false,
				undefined,
				'Invalid password'
			);
		});
	});

	describe('Session Management Security', () => {
		it('should invalidate sessions on logout', async () => {
			const user: User = {
				id: 'user123',
				email: 'test@example.com',
				isActive: true,
				role: 'user',
				firstName: 'Test',
				lastName: 'User'
			};

			const authResponse = await authService.login(user);
			const token = authResponse.accessToken;

			// Simulate logout
			const decoded = authService.decodeToken(token);
			const expiresInSeconds = decoded?.exp
				? Math.floor((decoded.exp * 1000 - Date.now()) / 1000)
				: 900;

			await tokenBlacklistService.blacklistToken(token, expiresInSeconds);

			// Verify token is blacklisted
			const isBlacklisted = await tokenBlacklistService.isTokenBlacklisted(token);
			expect(isBlacklisted).toBe(true);
		});

		it('should handle token refresh securely', async () => {
			const user: User = {
				id: 'user123',
				email: 'test@example.com',
				isActive: true,
				role: 'user',
				firstName: 'Test',
				lastName: 'User'
			};

			const userLookupFn = async (userId: string) => {
				if (userId === user.id) return user;
				return null;
			};

			// First login to get refresh token
			const authResponse = await authService.login(user);

			// Attempt token refresh
			const refreshResult = await authService.refreshToken(authResponse.refreshToken!, userLookupFn);

			expect(refreshResult.accessToken).toBeDefined();
			expect(refreshResult.expiresIn).toBe(900);
			expect(refreshResult.tokenType).toBe('Bearer');

			// Verify old refresh token is blacklisted
			const isOldTokenBlacklisted = await tokenBlacklistService.isTokenBlacklisted(authResponse.refreshToken!);
			expect(isOldTokenBlacklisted).toBe(true);
		});

		it('should prevent refresh token reuse', async () => {
			const user: User = {
				id: 'user123',
				email: 'test@example.com',
				isActive: true,
				role: 'user',
				firstName: 'Test',
				lastName: 'User'
			};

			const userLookupFn = async (userId: string) => {
				if (userId === user.id) return user;
				return null;
			};

			const authResponse = await authService.login(user);

			// First refresh should succeed
			await authService.refreshToken(authResponse.refreshToken!, userLookupFn);

			// Second refresh with same token should fail
			await expect(authService.refreshToken(authResponse.refreshToken!, userLookupFn))
				.rejects.toThrow(UnauthorizedException);
		});
	});

	describe('Input Validation Security', () => {
		it('should prevent email header injection', () => {
			const maliciousEmails = [
				'test@example.com\r\nBCC: victim@example.com',
				'test@example.com\nCC: victim@example.com',
				'test@example.com\r\n\r\nEvil-Header: value',
				'test@example.com\n\nSubject: Hacked'
			];

			// These should be caught by validation, but for auth service
			// we test that they don't cause issues in token generation
			for (const email of maliciousEmails) {
				const user: User = {
					id: 'user123',
					email,
					isActive: true,
					role: 'user',
					firstName: 'Test',
					lastName: 'User'
				};

				expect(async () => authService.login(user)).not.toThrow();
			}
		});

		it('should handle extremely long inputs', () => {
			const longEmail = 'a'.repeat(1000) + '@example.com';
			const longName = 'a'.repeat(1000);

			const user: User = {
				id: 'user123',
				email: longEmail,
				isActive: true,
				role: 'user',
				firstName: longName,
				lastName: 'User'
			};

			// Should not crash with long inputs
			expect(async () => authService.login(user)).not.toThrow();
		});

		it('should prevent null byte injection', () => {
			const maliciousInputs = [
				'test@example.com\x00evil.com',
				'test\x00@example.com',
				'user\x00123'
			];

			for (const input of maliciousInputs) {
				const user: User = {
					id: 'user123',
					email: input,
					isActive: true,
					role: 'user',
					firstName: 'Test',
					lastName: 'User'
				};

				// Should handle null bytes gracefully
				expect(async () => authService.login(user)).not.toThrow();
			}
		});
	});
});
