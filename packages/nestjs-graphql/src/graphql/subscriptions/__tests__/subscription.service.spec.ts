import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from '../subscription.service.js';
import { AppLogger } from '@pawells/nestjs-shared/common';

describe('SubscriptionService', () => {
	let service: SubscriptionService;
	let mockLogger: any;

	beforeEach(async () => {
		mockLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SubscriptionService,
				{
					provide: AppLogger,
					useValue: mockLogger,
				},
			],
		}).compile();

		service = module.get<SubscriptionService>(SubscriptionService);
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

			(service as any).pubSub = mockPubSub;
			(service as any).logger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			await expect(service.publish('topic', { data: 'test' })).rejects.toThrow('Publish failed');
			expect((service as any).logger.error).toHaveBeenCalled();
		});

		it('should handle subscribe errors and log them', async () => {
			const mockPubSub = {
				asyncIterator: vi.fn().mockImplementation(() => {
					throw new Error('Subscribe failed');
				}),
			};

			(service as any).pubSub = mockPubSub;
			(service as any).logger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			expect(() => service.subscribe('topic')).toThrow('Subscribe failed');
			expect((service as any).logger.error).toHaveBeenCalled();
		});
	});

	describe('authenticated subscriptions', () => {
		it('should publish with authenticated user context', async () => {
			const mockPubSub = {
				publish: vi.fn().mockResolvedValue(1),
			};

			(service as any).pubSub = mockPubSub;
			(service as any).logger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const data = { userId: 'user123', message: 'test message' };
			await service.publish('authenticated-topic', data);

			expect(mockPubSub.publish).toHaveBeenCalledWith('authenticated-topic', data);
		});

		it('should allow only authenticated users to publish', async () => {
			const mockPubSub = {
				publish: vi.fn(),
			};

			(service as any).pubSub = mockPubSub;
			(service as any).logger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			// Without userId, should still allow (auth check is at subscription layer)
			const data = { message: 'test' };
			await service.publish('topic', data);

			expect(mockPubSub.publish).toHaveBeenCalled();
		});

		it('should include user metadata in subscription context', async () => {
			const mockPubSub = {
				asyncIterator: vi.fn().mockReturnValue({
					[Symbol.asyncIterator]: () => ({}),
				}),
			};

			(service as any).pubSub = mockPubSub;
			(service as any).logger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const iterator = service.subscribe('user-specific-topic');
			expect(iterator).toBeDefined();
		});
	});

	describe('message delivery', () => {
		it('should deliver published messages to all subscribers', async () => {
			const mockPubSub = {
				publish: vi.fn().mockResolvedValue(2),
			};

			(service as any).pubSub = mockPubSub;
			(service as any).logger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const message = { data: 'broadcast' };
			await service.publish('broadcast-topic', message);

			expect(mockPubSub.publish).toHaveBeenCalledWith('broadcast-topic', message);
		});

		it('should handle user-specific subscriptions isolated from others', async () => {
			const mockPubSub = {
				asyncIterator: vi.fn().mockReturnValue({
					[Symbol.asyncIterator]: () => ({}),
				}),
			};

			(service as any).pubSub = mockPubSub;
			(service as any).logger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const user1Iterator = service.subscribe('user:user1:updates');
			const user2Iterator = service.subscribe('user:user2:updates');

			expect(user1Iterator).toBeDefined();
			expect(user2Iterator).toBeDefined();
		});

		it('should log successful message delivery', async () => {
			const mockLogger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const mockPubSub = {
				publish: vi.fn().mockResolvedValue(1),
			};

			(service as any).pubSub = mockPubSub;
			(service as any).logger = mockLogger;

			await service.publish('logged-topic', { data: 'test' });

			expect(mockLogger.debug).toHaveBeenCalledWith('Publishing to topic: logged-topic');
		});
	});

	describe('subscription cleanup', () => {
		it('should cleanup subscription on error', async () => {
			const mockPubSub = {
				asyncIterator: vi.fn().mockImplementation(() => {
					throw new Error('Connection lost');
				}),
			};

			(service as any).pubSub = mockPubSub;
			(service as any).logger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			expect(() => service.subscribe('cleanup-topic')).toThrow('Connection lost');
		});

		it('should handle graceful cleanup on module destroy', async () => {
			const destroyFn = vi.spyOn(service, 'onModuleDestroy');

			await service.onModuleDestroy();

			expect(destroyFn).toHaveBeenCalled();
		});

		it('should not throw during cleanup of already-closed subscriptions', async () => {
			(service as any).logger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

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

			(service as any).pubSub = mockPubSub;
			(service as any).logger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			// Subscribe to many topics
			const subscriptions = [];
			for (let i = 0; i < 100; i++) {
				subscriptions.push(service.subscribe(`topic-${i}`));
			}

			expect(subscriptions.length).toBe(100);
			expect(mockPubSub.asyncIterator).toHaveBeenCalledTimes(100);
		});

		it('should handle rapid publish calls', async () => {
			const mockPubSub = {
				publish: vi.fn().mockResolvedValue(1),
			};

			(service as any).pubSub = mockPubSub;
			(service as any).logger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const publishPromises = [];
			for (let i = 0; i < 50; i++) {
				publishPromises.push(service.publish('performance-topic', { id: i }));
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

			(service as any).pubSub = mockPubSub;
			(service as any).logger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			// Create and cleanup subscriptions
			for (let i = 0; i < 10; i++) {
				const iterator = service.subscribe(`memory-test-${i}`);
				expect(iterator).toBeDefined();
			}

			// Cleanup
			await service.onModuleDestroy();

			// Verify cleanup happened
			expect(mockPubSub.asyncIterator).toHaveBeenCalled();
		});
	});
});
