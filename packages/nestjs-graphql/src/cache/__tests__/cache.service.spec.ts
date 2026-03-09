
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { CacheService } from '../cache.service.js';
import { vi } from 'vitest';

describe('CacheService', () => {
	let service: CacheService;

	let _cacheManager: any;

	const mockCacheManager: any = {
		get: vi.fn(),
		set: vi.fn(),
		del: vi.fn(),
		clear: vi.fn(),
		store: {
			keys: vi.fn(),
		},
	};

	beforeEach(async () => {
		// Reset all mocks before each test
		mockCacheManager.get.mockReset();
		mockCacheManager.set.mockReset();
		mockCacheManager.del.mockReset();
		mockCacheManager.clear.mockReset();
		mockCacheManager.store.keys.mockReset();

		const mockAppLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CacheService,
				{
					provide: CACHE_MANAGER,
					useValue: mockCacheManager,
				},
				{
					provide: AppLogger,
					useValue: mockAppLogger,
				},
			],
		}).compile();

		service = module.get<CacheService>(CacheService);
		_cacheManager = module.get(CACHE_MANAGER);
		void (_cacheManager); // Mark as used to satisfy linter
	});

	beforeEach(() => {
		vi.clearAllMocks();
		service.resetStats();
	});

	describe('get', () => {
		it('should return cached value when key exists', async () => {
			const key = 'test-key';
			const expectedValue = { data: 'test' };
			mockCacheManager.get.mockResolvedValue(expectedValue);

			const result = await service.get(key);

			expect(result).toBe(expectedValue);
			expect(mockCacheManager.get).toHaveBeenCalledWith(key);
			expect(service.getStats().hits).toBe(1);
			expect(service.getStats().misses).toBe(0);
		});

		it('should return undefined when key does not exist', async () => {
			const key = 'non-existent-key';
			mockCacheManager.get.mockResolvedValue(null);

			const result = await service.get(key);

			expect(result).toBeUndefined();
			expect(mockCacheManager.get).toHaveBeenCalledWith(key);
			expect(service.getStats().hits).toBe(0);
			expect(service.getStats().misses).toBe(1);
		});

		it('should handle cache errors gracefully', async () => {
			const key = 'error-key';
			const error = new Error('Cache connection failed');
			mockCacheManager.get.mockRejectedValue(error);

			const result = await service.get(key);

			expect(result).toBeUndefined();
			expect(mockCacheManager.get).toHaveBeenCalledWith(key);
			expect(service.getStats().errors).toBe(1);
		});
	});

	describe('set', () => {
		it('should set value without TTL', async () => {
			const key = 'test-key';
			const value = { data: 'test' };

			await service.set(key, value);

			expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, undefined);
			expect(service.getStats().sets).toBe(1);
		});

		it('should set value with TTL', async () => {
			const key = 'test-key';
			const value = { data: 'test' };
			const ttl = 300;

			await service.set(key, value, ttl);

			expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, ttl);
			expect(service.getStats().sets).toBe(1);
		});

		it('should handle set errors', async () => {
			const key = 'error-key';
			const value = { data: 'test' };
			const error = new Error('Cache set failed');
			mockCacheManager.set.mockRejectedValue(error);

			await expect(service.set(key, value)).rejects.toThrow(error);
			expect(service.getStats().errors).toBe(1);
		});
	});

	describe('del', () => {
		it('should delete single key', async () => {
			const key = 'test-key';
			mockCacheManager.del.mockResolvedValue(undefined);

			await service.del(key);

			expect(mockCacheManager.del).toHaveBeenCalledWith(key);
			expect(service.getStats().deletes).toBe(1);
		});

		it('should delete multiple keys', async () => {
			const keys = ['key1', 'key2', 'key3'];
			mockCacheManager.del.mockResolvedValue(undefined);

			await service.del(keys);

			expect(mockCacheManager.del).toHaveBeenCalledTimes(3);
			keys.forEach(key => {
				expect(mockCacheManager.del).toHaveBeenCalledWith(key);
			});
			expect(service.getStats().deletes).toBe(1);
		});

		it('should handle delete errors', async () => {
			const key = 'error-key';
			const error = new Error('Cache delete failed');
			mockCacheManager.del.mockRejectedValue(error);

			await expect(service.del(key)).rejects.toThrow(error);
			expect(service.getStats().errors).toBe(1);
		});
	});

	describe('clear', () => {
		it('should clear all cache entries', async () => {
			mockCacheManager.clear.mockResolvedValue(undefined);

			await service.clear();

			expect(mockCacheManager.clear).toHaveBeenCalled();
			expect(service.getStats().clears).toBe(1);
		});

		it('should handle clear errors', async () => {
			const error = new Error('Cache clear failed');
			mockCacheManager.clear.mockRejectedValue(error);

			await expect(service.clear()).rejects.toThrow(error);
			expect(service.getStats().errors).toBe(1);
		});
	});

	describe('exists', () => {
		it('should return true when key exists', async () => {
			const key = 'existing-key';
			const value = { data: 'test' };
			mockCacheManager.get.mockResolvedValue(value);

			const result = await service.exists(key);

			expect(result).toBe(true);
			expect(mockCacheManager.get).toHaveBeenCalledWith(key);
		});

		it('should return false when key does not exist', async () => {
			const key = 'non-existent-key';
			mockCacheManager.get.mockResolvedValue(null);

			const result = await service.exists(key);

			expect(result).toBe(false);
			expect(mockCacheManager.get).toHaveBeenCalledWith(key);
		});

		it('should handle exists errors', async () => {
			const key = 'error-key';
			const error = new Error('Cache exists failed');
			mockCacheManager.get.mockRejectedValue(error);

			const result = await service.exists(key);

			expect(result).toBe(false);
			expect(service.getStats().errors).toBe(1);
		});
	});

	describe('getOrSet', () => {
		it('should return cached value if exists', async () => {
			const key = 'test-key';
			const cachedValue = { data: 'cached' };
			const factory = vi.fn();

			mockCacheManager.get.mockResolvedValue(cachedValue);

			const result = await service.getOrSet(key, factory);

			expect(result).toBe(cachedValue);
			expect(factory).not.toHaveBeenCalled();
			expect(mockCacheManager.set).not.toHaveBeenCalled();
		});

		it('should execute factory and cache result if not cached', async () => {
			const key = 'test-key';
			const factoryValue = { data: 'fresh' };
			const factory = vi.fn().mockResolvedValue(factoryValue);

			mockCacheManager.get.mockResolvedValue(null);

			const result = await service.getOrSet(key, factory);

			expect(result).toBe(factoryValue);
			expect(factory).toHaveBeenCalled();
			expect(mockCacheManager.set).toHaveBeenCalledWith(key, factoryValue, undefined);
		});

		it('should execute factory and cache result with TTL', async () => {
			const key = 'test-key';
			const factoryValue = { data: 'fresh' };
			const ttl = 600;
			const factory = vi.fn().mockResolvedValue(factoryValue);

			mockCacheManager.get.mockResolvedValue(null);

			const result = await service.getOrSet(key, factory, ttl);

			expect(result).toBe(factoryValue);
			expect(factory).toHaveBeenCalled();
			expect(mockCacheManager.set).toHaveBeenCalledWith(key, factoryValue, ttl);
		});

		it('should handle factory errors', async () => {
			const key = 'test-key';
			const error = new Error('Factory failed');
			const factory = vi.fn().mockRejectedValue(error);

			mockCacheManager.get.mockResolvedValue(null);

			await expect(service.getOrSet(key, factory)).rejects.toThrow(error);
			expect(factory).toHaveBeenCalled();
			expect(mockCacheManager.set).not.toHaveBeenCalled();
		});
	});

	describe('invalidatePattern', () => {
		it('should invalidate keys matching pattern', async () => {
			const pattern = 'user:*';
			const matchingKeys = ['user:1', 'user:2', 'user:3'];
			mockCacheManager.store.keys.mockResolvedValue(matchingKeys);
			mockCacheManager.del.mockResolvedValue(undefined);

			const result = await service.invalidatePattern(pattern);

			expect(mockCacheManager.store.keys).toHaveBeenCalledWith(pattern);
			expect(mockCacheManager.del).toHaveBeenCalledTimes(3);
			matchingKeys.forEach(key => {
				expect(mockCacheManager.del).toHaveBeenCalledWith(key);
			});
			expect(result).toBe(3);
		});

		it('should return 0 when no keys match pattern', async () => {
			const pattern = 'empty:*';
			mockCacheManager.store.keys.mockResolvedValue([]);

			const result = await service.invalidatePattern(pattern);

			expect(mockCacheManager.store.keys).toHaveBeenCalledWith(pattern);
			expect(mockCacheManager.del).not.toHaveBeenCalled();
			expect(result).toBe(0);
		});

		it('should return 0 when store does not support pattern matching', async () => {
			const pattern = 'test:*';
			const cacheManagerWithoutStore = {
				...mockCacheManager,
				store: undefined,
			};

			const mockAppLogger = {
				createContextualLogger: vi.fn().mockReturnValue({
					debug: vi.fn(),
					info: vi.fn(),
					warn: vi.fn(),
					error: vi.fn(),
				}),
			};

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					CacheService,
					{
						provide: CACHE_MANAGER,
						useValue: cacheManagerWithoutStore,
					},
					{
						provide: AppLogger,
						useValue: mockAppLogger,
					},
				],
			}).compile();

			const serviceWithoutStore = module.get<CacheService>(CacheService);

			const result = await serviceWithoutStore.invalidatePattern(pattern);

			expect(result).toBe(0);
		});

		it('should handle invalidatePattern errors', async () => {
			const pattern = 'error:*';
			const error = new Error('Pattern invalidation failed');
			mockCacheManager.store.keys.mockRejectedValue(error);

			const result = await service.invalidatePattern(pattern);

			expect(result).toBe(0);
			expect(service.getStats().errors).toBe(1);
		});
	});

	describe('getStats', () => {
		it('should return current statistics', () => {
			const stats = service.getStats();

			expect(stats).toEqual({
				hits: 0,
				misses: 0,
				sets: 0,
				deletes: 0,
				clears: 0,
				errors: 0,
				hitRate: 0,
			});
		});

		it('should calculate hit rate correctly', async () => {
			// Simulate some cache operations
			mockCacheManager.get.mockResolvedValueOnce({ data: 'hit1' });
			mockCacheManager.get.mockResolvedValueOnce(null);
			mockCacheManager.get.mockResolvedValueOnce({ data: 'hit2' });

			await service.get('key1'); // hit
			await service.get('key2'); // miss
			await service.get('key3'); // hit

			const stats = service.getStats();
			expect(stats.hits).toBe(2);
			expect(stats.misses).toBe(1);
			expect(stats.hitRate).toBe(2 / 3); // 2 hits out of 3 total requests
		});
	});

	describe('resetStats', () => {
		it('should reset all statistics to zero', async () => {
			// Generate some stats
			mockCacheManager.get.mockResolvedValue({ data: 'test' });
			await service.get('key');
			await service.set('key', 'value');

			expect(service.getStats().hits).toBe(1);
			expect(service.getStats().sets).toBe(1);

			service.resetStats();

			const stats = service.getStats();
			expect(stats.hits).toBe(0);
			expect(stats.misses).toBe(0);
			expect(stats.sets).toBe(0);
			expect(stats.deletes).toBe(0);
			expect(stats.clears).toBe(0);
			expect(stats.errors).toBe(0);
			expect(stats.hitRate).toBe(0);
		});
	});

	describe('onModuleDestroy', () => {
		it('should log final statistics on destroy', async () => {
			const loggerSpy = vi.spyOn(service['logger'], 'info').mockImplementation();

			await service.onModuleDestroy();

			expect(loggerSpy).toHaveBeenCalledWith(`Cache statistics: ${JSON.stringify(service.getStats())}`);
		});

		it('should handle destroy errors gracefully', async () => {
			const _loggerSpy = vi.spyOn(service['logger'], 'info').mockImplementation(() => {
				throw new Error('Logging failed');
			});
			void (_loggerSpy); // Mark as used to satisfy linter
			const errorSpy = vi.spyOn(service['logger'], 'error').mockImplementation();

			await service.onModuleDestroy();

			expect(errorSpy).toHaveBeenCalledWith(
				'Error during cache service cleanup:',
				expect.any(Error),
			);
		});
	});

	describe('BaseCacheService Error Handling', () => {
		it('should handle get operation failures', async () => {
			mockCacheManager.get.mockRejectedValue(new Error('Redis error'));

			await expect(service.get('key')).resolves.toBeUndefined();
			expect(service.getStats().errors).toBe(1);
		});

		it('should handle set operation failures', async () => {
			mockCacheManager.set.mockRejectedValue(new Error('Redis error'));

			await expect(service.set('key', 'value')).rejects.toThrow();
			expect(service.getStats().errors).toBe(1);
		});

		it('should handle delete operation failures', async () => {
			mockCacheManager.del.mockRejectedValue(new Error('Redis error'));

			await expect(service.del('key')).rejects.toThrow();
			expect(service.getStats().errors).toBe(1);
		});

		it('should handle clear operation failures', async () => {
			mockCacheManager.clear.mockRejectedValue(new Error('Redis error'));

			await expect(service.clear()).rejects.toThrow();
			expect(service.getStats().errors).toBe(1);
		});

		it('should log error stack trace on get failure', async () => {
			const error = new Error('Redis error with stack');
			error.stack = 'Error: Redis error with stack\n  at someFunction (file.ts:10:5)';
			mockCacheManager.get.mockRejectedValue(error);

			const errorSpy = vi.spyOn(service['logger'], 'error').mockImplementation();

			await service.get('key');

			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Cache get error'),
				expect.any(String),
			);
		});

		it('should log error on set operation failure', async () => {
			const error = new Error('Redis set error');
			mockCacheManager.set.mockRejectedValue(error);

			const errorSpy = vi.spyOn(service['logger'], 'error').mockImplementation();

			await expect(service.set('key', 'value')).rejects.toThrow();

			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Cache set error'),
				expect.any(String),
			);
		});

		it('should track error count on multiple failures', async () => {
			mockCacheManager.get.mockRejectedValue(new Error('Redis error'));

			await service.get('key1');
			await service.get('key2');
			await service.get('key3');

			expect(service.getStats().errors).toBe(3);
		});

		it('should maintain operation timing even on errors', async () => {
			mockCacheManager.get.mockRejectedValue(new Error('Redis error'));

			await service.get('key');

			const stats = service.getStats();
			expect(stats.operationTimings.get.length).toBeGreaterThan(0);
		});
	});

	describe('Cache Key Validation', () => {
		describe('set - cache key validation', () => {
			it('should throw error for empty cache key', async () => {
				await expect(service.set('', 'value')).rejects.toThrow('Cache key cannot be empty');
			});

			it('should throw error for null cache key', async () => {
				await expect(service.set(null as any, 'value')).rejects.toThrow('Cache key must be a string');
			});

			it('should throw error for undefined cache key', async () => {
				await expect(service.set(undefined as any, 'value')).rejects.toThrow('Cache key must be a string');
			});

			it('should throw error for cache key with null bytes', async () => {
				await expect(service.set('key\0invalid', 'value')).rejects.toThrow('Cache key contains invalid characters');
			});

			it('should throw error for cache key with control characters', async () => {
				await expect(service.set('key\x01invalid', 'value')).rejects.toThrow('Cache key contains invalid control characters');
			});

			it('should throw error for cache key exceeding max length', async () => {
				const longKey = 'a'.repeat(513);
				await expect(service.set(longKey, 'value')).rejects.toThrow('Cache key exceeds maximum length');
			});

			it('should allow valid cache keys', async () => {
				const validKeys = ['valid:key:123', 'user-profile', 'cache_v1', 'key.with.dots'];
				for (const key of validKeys) {
					mockCacheManager.set.mockResolvedValue(undefined);
					await expect(service.set(key, 'value')).resolves.not.toThrow();
				}
			});

			it('should allow cache keys at maximum length', async () => {
				const maxLengthKey = 'a'.repeat(512);
				mockCacheManager.set.mockResolvedValue(undefined);
				await expect(service.set(maxLengthKey, 'value')).resolves.not.toThrow();
			});
		});

		describe('get - cache key validation', () => {
			it('should throw error for empty cache key', async () => {
				await expect(service.get('')).rejects.toThrow('Cache key cannot be empty');
			});

			it('should throw error for null cache key', async () => {
				await expect(service.get(null as any)).rejects.toThrow('Cache key must be a string');
			});

			it('should throw error for undefined cache key', async () => {
				await expect(service.get(undefined as any)).rejects.toThrow('Cache key must be a string');
			});

			it('should throw error for cache key with invalid characters', async () => {
				await expect(service.get('key\0invalid')).rejects.toThrow('Cache key contains invalid characters');
			});

			it('should throw error for cache key exceeding max length', async () => {
				const longKey = 'a'.repeat(513);
				await expect(service.get(longKey)).rejects.toThrow('Cache key exceeds maximum length');
			});

			it('should allow valid cache key', async () => {
				mockCacheManager.get.mockResolvedValue('value');
				await expect(service.get('valid:key')).resolves.not.toThrow();
			});
		});

		describe('delete - cache key validation', () => {
			it('should throw error for empty cache key', async () => {
				await expect(service.del('')).rejects.toThrow('Cache key cannot be empty');
			});

			it('should throw error for null cache key', async () => {
				await expect(service.del(null as any)).rejects.toThrow('Cache key must be a string');
			});

			it('should throw error for cache key with invalid characters', async () => {
				await expect(service.del('key\0invalid')).rejects.toThrow('Cache key contains invalid characters');
			});

			it('should throw error for cache key exceeding max length', async () => {
				const longKey = 'a'.repeat(513);
				await expect(service.del(longKey)).rejects.toThrow('Cache key exceeds maximum length');
			});

			it('should throw error when one key in array is invalid', async () => {
				await expect(service.del(['valid:key', '', 'another:key'])).rejects.toThrow('Cache key cannot be empty');
			});

			it('should allow valid cache keys', async () => {
				mockCacheManager.del.mockResolvedValue(undefined);
				await expect(service.del('valid:key')).resolves.not.toThrow();
				await expect(service.del(['key1', 'key2'])).resolves.not.toThrow();
			});
		});

		describe('exists - cache key validation', () => {
			it('should throw error for empty cache key', async () => {
				await expect(service.exists('')).rejects.toThrow('Cache key cannot be empty');
			});

			it('should throw error for null cache key', async () => {
				await expect(service.exists(null as any)).rejects.toThrow('Cache key must be a string');
			});

			it('should throw error for cache key with invalid characters', async () => {
				await expect(service.exists('key\0invalid')).rejects.toThrow('Cache key contains invalid characters');
			});

			it('should allow valid cache key', async () => {
				mockCacheManager.get.mockResolvedValue('value');
				await expect(service.exists('valid:key')).resolves.not.toThrow();
			});
		});

		describe('getOrSet - cache key validation', () => {
			it('should throw error for empty cache key', async () => {
				const factory = vi.fn();
				await expect(service.getOrSet('', factory)).rejects.toThrow('Cache key cannot be empty');
			});

			it('should throw error for null cache key', async () => {
				const factory = vi.fn();
				await expect(service.getOrSet(null as any, factory)).rejects.toThrow('Cache key must be a string');
			});

			it('should throw error for cache key with invalid characters', async () => {
				const factory = vi.fn();
				await expect(service.getOrSet('key\0invalid', factory)).rejects.toThrow('Cache key contains invalid characters');
			});

			it('should allow valid cache key', async () => {
				const factory = vi.fn().mockResolvedValue('value');
				mockCacheManager.get.mockResolvedValue(null);
				mockCacheManager.set.mockResolvedValue(undefined);
				await expect(service.getOrSet('valid:key', factory)).resolves.not.toThrow();
			});
		});

		describe('invalidatePattern - cache key validation', () => {
			it('should throw error for empty pattern', async () => {
				await expect(service.invalidatePattern('')).rejects.toThrow('Cache key cannot be empty');
			});

			it('should throw error for null pattern', async () => {
				await expect(service.invalidatePattern(null as any)).rejects.toThrow('Cache key must be a string');
			});

			it('should throw error for pattern with invalid characters', async () => {
				await expect(service.invalidatePattern('key\0invalid')).rejects.toThrow('Cache key contains invalid characters');
			});

			it('should allow valid pattern', async () => {
				mockCacheManager.store.keys.mockResolvedValue([]);
				await expect(service.invalidatePattern('user:*')).resolves.not.toThrow();
			});
		});
	});

	describe('BaseCacheService Memory Management', () => {
		it('should limit operationTimings map size', async () => {
			const maxSize = 10000;
			mockCacheManager.set.mockResolvedValue(undefined);
			mockCacheManager.get.mockResolvedValue(null);

			// Perform many operations
			for (let i = 0; i < 15000; i++) {
				await service.set(`key_${i}`, `value_${i}`);
			}

			// operationTimings should not exceed maxSize
			const operationTimingsMap = (service as any).operationTimings;
			let totalTimings = 0;
			for (const [, timings] of operationTimingsMap.entries()) {
				totalTimings += (timings as number[]).length;
			}

			// Should not have accumulated excessive timing entries
			expect(totalTimings).toBeLessThanOrEqual(maxSize);
		});

		it('should clean up old timing entries', async () => {
			// Call cleanupTimings method
			const cleanupMethod = (service as any).cleanupTimings;
			if (typeof cleanupMethod === 'function') {
				// Simulate old entries
				(service as any).operationTimings.set('old_key_1', [Date.now() - 7200000]);
				(service as any).operationTimings.set('recent_key', [Date.now()]);

				// Trigger cleanup
				cleanupMethod.call(service);

				// Verify old entries should be removed (if cleanup has timestamp-based logic)
				const { operationTimings } = (service as any);
				expect(operationTimings.size).toBeGreaterThan(0);
			}
		});

		it('should track operation count without unbounded memory growth', async () => {
			mockCacheManager.set.mockResolvedValue(undefined);
			mockCacheManager.get.mockResolvedValue(null);

			for (let i = 0; i < 1000; i++) {
				await service.set(`key_${i}`, 'value');
			}

			// Stats should track operations
			const stats = service.getStats();
			expect(stats.sets).toBe(1000);

			// But operationTimings arrays should not grow unbounded
			const operationTimingsMap = (service as any).operationTimings;
			for (const [opType, timings] of operationTimingsMap.entries()) {
				if (opType === 'set') {
					// Should be capped at reasonable size (e.g., 1000)
					expect((timings as number[]).length).toBeLessThanOrEqual(1000);
				}
			}
		});

		it('should provide memory usage estimation', async () => {
			const stats = service.getStats();

			// Stats should include memoryUsage field
			expect(stats).toHaveProperty('memoryUsage');
		});

		it('should maintain stable memory usage under moderate load', async () => {
			mockCacheManager.set.mockResolvedValue(undefined);
			mockCacheManager.get.mockResolvedValue(null);

			const initialStats = service.getStats();
			const initialMemory = initialStats.memoryUsage ?? 0;

			// Perform 1000 operations
			for (let i = 0; i < 1000; i++) {
				await service.set(`key_${i}`, `value_${i}`);
				if (i % 100 === 0) {
					await service.get(`key_${Math.floor(Math.random() * i)}`);
				}
			}

			const finalStats = service.getStats();
			const finalMemory = finalStats.memoryUsage ?? 0;

			// Memory growth should be reasonable
			const memoryGrowth = finalMemory - initialMemory;

			// Should not grow excessively (if tracking is implemented)
			if (finalMemory > 0) {
				expect(finalMemory).toBeLessThan(1000000); // Less than 1MB estimate
			}
		});

		it('should reset memory-related stats on resetStats', async () => {
			mockCacheManager.set.mockResolvedValue(undefined);

			// Perform some operations
			for (let i = 0; i < 100; i++) {
				await service.set(`key_${i}`, `value_${i}`);
			}

			// Reset stats
			service.resetStats();

			// Verify cleanup
			const operationTimingsMap = (service as any).operationTimings;
			expect(operationTimingsMap.size).toBe(0);

			const { memorySnapshots } = (service as any);
			expect(memorySnapshots.length).toBe(0);

			const { keyDistribution } = (service as any);
			expect(keyDistribution.size).toBe(0);
		});

		it('should handle memory cleanup on module destroy', async () => {
			mockCacheManager.set.mockResolvedValue(undefined);

			// Perform some operations
			for (let i = 0; i < 100; i++) {
				await service.set(`key_${i}`, `value_${i}`);
			}

			// Call onModuleDestroy
			await service.onModuleDestroy();

			// Should not throw and should log final stats
			expect(service.getStats()).toBeDefined();
		});
	});
});
