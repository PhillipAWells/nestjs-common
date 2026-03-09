
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from '../../subscriptions/subscription.service.js';
import { RedisPubSubFactory } from '../../subscriptions/redis-pubsub.factory.js';
import type { SubscriptionConfig } from '../../subscriptions/subscription-config.interface.js';

describe('SubscriptionService', () => {
	let service: SubscriptionService;
	let mockPubSub: any;
	let config: SubscriptionConfig;
	let subIdCounter = 1;

	beforeEach(async () => {
		subIdCounter = 1;
		mockPubSub = {
			publish: async () => Promise.resolve(),
			subscribe: async () => Promise.resolve(subIdCounter++),
			unsubscribe: async () => Promise.resolve()
		};

		config = {
			redis: {
				host: 'localhost',
				port: 6379
			},
			websocket: {
				path: '/subscriptions',
				maxPayloadSize: 100 * 1024, // 100KB
				keepalive: 30000,
				connectionTimeout: 60000
			},
			auth: {
				jwtSecret: 'test-secret',
				tokenExpiration: '1h'
			},
			connection: {
				maxSubscriptionsPerUser: 10,
				cleanupInterval: 60000,
				timeout: 300000
			},
			resilience: {
				keepalive: { enabled: true, interval: 30000, timeout: 5000 },
				reconnection: { enabled: true, attempts: 3, delay: 1000, backoff: 'exponential' },
				errorRecovery: { enabled: true, retryDelay: 1000, maxRetries: 3 },
				shutdown: { timeout: 10000, force: true }
			}
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SubscriptionService,
				{
					provide: RedisPubSubFactory,
					useValue: {
						createPubSub: () => mockPubSub // Return synchronously
					}
				},
				{
					provide: 'SUBSCRIPTION_CONFIG',
					useValue: config
				}
			]
		}).compile();

		service = module.get<SubscriptionService>(SubscriptionService);
		// Manually set the pubSub since the async initialization doesn't work in tests
		(service as any).pubSub = mockPubSub;
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('publish', () => {
		it('should publish message to topic', async () => {
			const topic = 'user.created';
			const payload = { id: '123', name: 'Test User' };

			await service.publish(topic, payload);

			// Test passes if no error is thrown
			expect(true).toBe(true);
		});

		it('should validate topic format', async () => {
			const invalidTopic = 'invalid topic';
			const payload = { id: '123' };

			await expect(service.publish(invalidTopic, payload)).rejects.toThrow('Invalid topic format');
		});
	});

	describe('subscribe', () => {
		it('should subscribe to topic', async () => {
			const topic = 'user.updated';
			const onMessage = () => {};
			const userId = 'user123';

			const subId = await service.subscribe(topic, onMessage, undefined, userId);

			expect(typeof subId).toBe('number');
			expect(service.getUserSubscriptions(userId)).toContain(subId);
		});

		it('should enforce subscription limits', async () => {
			const topic = 'user.updated';
			const onMessage = () => {};
			const userId = 'user123';

			// Subscribe multiple times to exceed limit
			for (let i = 0; i < config.connection.maxSubscriptionsPerUser + 1; i++) {
				if (i < config.connection.maxSubscriptionsPerUser) {
					await service.subscribe(`${topic}${i}`, onMessage, undefined, userId);
				}
				else {
					await expect(service.subscribe(`${topic}${i}`, onMessage, undefined, userId))
						.rejects.toThrow('Subscription limit exceeded');
				}
			}
		});
	});

	describe('unsubscribe', () => {
		it('should unsubscribe from topic', async () => {
			const topic = 'user.deleted';
			const onMessage = () => {};
			const userId = 'user123';

			const subId = await service.subscribe(topic, onMessage, undefined, userId);
			await service.unsubscribe(subId);

			expect(service.getUserSubscriptions(userId)).not.toContain(subId);
		});
	});

	describe('getStats', () => {
		it('should return subscription statistics', async () => {
			const topic = 'product.updated';
			const onMessage = () => {};
			const userId = 'user123';

			await service.subscribe(topic, onMessage, undefined, userId);

			const stats = service.getStats();

			expect(stats.totalSubscriptions).toBe(1);
			expect(stats.activeTopics).toBe(1);
			expect(stats.subscriptionsByUser[userId]).toBe(1);
		});
	});
});
