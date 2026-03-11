import { Injectable, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';
import { AppLogger } from '@pawells/nestjs-shared/common';

/**
 * Service for managing GraphQL subscriptions with Redis PubSub
 */
@Injectable()
export class SubscriptionService implements OnModuleDestroy {
	private readonly logger: AppLogger;

	constructor(
		appLogger: AppLogger,
		@Optional() @Inject('GRAPHQL_PUBSUB') private readonly pubSub?: any,
	) {
		this.logger = appLogger.createContextualLogger(SubscriptionService.name);
	}

	/**
	 * Publish an event to a topic
	 * @param topic Topic to publish to
	 * @param data Data to publish
	 * @throws Error if publish fails
	 */
	public async publish(topic: string, data: any): Promise<void> {
		try {
			this.logger.debug(`Publishing to topic: ${topic}`);
			if (!this.pubSub) {
				throw new Error('PubSub instance not configured');
			}
			await this.pubSub.publish(topic, data);
		} catch (error) {
			this.logger.error(
				`Failed to publish to topic ${topic}: ${(error as Error).message}`,
				(error as Error).stack,
			);
			throw error;
		}
	}

	/**
	 * Subscribe to a topic
	 * @param topic Topic to subscribe to
	 * @returns AsyncIterator for the topic
	 * @throws Error if subscribe fails
	 */
	public subscribe(topic: string): AsyncIterator<any> {
		try {
			this.logger.debug(`Subscribing to topic: ${topic}`);
			if (!this.pubSub) {
				throw new Error('PubSub instance not configured');
			}
			return this.pubSub.asyncIterator(topic);
		} catch (error) {
			this.logger.error(
				`Failed to subscribe to topic ${topic}: ${(error as Error).message}`,
				(error as Error).stack,
			);
			throw error;
		}
	}

	@ProfileMethod({ tags: { operation: 'subscription', lifecycle: 'destroy' } })
	public onModuleDestroy(): void {
		// Cleanup logic for subscriptions if needed
	}
}
