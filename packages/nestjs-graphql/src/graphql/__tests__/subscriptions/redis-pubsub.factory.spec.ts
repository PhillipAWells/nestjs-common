
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisPubSubFactory } from '../../subscriptions/redis-pubsub.factory.js';
import { RedisConfig } from '../../subscriptions/subscription-config.interface.js';

describe('RedisPubSubFactory', () => {
	let factory: RedisPubSubFactory;
	let mockRedis: any;

	beforeEach(async () => {
		mockRedis = {
			on: jest.fn(),
			ping: jest.fn(),
			quit: jest.fn()
		};

		// Mock the Redis constructor
		const mockRedisConstructor = jest.fn().mockReturnValue(mockRedis);
		(global as any).Redis = mockRedisConstructor;

		const module: TestingModule = await Test.createTestingModule({
			providers: [RedisPubSubFactory]
		}).compile();

		factory = module.get<RedisPubSubFactory>(RedisPubSubFactory);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('createPubSub', () => {
		it('should create a Redis PubSub instance with basic config', () => {
			const config: RedisConfig = {
				host: 'localhost',
				port: 6379
			};

			const pubSub = factory.createPubSub(config);

			expect(pubSub).toBeDefined();
			expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
			expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
			expect(mockRedis.on).toHaveBeenCalledWith('ready', expect.any(Function));
			expect(mockRedis.on).toHaveBeenCalledWith('end', expect.any(Function));
		});

		it('should create Redis clients with full configuration', () => {
			const config: RedisConfig = {
				host: 'redis.example.com',
				port: 6380,
				password: 'secret',
				db: 1,
				connectTimeout: 30000,
				tls: { ca: 'ca-cert' }
			};

			factory.createPubSub(config);

			expect((global as any).Redis).toHaveBeenCalledWith({
				host: 'redis.example.com',
				port: 6380,
				password: 'secret',
				db: 1,
				connectTimeout: 30000,
				tls: { ca: 'ca-cert' }
			});
		});

		it('should start health checks when enabled', () => {
			const config: RedisConfig = {
				host: 'localhost',
				port: 6379,
				healthCheck: {
					enabled: true,
					interval: 60000
				}
			};

			factory.createPubSub(config);

			// Health check interval should be set
			expect((factory as any).healthCheckInterval).toBeDefined();
		});

		it('should not start health checks when disabled', () => {
			const config: RedisConfig = {
				host: 'localhost',
				port: 6379,
				healthCheck: {
					enabled: false
				}
			};

			factory.createPubSub(config);

			expect((factory as any).healthCheckInterval).toBeUndefined();
		});
	});

	describe('getHealthStatus', () => {
		beforeEach(() => {
			mockRedis.ping.mockImplementation((callback: Function) => {
				callback(null, 'PONG');
			});
		});

		it('should return healthy status when clients are connected', async () => {
			const config: RedisConfig = {
				host: 'localhost',
				port: 6379
			};

			factory.createPubSub(config);

			const status = await factory.getHealthStatus();

			expect(status.publisher).toBe(true);
			expect(status.subscriber).toBe(true);
			expect(status.pubSubInstances).toBe(1);
		});

		it('should return unhealthy status when ping fails', async () => {
			mockRedis.ping.mockImplementation((callback: Function) => {
				callback(new Error('Connection failed'), null);
			});

			const config: RedisConfig = {
				host: 'localhost',
				port: 6379
			};

			factory.createPubSub(config);

			const status = await factory.getHealthStatus();

			expect(status.publisher).toBe(false);
			expect(status.subscriber).toBe(false);
			expect(status.pubSubInstances).toBe(1);
		});

		it('should handle ping timeout', async () => {
			mockRedis.ping.mockImplementation(() => {
				// Don't call callback to simulate timeout
			});

			const config: RedisConfig = {
				host: 'localhost',
				port: 6379
			};

			factory.createPubSub(config);

			const status = await factory.getHealthStatus();

			expect(status.publisher).toBe(false);
			expect(status.subscriber).toBe(false);
		});
	});

	describe('onModuleDestroy', () => {
		it('should cleanup all resources', async () => {
			const config: RedisConfig = {
				host: 'localhost',
				port: 6379,
				healthCheck: { enabled: true }
			};

			const mockPubSub = {
				close: jest.fn().mockResolvedValue(undefined)
			};

			// Mock RedisPubSub constructor
			const mockRedisPubSubConstructor = jest.fn().mockReturnValue(mockPubSub);
			(global as any).RedisPubSub = mockRedisPubSubConstructor;

			factory.createPubSub(config);

			await factory.onModuleDestroy();

			expect(mockPubSub.close).toHaveBeenCalled();
			expect(mockRedis.quit).toHaveBeenCalledTimes(2); // publisher and subscriber
		});

		it('should handle errors during cleanup', async () => {
			const config: RedisConfig = {
				host: 'localhost',
				port: 6379
			};

			const mockPubSub = {
				close: jest.fn().mockRejectedValue(new Error('Close failed'))
			};

			const mockRedisPubSubConstructor = jest.fn().mockReturnValue(mockPubSub);
			(global as any).RedisPubSub = mockRedisPubSubConstructor;

			factory.createPubSub(config);

			// Should not throw despite errors
			await expect(factory.onModuleDestroy()).resolves.not.toThrow();
		});
	});
});
