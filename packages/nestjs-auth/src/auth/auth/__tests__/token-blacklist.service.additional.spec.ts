import { TokenBlacklistService } from '../token-blacklist.service.js';
import { AppLogger, CACHE_PROVIDER } from '@pawells/nestjs-shared/common';

describe('TokenBlacklistService - Additional Tests', () => {
	let service: TokenBlacklistService;
	let mockModuleRef: any;
	let mockAppLogger: any;
	let mockCacheProvider: any;

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

		const cacheData: Map<string, any> = new Map();
		mockCacheProvider = {
			async set(key: string, value: any, ttl?: number): Promise<void> {
				cacheData.set(key, { value, ttl, timestamp: Date.now() });
			},
			async get(key: string): Promise<any> {
				return cacheData.get(key)?.value;
			},
			async exists(key: string): Promise<boolean> {
				return cacheData.has(key);
			},
			async delete(key: string): Promise<void> {
				cacheData.delete(key);
			},
			async clear(): Promise<void> {
				cacheData.clear();
			},
			getCacheData() {
				return cacheData;
			},
		};

		mockModuleRef = {
			get(token: any, defaultValue?: any) {
				if (token === AppLogger) return mockAppLogger;
				if (token === CACHE_PROVIDER) return mockCacheProvider;
				return defaultValue ?? null;
			},
		};

		service = new TokenBlacklistService(mockModuleRef);
	});

	describe('Token blacklisting', () => {
		it('should blacklist a token with TTL', async () => {
			const token = 'test-jwt-token-12345';
			await service.blacklistToken(token, 3600);

			const isBlacklisted = await service.isTokenBlacklisted(token);
			expect(isBlacklisted).toBe(true);
		});

		it('should store token with correct cache key format', async () => {
			const token = 'test-token-abc123';
			await service.blacklistToken(token, 7200);

			const cacheData = mockCacheProvider.getCacheData();
			const expectedKey = `blacklist:${token}`;
			expect(cacheData.has(expectedKey)).toBe(true);
		});

		it('should set correct TTL on blacklisted token', async () => {
			const token = 'test-token-with-ttl';
			const ttl = 5400;
			await service.blacklistToken(token, ttl);

			const cacheData = mockCacheProvider.getCacheData();
			const key = `blacklist:${token}`;
			const entry = cacheData.get(key);
			expect(entry.ttl).toBe(ttl);
		});

		it('should handle multiple token blacklisting', async () => {
			const tokens = ['token1', 'token2', 'token3'];
			for (const token of tokens) {
				await service.blacklistToken(token, 3600);
			}

			for (const token of tokens) {
				const isBlacklisted = await service.isTokenBlacklisted(token);
				expect(isBlacklisted).toBe(true);
			}
		});

		it('should log when blacklisting a token', async () => {
			const token = 'logged-token-123';
			await service.blacklistToken(token, 3600);

			const logCalls = mockAppLogger.getLogCalls();
			const debugLog = logCalls.find((c: any) => c.level === 'debug');
			expect(debugLog).toBeDefined();
		});

		it('should not blacklist token when cache provider unavailable', async () => {
			mockModuleRef = {
				get(token: any) {
					if (token === AppLogger) return mockAppLogger;
					return null; // No cache provider
				},
			};
			service = new TokenBlacklistService(mockModuleRef);

			const token = 'test-token';
			await service.blacklistToken(token, 3600);

			// Fail closed: token treated as blacklisted when cache is unavailable
			const isBlacklisted = await service.isTokenBlacklisted(token);
			expect(isBlacklisted).toBe(true);
		});

		it('should handle token with special characters', async () => {
			const token = 'test.token-with_special@chars';
			await service.blacklistToken(token, 3600);

			const isBlacklisted = await service.isTokenBlacklisted(token);
			expect(isBlacklisted).toBe(true);
		});

		it('should handle very long token strings', async () => {
			const token = 'x'.repeat(1000);
			await service.blacklistToken(token, 3600);

			const isBlacklisted = await service.isTokenBlacklisted(token);
			expect(isBlacklisted).toBe(true);
		});
	});

	describe('Token status checking', () => {
		it('should return false for non-blacklisted token', async () => {
			const token = 'non-blacklisted-token';
			const isBlacklisted = await service.isTokenBlacklisted(token);
			expect(isBlacklisted).toBe(false);
		});

		it('should correctly identify blacklisted tokens', async () => {
			const blacklistedToken = 'blacklisted';
			const nonBlacklistedToken = 'not-blacklisted';

			await service.blacklistToken(blacklistedToken, 3600);

			const isBlacklisted1 = await service.isTokenBlacklisted(blacklistedToken);
			const isBlacklisted2 = await service.isTokenBlacklisted(nonBlacklistedToken);

			expect(isBlacklisted1).toBe(true);
			expect(isBlacklisted2).toBe(false);
		});

		it('should handle checking with unavailable cache provider', async () => {
			mockModuleRef = {
				get(token: any) {
					if (token === AppLogger) return mockAppLogger;
					return null;
				},
			};
			service = new TokenBlacklistService(mockModuleRef);

			// Fail closed: token treated as blacklisted when cache is unavailable
			const isBlacklisted = await service.isTokenBlacklisted('any-token');
			expect(isBlacklisted).toBe(true);
		});
	});

	describe('User token revocation', () => {
		it('should revoke all tokens for a user', async () => {
			const userId = 'user-123';
			await service.revokeUserTokens(userId);

			const hasRevoked = await service.hasUserRevokedTokens(userId);
			expect(hasRevoked).toBe(true);
		});

		it('should store revocation with correct cache key format', async () => {
			const userId = 'user-456';
			await service.revokeUserTokens(userId);

			const cacheData = mockCacheProvider.getCacheData();
			const expectedKey = `revoke:${userId}`;
			expect(cacheData.has(expectedKey)).toBe(true);
		});

		it('should return false for non-revoked user', async () => {
			const userId = 'non-revoked-user';
			const hasRevoked = await service.hasUserRevokedTokens(userId);
			expect(hasRevoked).toBe(false);
		});

		it('should revoke different users independently', async () => {
			const user1 = 'user-1';
			const user2 = 'user-2';

			await service.revokeUserTokens(user1);

			const revoked1 = await service.hasUserRevokedTokens(user1);
			const revoked2 = await service.hasUserRevokedTokens(user2);

			expect(revoked1).toBe(true);
			expect(revoked2).toBe(false);
		});

		it('should log user token revocation', async () => {
			const userId = 'user-logged';
			await service.revokeUserTokens(userId);

			const logCalls = mockAppLogger.getLogCalls();
			const infoLog = logCalls.find((c: any) => c.level === 'info');
			expect(infoLog).toBeDefined();
		});

		it('should handle revocation with unavailable cache provider', async () => {
			mockModuleRef = {
				get(token: any) {
					if (token === AppLogger) return mockAppLogger;
					return null;
				},
			};
			service = new TokenBlacklistService(mockModuleRef);

			const userId = 'user-id';
			await service.revokeUserTokens(userId);

			// Fail closed: tokens treated as revoked when cache is unavailable
			const hasRevoked = await service.hasUserRevokedTokens(userId);
			expect(hasRevoked).toBe(true);
		});
	});

	describe('Bearer token extraction', () => {
		it('should extract token from Authorization header', () => {
			const token = 'test-jwt-token';
			const header = `Bearer ${token}`;

			const extracted = service.extractTokenFromHeader(header);
			expect(extracted).toBe(token);
		});

		it('should return null for missing Bearer prefix', () => {
			const header = 'test-jwt-token';

			const extracted = service.extractTokenFromHeader(header);
			expect(extracted).toBeNull();
		});

		it('should return null for empty header', () => {
			const extracted = service.extractTokenFromHeader('');
			expect(extracted).toBeNull();
		});

		it('should return null for null header', () => {
			const extracted = service.extractTokenFromHeader(null as any);
			expect(extracted).toBeNull();
		});

		it('should return null for undefined header', () => {
			const extracted = service.extractTokenFromHeader(undefined as any);
			expect(extracted).toBeNull();
		});

		it('should handle Bearer with extra whitespace', () => {
			const token = 'test-token';
			const header = `Bearer  ${token}`; // Extra space

			// Should return the token with the extra space
			const extracted = service.extractTokenFromHeader(header);
			expect(extracted).toBe(` ${token}`);
		});

		it('should extract complete token string', () => {
			const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
			const header = `Bearer ${token}`;

			const extracted = service.extractTokenFromHeader(header);
			expect(extracted).toBe(token);
		});

		it('should be case-sensitive for Bearer prefix', () => {
			const token = 'test-token';
			const header = `bearer ${token}`; // lowercase bearer

			const extracted = service.extractTokenFromHeader(header);
			expect(extracted).toBeNull();
		});
	});

	describe('Service initialization and lazy loading', () => {
		it('should be instantiable', () => {
			expect(service).toBeDefined();
			expect(service instanceof TokenBlacklistService).toBe(true);
		});

		it('should have ModuleRef available', () => {
			expect(service.Module).toBeDefined();
			expect(service.Module === mockModuleRef).toBe(true);
		});

		it('should lazily load AppLogger', () => {
			const logger = service.AppLogger;
			expect(logger).toBeDefined();
			expect(logger === mockAppLogger).toBe(true);
		});

		it('should lazily load CacheProvider', () => {
			const cache = service.CacheProvider;
			expect(cache).toBeDefined();
			expect(cache === mockCacheProvider).toBe(true);
		});

		it('should handle missing cache provider gracefully', () => {
			mockModuleRef = {
				get(token: any) {
					if (token === AppLogger) return mockAppLogger;
					return null;
				},
			};
			service = new TokenBlacklistService(mockModuleRef);

			const cache = service.CacheProvider;
			expect(cache).toBeNull();
		});
	});

	describe('Cleanup operations', () => {
		it('should cleanup expired entries', async () => {
			await service.cleanupExpiredEntries(86400);
			// Cleanup is handled by cache TTL, this just verifies it doesn't throw
		});

		it('should cleanup with custom max age', async () => {
			await service.cleanupExpiredEntries(3600);
			// Cleanup is handled by cache TTL, this just verifies it doesn't throw
		});

		it('should not throw on cleanup with unavailable cache', async () => {
			mockModuleRef = {
				get(token: any) {
					if (token === AppLogger) return mockAppLogger;
					return null;
				},
			};
			service = new TokenBlacklistService(mockModuleRef);

			await service.cleanupExpiredEntries(86400);
			// Should not throw
		});
	});

	describe('Integration scenarios', () => {
		it('should handle complete logout flow', async () => {
			const userId = 'user-123';
			const accessToken = 'access-token-123';
			const refreshToken = 'refresh-token-123';

			// Revoke all user tokens
			await service.revokeUserTokens(userId);

			// Blacklist individual tokens
			await service.blacklistToken(accessToken, 900);
			await service.blacklistToken(refreshToken, 259200);

			// Verify everything is blacklisted
			const userRevoked = await service.hasUserRevokedTokens(userId);
			const accessBlacklisted = await service.isTokenBlacklisted(accessToken);
			const refreshBlacklisted = await service.isTokenBlacklisted(refreshToken);

			expect(userRevoked).toBe(true);
			expect(accessBlacklisted).toBe(true);
			expect(refreshBlacklisted).toBe(true);
		});

		it('should handle concurrent token blacklisting', async () => {
			const tokens = Array.from({ length: 10 }, (_, i) => `token-${i}`);

			await Promise.all(tokens.map(async t => service.blacklistToken(t, 3600)));

			const results = await Promise.all(tokens.map(async t => service.isTokenBlacklisted(t)));

			results.forEach(result => {
				expect(result).toBe(true);
			});
		});

		it('should maintain separate namespaces for tokens and revocations', async () => {
			const userId = 'user-123';
			const token = `revoke:${userId}`; // Intentionally formatted like revocation key

			await service.blacklistToken(token, 3600);

			// The token should be blacklisted in the blacklist namespace
			const isTokenBlacklisted = await service.isTokenBlacklisted(token);
			expect(isTokenBlacklisted).toBe(true);

			// Revoking the user should not affect the token blacklist entry
			await service.revokeUserTokens(userId);

			const isTokenStillBlacklisted = await service.isTokenBlacklisted(token);
			expect(isTokenStillBlacklisted).toBe(true);
		});

		it('should extract and blacklist token from header', async () => {
			const token = 'jwt-token-from-header';
			const authHeader = `Bearer ${token}`;

			const extracted = service.extractTokenFromHeader(authHeader);
			if (extracted) {
				await service.blacklistToken(extracted, 3600);
			}

			const isBlacklisted = await service.isTokenBlacklisted(token);
			expect(isBlacklisted).toBe(true);
		});
	});
});
