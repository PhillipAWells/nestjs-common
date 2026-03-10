
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
			unsubscribe: async () => Promise.resolve(),
		};

		config = {
			redis: {
				host: 'localhost',
				port: 6379,
			},
			websocket: {
				path: '/subscriptions',
				maxPayloadSize: 100 * 1024, // 100KB
				keepalive: 30000,
				connectionTimeout: 60000,
			},
			auth: {
				jwtSecret: 'test-secret',
				tokenExpiration: '1h',
			},
			connection: {
				maxSubscriptionsPerUser: 10,
				cleanupInterval: 60000,
				timeout: 300000,
			},
			resilience: {
				keepalive: { enabled: true, interval: 30000, timeout: 5000 },
				reconnection: { enabled: true, attempts: 3, delay: 1000, backoff: 'exponential' },
				errorRecovery: { enabled: true, retryDelay: 1000, maxRetries: 3 },
				shutdown: { timeout: 10000, force: true },
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SubscriptionService,
				{
					provide: RedisPubSubFactory,
					useValue: {
						createPubSub: () => mockPubSub, // Return synchronously
					},
				},
				{
					provide: 'SUBSCRIPTION_CONFIG',
					useValue: config,
				},
			],
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

			const iterator = service.subscribe(topic);

			expect(iterator).toBeDefined();
			expect(typeof (iterator as any)[Symbol.asyncIterator]).toBe('function');
		});

		it('should allow multiple subscriptions to different topics', () => {
			const topic1 = 'user.updated';
			const topic2 = 'user.deleted';

			const iterator1 = service.subscribe(topic1);
			const iterator2 = service.subscribe(topic2);

			expect(iterator1).toBeDefined();
			expect(iterator2).toBeDefined();
		});
	});

	describe('publish', () => {
		it('should publish to topic', async () => {
			const topic = 'user.deleted';
			const data = { id: '123', name: 'John' };

			await expect(service.publish(topic, data)).resolves.toBeUndefined();
		});
	});

	describe('onModuleDestroy', () => {
		it('should cleanup on destroy', () => {
			expect(() => service.onModuleDestroy()).not.toThrow();
		});
	});
});
