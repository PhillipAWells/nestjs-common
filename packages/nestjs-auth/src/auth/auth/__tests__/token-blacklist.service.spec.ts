import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AppLogger, CACHE_PROVIDER } from '@pawells/nestjs-shared/common';
import { TokenBlacklistService } from '../token-blacklist.service.js';

describe('TokenBlacklistService', () => {
	let service: TokenBlacklistService;
	let mockCacheProvider: any;
	let mockModuleRef: any;

	beforeEach(() => {
		mockCacheProvider = {
			exists: vi.fn(),
			set: vi.fn(),
		};

		const mockAppLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}),
		};

		mockModuleRef = {
			get: (token: any) => {
				if (token === AppLogger) return mockAppLogger;
				if (token === CACHE_PROVIDER) return mockCacheProvider;
				return null;
			},
		};

		service = new TokenBlacklistService(mockModuleRef);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('blacklistToken', () => {
		it('should blacklist token successfully', async () => {
			mockCacheProvider.set.mockResolvedValue(undefined);

			await service.blacklistToken('test.token', 900);

			expect(mockCacheProvider.set).toHaveBeenCalledWith(
				'blacklist:test.token',
				true,
				900,
			);
		});

		it('should handle cache errors gracefully', async () => {
			mockCacheProvider.set.mockRejectedValue(new Error('Cache error'));

			await expect(service.blacklistToken('test.token', 900))
				.rejects.toThrow('Cache error');
		});
	});

	describe('isTokenBlacklisted', () => {
		it('should return true for blacklisted token', async () => {
			mockCacheProvider.exists.mockResolvedValue(true);

			const result = await service.isTokenBlacklisted('test.token');

			expect(result).toBe(true);
			expect(mockCacheProvider.exists).toHaveBeenCalledWith('blacklist:test.token');
		});

		it('should return false for non-blacklisted token', async () => {
			mockCacheProvider.exists.mockResolvedValue(false);

			const result = await service.isTokenBlacklisted('test.token');

			expect(result).toBe(false);
		});

		it('should throw on cache error (fail closed)', async () => {
			mockCacheProvider.exists.mockRejectedValue(new Error('Cache error'));

			await expect(service.isTokenBlacklisted('test.token')).rejects.toThrow();
		});
	});

	describe('revokeUserTokens', () => {
		it('should revoke user tokens successfully', async () => {
			mockCacheProvider.set.mockResolvedValue(undefined);

			await service.revokeUserTokens('user_123');

			expect(mockCacheProvider.set).toHaveBeenCalledWith(
				'revoke:user_123',
				expect.any(Number),
				86400,
			);
		});

		it('should handle cache errors', async () => {
			mockCacheProvider.set.mockRejectedValue(new Error('Cache error'));

			await expect(service.revokeUserTokens('user_123'))
				.rejects.toThrow('Cache error');
		});
	});

	describe('hasUserRevokedTokens', () => {
		it('should return true for revoked user tokens', async () => {
			mockCacheProvider.exists.mockResolvedValue(true);

			const result = await service.hasUserRevokedTokens('user_123');

			expect(result).toBe(true);
			expect(mockCacheProvider.exists).toHaveBeenCalledWith('revoke:user_123');
		});

		it('should return false for non-revoked user tokens', async () => {
			mockCacheProvider.exists.mockResolvedValue(false);

			const result = await service.hasUserRevokedTokens('user_123');

			expect(result).toBe(false);
		});

		it('should throw on cache error (fail closed)', async () => {
			mockCacheProvider.exists.mockRejectedValue(new Error('Cache error'));

			await expect(service.hasUserRevokedTokens('user_123')).rejects.toThrow();
		});
	});

	describe('extractTokenFromHeader', () => {
		it('should extract token from valid Bearer header', () => {
			const header = 'Bearer test.jwt.token';
			const result = service.extractTokenFromHeader(header);

			expect(result).toBe('test.jwt.token');
		});

		it('should return null for invalid header format', () => {
			expect(service.extractTokenFromHeader('')).toBeNull();
			expect(service.extractTokenFromHeader('Basic token')).toBeNull();
			expect(service.extractTokenFromHeader('Bearer')).toBeNull();
			expect(service.extractTokenFromHeader('Bearertest')).toBeNull();
		});
	});
});
