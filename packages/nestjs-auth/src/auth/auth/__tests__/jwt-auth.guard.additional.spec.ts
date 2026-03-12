import { JWTAuthGuard } from '../jwt-auth.guard.js';
import { UnauthorizedException } from '@nestjs/common';

describe('JWTAuthGuard - Additional Tests', () => {
	let guard: JWTAuthGuard;
	let mockAppLogger: any;
	let mockExecutionContext: any;

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

		guard = new JWTAuthGuard(mockAppLogger);

		mockExecutionContext = {
			switchToHttp() {
				return {
					getRequest() {
						return {
							headers: {},
							user: null,
						};
					},
					getResponse() {
						return {
							setHeader: () => {},
						};
					},
				};
			},
			switchToWs() {
				return {
					getData() {
						return {};
					},
				};
			},
			switchToRpc() {
				return {
					getData() {
						return {};
					},
				};
			},
		};
	});

	describe('Token extraction from headers', () => {
		it('should extract token from Authorization header with Bearer prefix', () => {
			const token = 'test-jwt-token-123';
			const request = {
				headers: {
					authorization: `Bearer ${token}`,
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBe(token);
		});

		it('should extract token from Authorization header (case-insensitive header name)', () => {
			const token = 'test-jwt-token-456';
			const request = {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBe(token);
		});

		it('should return null when Authorization header missing', () => {
			const request = {
				headers: {},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBeNull();
		});

		it('should return null for malformed Bearer header', () => {
			const request = {
				headers: {
					authorization: 'Bearer', // Missing token
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBeNull();
		});

		it('should return null for non-Bearer token', () => {
			const token = 'Basic dXNlcjpwYXNz';
			const request = {
				headers: {
					authorization: token,
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBeNull();
		});

		it('should handle empty Authorization header', () => {
			const request = {
				headers: {
					authorization: '',
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBeNull();
		});

		it('should extract complete JWT token', () => {
			const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
			const request = {
				headers: {
					authorization: `Bearer ${token}`,
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBe(token);
		});

		it('should handle token with whitespace', () => {
			const token = 'test-token-with-spaces';
			const request = {
				headers: {
					authorization: `Bearer  ${token}`, // Double space
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBe(` ${token}`);
		});

		it('should prefer authorization header over Authorization', () => {
			const token1 = 'token-lowercase';
			const token2 = 'token-uppercase';
			const request = {
				headers: {
					authorization: `Bearer ${token1}`,
					Authorization: `Bearer ${token2}`,
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			// Should use first available (authorization)
			expect(extracted).toBe(token1);
		});
	});

	describe('Error handling', () => {
		it('should throw UnauthorizedException when error provided', () => {
			const error = new UnauthorizedException('Token invalid');

			expect(() => {
				guard['handleAuthError'](error, null, null);
			}).toThrow(UnauthorizedException);
		});

		it('should throw UnauthorizedException when no user', () => {
			expect(() => {
				guard['handleAuthError'](null, null, { message: 'No user found' });
			}).toThrow(UnauthorizedException);
		});

		it('should return user when authentication succeeds', () => {
			const user = { id: 'user-123', email: 'user@test.com' };

			const result = guard['handleAuthError'](null, user, null);
			expect(result).toBe(user);
		});

		it('should include error message in UnauthorizedException', () => {
			const error = new Error('Invalid signature');

			try {
				guard['handleAuthError'](error, null, null);
			} catch (e) {
				expect((e as any).message).toContain('Authentication failed');
			}
		});

		it('should use info message when error unavailable', () => {
			expect(() => {
				guard['handleAuthError'](null, null, { message: 'Authentication failed' });
			}).toThrow();
		});

		it('should log authentication failures', () => {
			try {
				guard['handleAuthError'](new Error('Test error'), null, null);
			} catch (e) {
				// Error expected
			}

			const logCalls = mockAppLogger.getLogCalls();
			const warnLog = logCalls.find((c: any) => c.level === 'warn');
			expect(warnLog).toBeDefined();
		});

		it('should handle authentication with falsy user object', () => {
			expect(() => {
				guard['handleAuthError'](null, false, null);
			}).toThrow();
		});

		it('should handle authentication with undefined user', () => {
			expect(() => {
				guard['handleAuthError'](null, undefined, null);
			}).toThrow();
		});
	});

	describe('Request context handling', () => {
		it('should extract context from HTTP execution', () => {
			const request = { headers: { authorization: 'Bearer test-token' } };
			mockExecutionContext.switchToHttp = () => ({
				getRequest: () => request,
			});

			const context = guard['getContext'](mockExecutionContext);
			expect(context).toBe(request);
		});

		it('should work with request containing headers', () => {
			const request = {
				headers: {
					authorization: 'Bearer valid-token',
					'content-type': 'application/json',
				},
			};
			mockExecutionContext.switchToHttp = () => ({
				getRequest: () => request,
			});

			const context = guard['getContext'](mockExecutionContext);
			expect(context.headers.authorization).toBe('Bearer valid-token');
		});

		it('should handle request with no headers', () => {
			const request = {};
			mockExecutionContext.switchToHttp = () => ({
				getRequest: () => request,
			});

			const context = guard['getContext'](mockExecutionContext);
			expect(context).toBe(request);
		});
	});

	describe('Guard initialization', () => {
		it('should initialize with AppLogger', () => {
			const newGuard = new JWTAuthGuard(mockAppLogger);
			expect(newGuard).toBeDefined();
			expect(newGuard instanceof JWTAuthGuard).toBe(true);
		});

		it('should initialize without AppLogger', () => {
			const newGuard = new JWTAuthGuard();
			expect(newGuard).toBeDefined();
		});

		it('should have logger available', () => {
			expect(guard['logger']).toBeDefined();
		});

		it('should extend AuthGuard', () => {
			// JWTAuthGuard should extend AuthGuard from @nestjs/passport
			expect(guard).toHaveProperty('canActivate');
		});
	});

	describe('Integration scenarios', () => {
		it('should extract and validate Bearer token flow', () => {
			const token = 'jwt-token-123456';
			const request = {
				headers: {
					authorization: `Bearer ${token}`,
				},
				user: { id: 'user-123', email: 'user@test.com' },
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBe(token);

			const handleResult = guard['handleAuthError'](null, request.user, null);
			expect(handleResult).toBe(request.user);
		});

		it('should handle missing token scenario', () => {
			const request = {
				headers: {},
				user: null,
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBeNull();

			expect(() => {
				guard['handleAuthError'](null, request.user, { message: 'No token provided' });
			}).toThrow();
		});

		it('should handle invalid token scenario', () => {
			const request = {
				headers: {
					authorization: 'Bearer invalid-token',
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBe('invalid-token');

			expect(() => {
				guard['handleAuthError'](new Error('Token verification failed'), null, null);
			}).toThrow();
		});

		it('should handle successful authentication with complete flow', () => {
			const token = 'valid-jwt-token';
			const user = { id: 'user-123', email: 'user@test.com', role: 'user' };

			const request = {
				headers: {
					authorization: `Bearer ${token}`,
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBe(token);

			const authenticated = guard['handleAuthError'](null, user, null);
			expect(authenticated).toBe(user);
			expect(authenticated.role).toBe('user');
		});

		it('should handle concurrent authentication attempts', () => {
			const token1 = 'token-1';
			const token2 = 'token-2';

			const request1 = { headers: { authorization: `Bearer ${token1}` } };
			const request2 = { headers: { authorization: `Bearer ${token2}` } };

			const extracted1 = guard['extractTokenFromHeader'](request1);
			const extracted2 = guard['extractTokenFromHeader'](request2);

			expect(extracted1).toBe(token1);
			expect(extracted2).toBe(token2);
		});

		it('should maintain separate user contexts', () => {
			const user1 = { id: 'user-1', email: 'user1@test.com' };
			const user2 = { id: 'user-2', email: 'user2@test.com' };

			const auth1 = guard['handleAuthError'](null, user1, null);
			const auth2 = guard['handleAuthError'](null, user2, null);

			expect(auth1.id).toBe('user-1');
			expect(auth2.id).toBe('user-2');
		});
	});

	describe('Edge cases', () => {
		it('should handle request with null headers', () => {
			const request = { headers: null };

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBeNull();
		});

		it('should handle request with undefined headers', () => {
			const request = {};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBeNull();
		});

		it('should handle authorization header with special characters', () => {
			const token = 'token-with-special_chars.and-numbers123';
			const request = {
				headers: {
					authorization: `Bearer ${token}`,
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBe(token);
		});

		it('should handle very long token strings', () => {
			const token = 'x'.repeat(2000);
			const request = {
				headers: {
					authorization: `Bearer ${token}`,
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBe(token);
		});

		it('should handle Bearer prefix with different casing', () => {
			const token = 'test-token';
			const request = {
				headers: {
					authorization: `bearer ${token}`, // lowercase
				},
			};

			const extracted = guard['extractTokenFromHeader'](request);
			expect(extracted).toBeNull(); // Should be case-sensitive
		});
	});
});
