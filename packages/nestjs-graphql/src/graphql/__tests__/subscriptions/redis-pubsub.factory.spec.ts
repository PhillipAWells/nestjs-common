
import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisPubSubFactory } from '../../subscriptions/redis-pubsub.factory.js';
import { IRedisConfig } from '../../subscriptions/subscription-config.interface.js';

const mockRedisInstance = {
	on: vi.fn(),
	ping: vi.fn(),
	quit: vi.fn(),
};

const mockPubSubInstance = {
	close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('ioredis', () => {
	// eslint-disable-next-line no-var
	var MockRedis = vi.fn(function MockRedisConstructor(this: any) {
		Object.assign(this, mockRedisInstance);
		return mockRedisInstance;
	});
	return { Redis: MockRedis };
});

vi.mock('graphql-redis-subscriptions', () => {
	// eslint-disable-next-line no-var
	var MockRedisPubSub = vi.fn(function MockRedisPubSubConstructor(this: any) {
		Object.assign(this, mockPubSubInstance);
		return mockPubSubInstance;
	});
	return { RedisPubSub: MockRedisPubSub };
});

describe('RedisPubSubFactory', () => {
	let factory: RedisPubSubFactory;
	let MockRedis: any;
	let MockRedisPubSub: any;

	beforeEach(async () => {
		// Get the mocked modules
		const ioredis = await import('ioredis');
		MockRedis = ioredis.Redis as any;

		const grs = await import('graphql-redis-subscriptions');
		MockRedisPubSub = grs.RedisPubSub as any;

		vi.clearAllMocks();
		// Restore mock implementations after clearAllMocks
		MockRedis.mockImplementation(function(this: any) {
			Object.assign(this, mockRedisInstance);
			return mockRedisInstance;
		});
		MockRedisPubSub.mockImplementation(function(this: any) {
			Object.assign(this, mockPubSubInstance);
			return mockPubSubInstance;
		});
		mockPubSubInstance.close.mockResolvedValue(undefined);

		const module: TestingModule = await Test.createTestingModule({
			providers: [RedisPubSubFactory],
		}).compile();

		factory = module.get<RedisPubSubFactory>(RedisPubSubFactory);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('createPubSub', () => {
		it('should create a Redis PubSub instance with basic config', () => {
			const config: IRedisConfig = {
				host: 'localhost',
				port: 6379,
			};

			const pubSub = factory.createPubSub(config);

			expect(pubSub).toBeDefined();
			expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
			expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
			expect(mockRedisInstance.on).toHaveBeenCalledWith('ready', expect.any(Function));
			expect(mockRedisInstance.on).toHaveBeenCalledWith('end', expect.any(Function));
		});

		it('should create Redis clients with full configuration', () => {
			const config: IRedisConfig = {
				host: 'redis.example.com',
				port: 6380,
				password: 'secret',
				db: 1,
				connectTimeout: 30000,
				tls: { ca: 'ca-cert' },
			};

			factory.createPubSub(config);

			expect(MockRedis).toHaveBeenCalledWith(expect.objectContaining({
				host: 'redis.example.com',
				port: 6380,
				password: 'secret',
				db: 1,
				connectTimeout: 30000,
				tls: { ca: 'ca-cert' },
			}));
		});

		it('should start health checks when enabled', () => {
			const config: IRedisConfig = {
				host: 'localhost',
				port: 6379,
				healthCheck: {
					enabled: true,
					interval: 60000,
					timeout: 5000,
				},
			};

			factory.createPubSub(config);

			// Health check interval should be set
			expect((factory as any).HealthCheckInterval).toBeDefined();
		});

		it('should not start health checks when disabled', () => {
			const config: IRedisConfig = {
				host: 'localhost',
				port: 6379,
				healthCheck: {
					enabled: false,
					interval: 60000,
					timeout: 5000,
				},
			};

			factory.createPubSub(config);

			expect((factory as any).HealthCheckInterval).toBeUndefined();
		});
	});

	describe('getHealthStatus', () => {
		beforeEach(() => {
			mockRedisInstance.ping.mockImplementation((callback: Function) => {
				callback(null, 'PONG');
			});
		});

		it('should return healthy status when clients are connected', async () => {
			const config: IRedisConfig = {
				host: 'localhost',
				port: 6379,
			};

			factory.createPubSub(config);

			const status = await factory.getHealthStatus();

			expect(status.publisher).toBe(true);
			expect(status.subscriber).toBe(true);
			expect(status.pubSubInstances).toBe(1);
		});

		it('should return unhealthy status when ping fails', async () => {
			mockRedisInstance.ping.mockImplementation((callback: Function) => {
				callback(new Error('Connection failed'), null);
			});

			const config: IRedisConfig = {
				host: 'localhost',
				port: 6379,
			};

			factory.createPubSub(config);

			const status = await factory.getHealthStatus();

			expect(status.publisher).toBe(false);
			expect(status.subscriber).toBe(false);
			expect(status.pubSubInstances).toBe(1);
		});

		it('should handle ping timeout', async () => {
			vi.useFakeTimers();

			mockRedisInstance.ping.mockImplementation(() => {
				// Don't call callback to simulate timeout
			});

			const config: IRedisConfig = {
				host: 'localhost',
				port: 6379,
			};

			factory.createPubSub(config);

			// Start the health check and advance timers to trigger timeout
			const statusPromise = factory.getHealthStatus();
			await vi.advanceTimersByTimeAsync(10000); // Advance past the 5s timeout
			const status = await statusPromise;

			vi.useRealTimers();

			expect(status.publisher).toBe(false);
			expect(status.subscriber).toBe(false);
		}, 15000);
	});

	describe('onModuleDestroy', () => {
		it('should cleanup all resources', async () => {
			const config: IRedisConfig = {
				host: 'localhost',
				port: 6379,
				healthCheck: { enabled: true, interval: 60000, timeout: 5000 },
			};

			factory.createPubSub(config);

			await factory.onModuleDestroy();

			expect(mockPubSubInstance.close).toHaveBeenCalled();
			expect(mockRedisInstance.quit).toHaveBeenCalledTimes(2); // publisher and subscriber
		});

		it('should handle errors during cleanup', async () => {
			const config: IRedisConfig = {
				host: 'localhost',
				port: 6379,
			};

			mockPubSubInstance.close.mockRejectedValue(new Error('Close failed'));

			factory.createPubSub(config);

			// Should not throw despite errors
			await expect(factory.onModuleDestroy()).resolves.not.toThrow();
		});
	});
});
