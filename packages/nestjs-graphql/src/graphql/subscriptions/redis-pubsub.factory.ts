declare global {
	namespace NodeJS {
		interface Timeout {}
	}
}

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { Redis } from 'ioredis';
import { RedisConfig } from './subscription-config.interface.js';
import { REDIS_PUBSUB_RESPONSE_TIMEOUT, REDIS_PUBSUB_CLEANUP_INTERVAL, REDIS_PUBSUB_HEALTH_CHECK_TIMEOUT } from '../constants/subscriptions.constants.js';

/**
 * Factory for creating Redis PubSub instances with connection pooling and resilience
 */
@Injectable()
export class RedisPubSubFactory implements OnModuleDestroy {
	private readonly logger = new Logger(RedisPubSubFactory.name);

	private pubSubInstances: RedisPubSub[] = [];

	private readonly publisherClients: any[] = [];

	private readonly subscriberClients: any[] = [];

	// eslint-disable-next-line no-undef
	private healthCheckInterval?: NodeJS.Timeout;

	/**
   * Creates a Redis PubSub instance with the given configuration
   * @param config Redis configuration
   * @returns Configured RedisPubSub instance
   */
	public createPubSub(config: RedisConfig): RedisPubSub {
		this.logger.log('Creating Redis PubSub instance');

		// Create Redis clients with connection pooling
		const publisher = this.createRedisClient(config);
		const subscriber = this.createRedisClient(config);

		// Store clients for cleanup
		this.publisherClients.push(publisher);
		this.subscriberClients.push(subscriber);

		const pubSub = new RedisPubSub({
			publisher,
			subscriber,
		});

		this.pubSubInstances.push(pubSub);

		// Start health checks if enabled
		if (config.healthCheck?.enabled) {
			this.startHealthChecks(config);
		}

		this.logger.log('Redis PubSub instance created successfully');
		return pubSub;
	}

	/**
   * Creates a Redis client with the given configuration
   * @param config Redis configuration
   * @returns Redis client
   */
	private createRedisClient(config: RedisConfig): any {
		const options: any = {
			host: config.host,
			port: config.port,
			db: config.db ?? 0,
			connectTimeout: config.connectTimeout ?? REDIS_PUBSUB_RESPONSE_TIMEOUT,
		};

		if (config.password !== undefined) {
			options.password = config.password;
		}

		if (config.tls) {
			options.tls = config.tls;
		}

		const client = new Redis(options);

		// Event handlers
		client.on('connect', () => {
			this.logger.log(`Redis client connected to ${config.host}:${config.port}`);
		});

		client.on('error', (error: Error) => {
			this.logger.error(`Redis client error: ${error.message}`, error.stack);
		});

		client.on('ready', () => {
			this.logger.log('Redis client ready');
		});

		client.on('end', () => {
			this.logger.log('Redis client connection ended');
		});

		return client;
	}

	/**
   * Starts health checks for Redis connections
   * @param config Redis configuration
   */
	private startHealthChecks(config: RedisConfig): void {
		if (!config.healthCheck) return;

		this.healthCheckInterval = setInterval(() => {
			const checks: Promise<void>[] = [];

			for (const client of this.publisherClients) {
				checks.push(this.checkClientHealth(client, 'publisher'));
			}
			for (const client of this.subscriberClients) {
				checks.push(this.checkClientHealth(client, 'subscriber'));
			}

			Promise.all(checks).catch((error: unknown) => {
				const err = error as Error;
				this.logger.error(`Health check failed: ${err.message}`, err.stack);
			});
		}, config.healthCheck.interval ?? REDIS_PUBSUB_CLEANUP_INTERVAL);
	}

	/**
   * Checks the health of a Redis client
   * @param client Redis client
   * @param type Client type (publisher/subscriber)
   */
	// eslint-disable-next-line require-await
	private async checkClientHealth(client: any, type: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`${type} client health check timeout`));
			}, REDIS_PUBSUB_HEALTH_CHECK_TIMEOUT);

			client.ping((error: any, result: any) => {
				clearTimeout(timeout);
				if (error) {
					reject(error);
				} else if (result !== 'PONG') {
					reject(new Error(`${type} client ping returned: ${result}`));
				} else {
					resolve();
				}
			});
		});
	}

	/**
   * Performs health check on all Redis connections
   * @returns Promise resolving to health status
   */
	public async getHealthStatus(): Promise<{
		publisher: boolean;
		subscriber: boolean;
		pubSubInstances: number;
	}> {
		const status = {
			publisher: false,
			subscriber: false,
			pubSubInstances: this.pubSubInstances.length,
		};

		try {
			for (const client of this.publisherClients) {
				await this.checkClientHealth(client, 'publisher');
				status.publisher = true;
			}
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Publisher health check failed: ${err.message}`);
		}

		try {
			for (const client of this.subscriberClients) {
				await this.checkClientHealth(client, 'subscriber');
				status.subscriber = true;
			}
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Subscriber health check failed: ${err.message}`);
		}

		return status;
	}

	/**
   * Cleanup method called when module is destroyed
   */
	public async onModuleDestroy(): Promise<void> {
		this.logger.log('Destroying Redis PubSub factory');

		// Clear health check interval
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
		}

		// Close all PubSub instances
		for (const pubSub of this.pubSubInstances) {
			try {
				await pubSub.close();
			} catch (error) {
				const err = error as Error;
				this.logger.error(`Error closing PubSub instance: ${err.message}`, err.stack);
			}
		}

		this.pubSubInstances = [];

		// Close all Redis clients
		for (const client of this.publisherClients) {
			try {
				await client.quit();
			} catch (error) {
				const err = error as Error;
				this.logger.error(`Error closing publisher client: ${err.message}`, err.stack);
			}
		}
		for (const client of this.subscriberClients) {
			try {
				await client.quit();
			} catch (error) {
				const err = error as Error;
				this.logger.error(`Error closing subscriber client: ${err.message}`, err.stack);
			}
		}

		this.publisherClients.length = 0;
		this.subscriberClients.length = 0;

		this.logger.log('Redis PubSub factory destroyed');
	}
}
