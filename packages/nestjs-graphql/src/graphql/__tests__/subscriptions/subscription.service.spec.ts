
import { vi } from 'vitest';
import { SubscriptionService } from '../../subscriptions/subscription.service.js';
import { AppLogger } from '@pawells/nestjs-shared/common';

describe('SubscriptionService', () => {
	let service: SubscriptionService;
	let mockPubSub: any;
	let subIdCounter = 1;

	beforeEach(() => {
		subIdCounter = 1;
		mockPubSub = {
			publish: async () => Promise.resolve(),
			subscribe: async () => Promise.resolve(subIdCounter++),
			unsubscribe: async () => Promise.resolve(),
			asyncIterator: (topic: string) => {
				const iterator = {
					[Symbol.asyncIterator]() {
						return this;
					},
					next: async () => ({ value: { [topic]: {} }, done: false }),
					return: async () => ({ value: undefined, done: true }),
					throw: async (err: any) => Promise.reject(err),
				};
				return iterator;
			},
		};

		const mockLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}),
		};

		const mockModuleRef = {
			get: (token: any) => {
				if (token === AppLogger) return mockLogger;
				if (token === 'GRAPHQL_PUBSUB') return mockPubSub;
				throw new Error(`Unknown token: ${String(token)}`);
			},
		} as any;

		service = new SubscriptionService(mockModuleRef);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('publish', () => {
		it('should publish message to topic', async () => {
			const topic = 'user.created';
			const payload = { id: '123', name: 'Test IUser' };

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
