import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '@pawells/nestjs-graphql/cache';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { TokenBlacklistService } from '../token-blacklist.service.js';
import { jest } from '@jest/globals';

describe('TokenBlacklistService', () => {
	let service: TokenBlacklistService;
	let cacheService: jest.Mocked<CacheService>;
	let _appLogger: jest.Mocked<AppLogger>;

	beforeEach(async () => {
		const mockCacheService = {
			exists: jest.fn(),
			set: jest.fn(),
		};

		const mockAppLogger = {
			createContextualLogger: jest.fn().mockReturnValue({
				debug: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
			}),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TokenBlacklistService,
				{
					provide: CacheService,
					useValue: mockCacheService,
				},
				{
					provide: AppLogger,
					useValue: mockAppLogger,
				},
			],
		}).compile();

		service = module.get<TokenBlacklistService>(TokenBlacklistService);
		cacheService = module.get(CacheService);
		_appLogger = module.get(AppLogger);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('blacklistToken', () => {
		it('should blacklist token successfully', async () => {
			cacheService.set.mockResolvedValue(undefined);

			await service.blacklistToken('test.token', 900);

			expect(cacheService.set).toHaveBeenCalledWith(
				'blacklist:test.token',
				true,
				900,
			);
		});

		it('should handle cache errors gracefully', async () => {
			cacheService.set.mockRejectedValue(new Error('Cache error'));

			await expect(service.blacklistToken('test.token', 900))
				.rejects.toThrow('Cache error');
		});
	});

	describe('isTokenBlacklisted', () => {
		it('should return true for blacklisted token', async () => {
			cacheService.exists.mockResolvedValue(true);

			const result = await service.isTokenBlacklisted('test.token');

			expect(result).toBe(true);
			expect(cacheService.exists).toHaveBeenCalledWith('blacklist:test.token');
		});

		it('should return false for non-blacklisted token', async () => {
			cacheService.exists.mockResolvedValue(false);

			const result = await service.isTokenBlacklisted('test.token');

			expect(result).toBe(false);
		});

		it('should return false on cache error', async () => {
			cacheService.exists.mockRejectedValue(new Error('Cache error'));

			const result = await service.isTokenBlacklisted('test.token');

			expect(result).toBe(false);
		});
	});

	describe('revokeUserTokens', () => {
		it('should revoke user tokens successfully', async () => {
			cacheService.set.mockResolvedValue(undefined);

			await service.revokeUserTokens('user_123');

			expect(cacheService.set).toHaveBeenCalledWith(
				'revoke:user_123',
				expect.any(Number),
				86400,
			);
		});

		it('should handle cache errors', async () => {
			cacheService.set.mockRejectedValue(new Error('Cache error'));

			await expect(service.revokeUserTokens('user_123'))
				.rejects.toThrow('Cache error');
		});
	});

	describe('hasUserRevokedTokens', () => {
		it('should return true for revoked user tokens', async () => {
			cacheService.exists.mockResolvedValue(true);

			const result = await service.hasUserRevokedTokens('user_123');

			expect(result).toBe(true);
			expect(cacheService.exists).toHaveBeenCalledWith('revoke:user_123');
		});

		it('should return false for non-revoked user tokens', async () => {
			cacheService.exists.mockResolvedValue(false);

			const result = await service.hasUserRevokedTokens('user_123');

			expect(result).toBe(false);
		});

		it('should return false on cache error', async () => {
			cacheService.exists.mockRejectedValue(new Error('Cache error'));

			const result = await service.hasUserRevokedTokens('user_123');

			expect(result).toBe(false);
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
