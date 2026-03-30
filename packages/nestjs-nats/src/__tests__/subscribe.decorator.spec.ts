import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { Subscribe, type INatsSubscribeOptions } from '../decorators/subscribe.decorator.js';
import { NATS_SUBSCRIBE_METADATA } from '../nats.constants.js';

describe('Subscribe decorator', () => {
	const reflector = new Reflector();

	it('should set subject metadata on the decorated method', () => {
		class TestClass {
			@Subscribe('orders.created')
			public handler(): void { /* no-op */ }
		}

		const meta = reflector.get<INatsSubscribeOptions>(
			NATS_SUBSCRIBE_METADATA,
			TestClass.prototype.handler,
		);
		expect(meta).toEqual({ subject: 'orders.created', queue: undefined });
	});

	it('should set subject and queue metadata on the decorated method', () => {
		class TestClass {
			@Subscribe('tasks.process', 'worker-pool')
			public handler(): void { /* no-op */ }
		}

		const meta = reflector.get<INatsSubscribeOptions>(
			NATS_SUBSCRIBE_METADATA,
			TestClass.prototype.handler,
		);
		expect(meta).toEqual({ subject: 'tasks.process', queue: 'worker-pool' });
	});

	it('should return undefined for methods without the decorator', () => {
		class TestClass {
			public handler(): void { /* no-op */ }
		}

		const meta = reflector.get<INatsSubscribeOptions | undefined>(
			NATS_SUBSCRIBE_METADATA,
			TestClass.prototype.handler,
		);
		expect(meta).toBeUndefined();
	});

	it('should support wildcard subjects', () => {
		class TestClass {
			@Subscribe('events.>')
			public handler(): void { /* no-op */ }
		}

		const meta = reflector.get<INatsSubscribeOptions>(
			NATS_SUBSCRIBE_METADATA,
			TestClass.prototype.handler,
		);
		expect(meta.subject).toBe('events.>');
	});
});
