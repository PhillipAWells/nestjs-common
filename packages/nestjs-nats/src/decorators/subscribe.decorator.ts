import { SetMetadata } from '@nestjs/common';
import { NATS_SUBSCRIBE_METADATA } from '../nats.constants.js';

/** Options carried by the @Subscribe decorator. */
export interface NatsSubscribeOptions {
	/** The NATS subject to subscribe to. Supports wildcards (* and >). */
	subject: string;
	/** Optional queue group name for load-balanced message delivery. */
	queue?: string;
}

/**
 * Method decorator that registers a handler for a NATS subject.
 * The handler is discovered and registered automatically by NatsSubscriberRegistry.
 *
 * @param subject - NATS subject to subscribe to (e.g. 'orders.created', 'events.>')
 * @param queue - Optional queue group name for load-balanced delivery across instances
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class OrderHandler {
 *   @Subscribe('orders.created')
 *   async onOrderCreated(msg: Msg): Promise<void> {
 *     const order = msg.json<Order>();
 *     // handle order...
 *   }
 *
 *   @Subscribe('tasks.process', 'worker-pool')
 *   async processTask(msg: Msg): Promise<void> { ... }
 * }
 * ```
 */
export const Subscribe = (subject: string, queue?: string): MethodDecorator =>
	SetMetadata<typeof NATS_SUBSCRIBE_METADATA, NatsSubscribeOptions>(
		NATS_SUBSCRIBE_METADATA,
		{ subject, queue },
	);
