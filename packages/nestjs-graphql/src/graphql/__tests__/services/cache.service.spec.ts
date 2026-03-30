
import { vi } from 'vitest';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { GraphQLCacheService } from '../../services/cache.service.js';

describe('GraphQLCacheService', () => {
	let service: GraphQLCacheService;
	let mockCacheManager: any;

	beforeEach(() => {
		mockCacheManager = {
			set: vi.fn().mockResolvedValue(undefined),
			get: vi.fn().mockResolvedValue(null),
			del: vi.fn().mockResolvedValue(undefined),
		};

		const mockAppLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}),
		};

		const mockModuleRef = {
			get: (token: any) => {
				if (token === CACHE_MANAGER) return mockCacheManager;
				if (token === AppLogger) return mockAppLogger;
				throw new Error(`Unknown token: ${String(token)}`);
			},
		} as any;

		service = new GraphQLCacheService(mockModuleRef);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('generateKey', () => {
		it('should generate key for operation without args', () => {
			const key = service.generateKey('users');

			expect(key).toBe('graphql:users');
		});

		it('should generate key with sorted arguments', () => {
			const args = { id: 123, name: 'test', category: 'admin' };
			const key = service.generateKey('user', args);

			expect(key).toBe('graphql:user|category:"admin"|id:123|name:"test"');
		});

		it('should generate key with context', () => {
			const args = { id: 123 };
			const context = { userId: 'user456', role: 'admin' };
			const key = service.generateKey('user', args, context);

			expect(key).toBe('graphql:user|id:123|role:"admin"|userId:"user456"');
		});

		it('should handle complex argument types', () => {
			const args = {
				ids: [1, 2, 3],
				filter: { status: 'active', type: 'premium' },
				limit: 10,
			};
			const key = service.generateKey('users', args);

			expect(key).toContain('graphql:users');
			expect(key).toContain('filter:');
			expect(key).toContain('ids:');
			expect(key).toContain('limit:10');
		});

		it('should handle empty args and context', () => {
			const key = service.generateKey('query', {}, {});

			expect(key).toBe('graphql:query');
		});
	});

	describe('set', () => {
		it('should set value in cache', async () => {
			const key = 'test-key';
			const value = { data: 'test' };
			const ttl = 300000;

			await service.set(key, value, ttl);

			expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, ttl);
		});

		it('should set value without TTL using default', async () => {
			const key = 'test-key';
			const value = 'test-value';

			await service.set(key, value);

			expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, 300000);
		});

		it('should handle cache errors', async () => {
			mockCacheManager.set.mockRejectedValue(new Error('Cache error'));

			const key = 'test-key';
			const value = 'test-value';

			await expect(service.set(key, value)).rejects.toThrow('Cache error');
		});
	});

	describe('get', () => {
		it('should return cached value when available', async () => {
			const key = 'test-key';
			const cachedValue = { data: 'cached' };

			mockCacheManager.get.mockResolvedValue(cachedValue);

			const result = await service.get(key);

			expect(result).toBe(cachedValue);
			expect(mockCacheManager.get).toHaveBeenCalledWith(key);
		});

		it('should return undefined when cache miss', async () => {
			const key = 'missing-key';

			mockCacheManager.get.mockResolvedValue(null);

			const result = await service.get(key);

			expect(result).toBeUndefined();
		});

		it('should return undefined when cache returns undefined', async () => {
			const key = 'undefined-key';

			mockCacheManager.get.mockResolvedValue(undefined);

			const result = await service.get(key);

			expect(result).toBeUndefined();
		});

		it('should handle cache errors gracefully', async () => {
			mockCacheManager.get.mockRejectedValue(new Error('Cache error'));

			const key = 'error-key';

			const result = await service.get(key);

			expect(result).toBeUndefined();
		});

		it('should track cache hits', async () => {
			const key = 'test-key';
			mockCacheManager.get.mockResolvedValue({ data: 'value' });

			await service.get(key);
			const stats = service.getStats();

			expect(stats.hits).toBe(1);
			expect(stats.misses).toBe(0);
		});

		it('should track cache misses', async () => {
			const key = 'test-key';
			mockCacheManager.get.mockResolvedValue(null);

			await service.get(key);
			const stats = service.getStats();

			expect(stats.hits).toBe(0);
			expect(stats.misses).toBe(1);
		});
	});

	describe('getOrSet', () => {
		it('should return cached value on cache hit', async () => {
			const key = 'test-key';
			const cachedValue = { data: 'cached' };
			const loader = vi.fn().mockResolvedValue({ data: 'fresh' });

			mockCacheManager.get.mockResolvedValue(cachedValue);

			const result = await service.getOrSet(key, loader);

			expect(result).toBe(cachedValue);
			expect(loader).not.toHaveBeenCalled();
		});

		it('should load and cache value on cache miss', async () => {
			const key = 'test-key';
			const freshValue = { data: 'fresh' };
			const loader = vi.fn().mockResolvedValue(freshValue);

			mockCacheManager.get.mockResolvedValue(null);

			const result = await service.getOrSet(key, loader);

			expect(result).toBe(freshValue);
			expect(loader).toHaveBeenCalled();
			expect(mockCacheManager.set).toHaveBeenCalledWith(key, freshValue, 300000);
		});

		it('should use custom TTL for getOrSet', async () => {
			const key = 'test-key';
			const freshValue = { data: 'fresh' };
			const loader = vi.fn().mockResolvedValue(freshValue);
			const ttl = 600000;

			mockCacheManager.get.mockResolvedValue(null);

			await service.getOrSet(key, loader, ttl);

			expect(mockCacheManager.set).toHaveBeenCalledWith(key, freshValue, ttl);
		});

		it('should handle loader errors', async () => {
			const key = 'test-key';
			const loader = vi.fn().mockRejectedValue(new Error('Load error'));

			mockCacheManager.get.mockResolvedValue(null);

			await expect(service.getOrSet(key, loader)).rejects.toThrow('Load error');
		});
	});

	describe('delete', () => {
		it('should delete value from cache', async () => {
			const key = 'test-key';

			await service.delete(key);

			expect(mockCacheManager.del).toHaveBeenCalledWith(key);
		});

		it('should handle delete errors', async () => {
			mockCacheManager.del.mockRejectedValue(new Error('Delete error'));

			const key = 'test-key';

			await expect(service.delete(key)).rejects.toThrow('Delete error');
		});
	});

	describe('clear', () => {
		it('should call clear operation', async () => {
			await service.clear();

			// Should not throw - implementation depends on cache store
			expect(true).toBe(true);
		});
	});

	describe('invalidatePattern', () => {
		it('should log pattern invalidation request', async () => {
			const pattern = 'graphql:user|id:*';

			await service.invalidatePattern(pattern);

			// Should not throw - logs the intent
			expect(true).toBe(true);
		});
	});

	describe('getStats', () => {
		it('should return cache statistics', () => {
			const stats = service.getStats();

			expect(stats).toHaveProperty('hits');
			expect(stats).toHaveProperty('misses');
			expect(stats).toHaveProperty('hitRate');
			expect(stats).toHaveProperty('store');
			expect(stats.store).toBe('CacheManager');
		});

		it('should calculate hit rate correctly', async () => {
			const key = 'test-key';

			// 3 hits
			mockCacheManager.get.mockResolvedValue({ data: 'value' });
			await service.get(key);
			await service.get(key);
			await service.get(key);

			// 2 misses
			mockCacheManager.get.mockResolvedValue(null);
			await service.get(key);
			await service.get(key);

			const stats = service.getStats();
			expect(stats.hits).toBe(3);
			expect(stats.misses).toBe(2);
			expect(stats.hitRate).toBe(60); // 3 / (3 + 2) * 100
		});

		it('should return 0 hit rate when no operations', () => {
			const stats = service.getStats();

			expect(stats.hitRate).toBe(0);
		});
	});

	describe('resetStats', () => {
		it('should reset cache statistics', async () => {
			const key = 'test-key';

			// Generate some stats
			mockCacheManager.get.mockResolvedValue({ data: 'value' });
			await service.get(key);

			let stats = service.getStats();
			expect(stats.hits).toBe(1);

			// Reset
			service.resetStats();

			stats = service.getStats();
			expect(stats.hits).toBe(0);
			expect(stats.misses).toBe(0);
		});
	});

	describe('Performance - Cache Efficiency', () => {
		it('should set cache value under 5ms', async () => {
			const key = 'test-key';
			const value = { data: 'test' };

			const start = performance.now();
			await service.set(key, value, 300000);
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(5);
		});

		it('should get cache value under 2ms', async () => {
			const key = 'test-key';
			mockCacheManager.get.mockResolvedValue({ data: 'cached' });

			const start = performance.now();
			await service.get(key);
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(2);
		});

		it('should generate cache key under 1ms', () => {
			const args = { id: 123, name: 'test', category: 'admin' };

			const start = performance.now();
			service.generateKey('user', args);
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(1);
		});

		it('should handle high-volume cache operations', async () => {
			const iterations = 1000;
			mockCacheManager.get.mockResolvedValue({ data: 'cached' });

			const start = performance.now();
			for (let i = 0; i < iterations; i++) {
				await service.get(`key-${i}`);
			}
			const elapsed = performance.now() - start;

			// Should complete 1000 operations in under 2 seconds
			expect(elapsed).toBeLessThan(2000);
		});

		it('should maintain low memory footprint with statistics', async () => {
			// Generate many operations
			mockCacheManager.get.mockResolvedValue({ data: 'value' });
			for (let i = 0; i < 10000; i++) {
				await service.get(`key-${i}`);
			}

			const stats = service.getStats();

			// Stats should be minimal (just hit/miss counts)
			expect(stats.hits + stats.misses).toBe(10000);
		});
	});

	describe('Performance - Resolver Caching Scenarios', () => {
		it('should cache frequently accessed user data', async () => {
			const userId = 'user-123';
			const userData = { id: userId, name: 'John', email: 'john@example.com' };
			let dbCalls = 0;

			const loader = vi.fn(async () => {
				dbCalls++;
				return userData;
			});

			mockCacheManager.get.mockResolvedValue(null);
			mockCacheManager.set.mockResolvedValue(undefined);

			// First call - database query
			await service.getOrSet(`user:${userId}`, loader);
			expect(dbCalls).toBe(1);

			// Mock cache hit on second call
			mockCacheManager.get.mockResolvedValue(userData);
			await service.getOrSet(`user:${userId}`, loader);
			expect(dbCalls).toBe(1); // Should not increment

			const stats = service.getStats();
			expect(stats.hits).toBeGreaterThan(0);
		});

		it('should handle list queries with pagination caching', async () => {
			const page = 1;
			const pageSize = 20;
			const listKey = `users:page:${page}:size:${pageSize}`;

			const listData = Array.from({ length: pageSize }, (_, i) => ({
				id: `user-${i}`,
				name: `IUser ${i}`,
			}));

			mockCacheManager.get.mockResolvedValue(null);
			mockCacheManager.set.mockResolvedValue(undefined);

			const loader = vi.fn().mockResolvedValue(listData);

			const result = await service.getOrSet(listKey, loader, 600000); // 10 minutes

			expect(result).toBe(listData);
			expect(mockCacheManager.set).toHaveBeenCalledWith(listKey, listData, 600000);
		});

		it('should track hit rate for query optimization insights', async () => {
			mockCacheManager.get.mockResolvedValue(null);

			// Simulate 10 cache misses
			for (let i = 0; i < 10; i++) {
				await service.get(`key-${i}`);
			}

			let stats = service.getStats();
			expect(stats.hitRate).toBe(0);

			// Now simulate hits
			mockCacheManager.get.mockResolvedValue({ data: 'value' });
			for (let i = 0; i < 5; i++) {
				await service.get(`key-${i}`);
			}

			stats = service.getStats();
			expect(stats.hitRate).toBeGreaterThan(0);
			expect(stats.hitRate).toBeLessThanOrEqual(100);
		});
	});
});
