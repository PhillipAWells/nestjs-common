import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage, getErrorStack } from '@pawells/nestjs-shared/common';

/**
 * Service for managing GraphQL subscriptions with Redis PubSub
 */
@Injectable()
export class SubscriptionService implements OnModuleDestroy, LazyModuleRefService {
	public readonly Module: ModuleRef;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get logger(): AppLogger {
		return this.AppLogger.createContextualLogger(SubscriptionService.name);
	}

	private get pubSub(): any | undefined {
		try {
			return this.Module.get('GRAPHQL_PUBSUB', { strict: false });
		} catch {
			return undefined;
		}
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
	 * Publish an event to a topic
	 * @param topic Topic to publish to
	 * @param data Data to publish
	 * @throws Error if publish fails
	 */
	public async publish(topic: string, data: any): Promise<void> {
		try {
			// Validate topic format: must contain only word characters, dots, hyphens, and underscores
			if (!/^[\w.-]+$/.test(topic)) {
				throw new Error('Invalid topic format');
			}
			this.logger.debug(`Publishing to topic: ${topic}`);
			if (!this.pubSub) {
				throw new Error('PubSub instance not configured');
			}
			await this.pubSub.publish(topic, data);
		} catch (error) {
			this.logger.error(
				`Failed to publish to topic ${topic}: ${getErrorMessage(error)}`,
				getErrorStack(error),
			);
			throw error;
		}
	}

	/**
	 * Subscribe to a topic
	 * @param topic Topic to subscribe to
	 * @returns AsyncIterable for the topic
	 * @throws Error if subscribe fails
	 */
	public subscribe(topic: string): AsyncIterable<unknown> {
		try {
			this.logger.debug(`Subscribing to topic: ${topic}`);
			if (!this.pubSub) {
				throw new Error('PubSub instance not configured');
			}
			const iterator = this.pubSub.asyncIterator(topic);
			// Ensure the returned object implements Symbol.asyncIterator
			if (!iterator[Symbol.asyncIterator]) {
				return {
					[Symbol.asyncIterator](): AsyncIterator<unknown> {
						return iterator;
					},
				};
			}
			return iterator;
		} catch (error) {
			this.logger.error(
				`Failed to subscribe to topic ${topic}: ${getErrorMessage(error)}`,
				getErrorStack(error),
			);
			throw error;
		}
	}

	@ProfileMethod({ tags: { operation: 'subscription', lifecycle: 'destroy' } })
	public onModuleDestroy(): void {
		// Cleanup logic for subscriptions if needed
	}
}
