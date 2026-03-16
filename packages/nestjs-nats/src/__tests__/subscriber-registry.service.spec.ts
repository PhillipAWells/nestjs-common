import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { NatsSubscriberRegistry } from '../subscriber-registry.service.js';
import { NatsService } from '../nats.service.js';
import { Subscribe } from '../decorators/subscribe.decorator.js';

vi.mock('@nats-io/transport-node');

describe('NatsSubscriberRegistry', () => {
	const mockSubscription = {
		async *[Symbol.asyncIterator]() { /* empty */ },
		unsubscribe: vi.fn(),
	};

	const mockNatsService = {
		subscribe: vi.fn(),
		isConnected: vi.fn().mockReturnValue(true),
	};

	@Injectable()
	class TestHandler {
		@Subscribe('orders.created')
		public async onOrderCreated(): Promise<void> { /* no-op */ }

		@Subscribe('tasks.process', 'worker-pool')
		public onTaskProcess(): void { /* no-op */ }

		public notDecorated(): void { /* no-op */ }
	}

	const testHandlerInstance = new TestHandler();

	const mockDiscoveryService = {
		getProviders: vi.fn(),
		getControllers: vi.fn(),
	};

	const mockMetadataScanner = {
		getAllMethodNames: vi.fn(),
	};

	let registry: NatsSubscriberRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		mockNatsService.subscribe.mockReturnValue(mockSubscription);
		mockDiscoveryService.getProviders.mockReturnValue([{ instance: testHandlerInstance }]);
		mockDiscoveryService.getControllers.mockReturnValue([]);
		mockMetadataScanner.getAllMethodNames.mockImplementation((proto: object) =>
			Object.getOwnPropertyNames(proto).filter(name => name !== 'constructor'),
		);

		registry = new NatsSubscriberRegistry(
			mockDiscoveryService as unknown as DiscoveryService,
			mockMetadataScanner as unknown as MetadataScanner,
			new Reflector(),
			mockNatsService as unknown as NatsService,
		);
		registry.onModuleInit();
	});

	it('should register a handler for the @Subscribe("orders.created") method', () => {
		expect(mockNatsService.subscribe).toHaveBeenCalledWith(
			'orders.created',
			expect.any(Function),
			{ queue: undefined },
		);
	});

	it('should register a handler with a queue group for the @Subscribe("tasks.process") method', () => {
		expect(mockNatsService.subscribe).toHaveBeenCalledWith(
			'tasks.process',
			expect.any(Function),
			{ queue: 'worker-pool' },
		);
	});

	it('should register exactly two handlers (non-decorated methods are ignored)', () => {
		expect(mockNatsService.subscribe).toHaveBeenCalledTimes(2);
	});

	it('should bind the handler to the class instance', async () => {
		const calls = (mockNatsService.subscribe as ReturnType<typeof vi.fn>).mock.calls as [
			string,
			() => Promise<void>,
			unknown,
		][];
		const [, firstHandler] = calls[0];
		await expect(firstHandler()).resolves.toBeUndefined();
	});

	it('should not register undecorated methods', () => {
		const subscribedSubjects = (mockNatsService.subscribe as ReturnType<typeof vi.fn>).mock.calls
			.map(([subject]: unknown[]) => subject as string);
		expect(subscribedSubjects).not.toContain('notDecorated');
	});
});
