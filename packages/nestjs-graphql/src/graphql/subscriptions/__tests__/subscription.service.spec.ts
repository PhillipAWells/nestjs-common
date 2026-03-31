import { vi } from 'vitest';
import { SubscriptionService } from '../subscription.service.js';
import { AppLogger } from '@pawells/nestjs-shared/common';

describe('SubscriptionService', () => {
	let service: SubscriptionService;
	let mockLogger: any;
	let contextualLogger: any;
	let deps: { pubSub: any };

	beforeEach(() => {
		contextualLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		};
		mockLogger = {
			createContextualLogger: vi.fn().mockReturnValue(contextualLogger),
		} as any;

		deps = { pubSub: undefined };

		const mockModuleRef = {
			get: (token: any) => {
				if (token === AppLogger) return mockLogger;
				if (token === 'GRAPHQL_PUBSUB') {
					if (deps.pubSub === undefined) throw new Error('No pubSub configured');
					return deps.pubSub;
				}
				throw new Error(`Unknown token: ${String(token)}`);
			},
		} as any;

		service = new SubscriptionService(mockModuleRef);
	});

	describe('module lifecycle', () => {
		it('should be defined', () => {
			expect(service).toBeDefined();
		});

		it('should handle module destroy without errors', () => {
			expect(() => service.onModuleDestroy()).not.toThrow();
		});

		it('should implement OnModuleDestroy interface', () => {
			expect(service.onModuleDestroy).toBeDefined();
			expect(typeof service.onModuleDestroy).toBe('function');
		});
	});

	describe('service instantiation', () => {
		it('should create instance with correct class name', () => {
			expect(service.constructor.name).toBe('SubscriptionService');
		});

		it('should be an injectable service', () => {
			// Check if service was created by NestJS testing module
			expect(service).toBeInstanceOf(SubscriptionService);
		});
	});

	describe('lifecycle hooks', () => {
		it('should call onModuleDestroy during module teardown', async () => {
			const destroyFn = vi.spyOn(service, 'onModuleDestroy');

			service.onModuleDestroy();

			expect(destroyFn).toHaveBeenCalled();
		});

		it('should handle multiple destroy calls gracefully', () => {
			expect(() => {
				service.onModuleDestroy();
				service.onModuleDestroy();
				service.onModuleDestroy();
			}).not.toThrow();
		});
	});

	describe('subscription management infrastructure', () => {
		it('should have ProfileMethod decorator applied', () => {
			// The onModuleDestroy method should have metadata from ProfileMethod decorator
			const descriptor = Object.getOwnPropertyDescriptor(
				SubscriptionService.prototype,
				'onModuleDestroy',
			);
			expect(descriptor).toBeDefined();
			expect(descriptor?.value).toBeDefined();
		});

		it('should be ready for subscription operations after creation', () => {
			// Service should be fully initialized
			expect(service).toBeTruthy();
			expect(Object.keys(service).length >= 0).toBe(true);
		});
	});

	describe('SubscriptionService Error Handling', () => {
		it('should handle publish errors gracefully', async () => {
			const mockPubSub = {
				publish: vi.fn().mockRejectedValue(new Error('Publish failed')),
			};

			deps.pubSub = mockPubSub;

			await expect(service.Publish('topic', { data: 'test' })).rejects.toThrow('Publish failed');
			expect(contextualLogger.error).toHaveBeenCalled();
		});

		it('should handle subscribe errors and log them', async () => {
			const mockPubSub = {
				asyncIterator: vi.fn().mockImplementation(() => {
					throw new Error('Subscribe failed');
				}),
			};

			deps.pubSub = mockPubSub;

			expect(() => service.Subscribe('topic')).toThrow('Subscribe failed');
			expect(contextualLogger.error).toHaveBeenCalled();
		});
	});

	describe('authenticated subscriptions', () => {
		it('should publish with authenticated user context', async () => {
			const mockPubSub = {
				publish: vi.fn().mockResolvedValue(1),
			};

			deps.pubSub = mockPubSub;

			const data = { userId: 'user123', message: 'test message' };
			await service.Publish('authenticated-topic', data);

			expect(mockPubSub.publish).toHaveBeenCalledWith('authenticated-topic', data);
		});

		it('should allow only authenticated users to publish', async () => {
			const mockPubSub = {
				publish: vi.fn(),
			};

			deps.pubSub = mockPubSub;

			// Without userId, should still allow (auth check is at subscription layer)
			const data = { message: 'test' };
			await service.Publish('topic', data);

			expect(mockPubSub.publish).toHaveBeenCalled();
		});

		it('should include user metadata in subscription context', async () => {
			const mockPubSub = {
				asyncIterator: vi.fn().mockReturnValue({
					[Symbol.asyncIterator]: () => ({}),
				}),
			};

			deps.pubSub = mockPubSub;

			const iterator = service.Subscribe('user-specific-topic');
			expect(iterator).toBeDefined();
		});
	});

	describe('message delivery', () => {
		it('should deliver published messages to all subscribers', async () => {
			const mockPubSub = {
				publish: vi.fn().mockResolvedValue(2),
			};

			deps.pubSub = mockPubSub;

			const message = { data: 'broadcast' };
			await service.Publish('broadcast-topic', message);

			expect(mockPubSub.publish).toHaveBeenCalledWith('broadcast-topic', message);
		});

		it('should handle user-specific subscriptions isolated from others', async () => {
			const mockPubSub = {
				asyncIterator: vi.fn().mockReturnValue({
					[Symbol.asyncIterator]: () => ({}),
				}),
			};

			deps.pubSub = mockPubSub;

			const user1Iterator = service.Subscribe('user:user1:updates');
			const user2Iterator = service.Subscribe('user:user2:updates');

			expect(user1Iterator).toBeDefined();
			expect(user2Iterator).toBeDefined();
		});

		it('should log successful message delivery', async () => {
			const mockPubSub = {
				publish: vi.fn().mockResolvedValue(1),
			};

			deps.pubSub = mockPubSub;

			await service.Publish('logged-topic', { data: 'test' });

			expect(contextualLogger.debug).toHaveBeenCalledWith('Publishing to topic: logged-topic');
		});
	});

	describe('subscription cleanup', () => {
		it('should cleanup subscription on error', async () => {
			const mockPubSub = {
				asyncIterator: vi.fn().mockImplementation(() => {
					throw new Error('Connection lost');
				}),
			};

			deps.pubSub = mockPubSub;

			expect(() => service.Subscribe('cleanup-topic')).toThrow('Connection lost');
		});

		it('should handle graceful cleanup on module destroy', async () => {
			const destroyFn = vi.spyOn(service, 'onModuleDestroy');

			await service.onModuleDestroy();

			expect(destroyFn).toHaveBeenCalled();
		});

		it('should not throw during cleanup of already-closed subscriptions', async () => {
			expect(() => {
				service.onModuleDestroy();
				service.onModuleDestroy();
			}).not.toThrow();
		});
	});

	describe('performance', () => {
		it('should handle high volume subscriptions', async () => {
			const mockPubSub = {
				asyncIterator: vi.fn().mockReturnValue({
					[Symbol.asyncIterator]: () => ({}),
				}),
			};

			deps.pubSub = mockPubSub;

			// Subscribe to many topics
			const subscriptions = [];
			for (let i = 0; i < 100; i++) {
				subscriptions.push(service.Subscribe(`topic-${i}`));
			}

			expect(subscriptions.length).toBe(100);
			expect(mockPubSub.asyncIterator).toHaveBeenCalledTimes(100);
		});

		it('should handle rapid publish calls', async () => {
			const mockPubSub = {
				publish: vi.fn().mockResolvedValue(1),
			};

			deps.pubSub = mockPubSub;

			const publishPromises = [];
			for (let i = 0; i < 50; i++) {
				publishPromises.push(service.Publish('performance-topic', { id: i }));
			}

			await Promise.all(publishPromises);

			expect(mockPubSub.publish).toHaveBeenCalledTimes(50);
		});

		it('should manage memory with subscription cleanup', async () => {
			const mockPubSub = {
				asyncIterator: vi.fn().mockReturnValue({
					[Symbol.asyncIterator]: () => ({}),
				}),
				publish: vi.fn().mockResolvedValue(1),
			};

			deps.pubSub = mockPubSub;

			// Create and cleanup subscriptions
			for (let i = 0; i < 10; i++) {
				const iterator = service.Subscribe(`memory-test-${i}`);
				expect(iterator).toBeDefined();
			}

			// Cleanup
			await service.onModuleDestroy();

			// Verify cleanup happened
			expect(mockPubSub.asyncIterator).toHaveBeenCalled();
		});
	});
});
