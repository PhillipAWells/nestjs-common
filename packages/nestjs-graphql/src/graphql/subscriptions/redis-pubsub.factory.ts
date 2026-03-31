declare global {
	namespace NodeJS {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		interface Timeout {}
	}
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { Redis } from 'ioredis';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { IRedisConfig } from './subscription-config.interface.js';
import { REDIS_PUBSUB_RESPONSE_TIMEOUT, REDIS_PUBSUB_CLEANUP_INTERVAL, REDIS_PUBSUB_HEALTH_CHECK_TIMEOUT } from '../constants/subscriptions.constants.js';

/**
 * Factory for creating Redis PubSub instances with connection pooling and resilience
 */
@Injectable()
export class RedisPubSubFactory implements OnModuleDestroy {
	private readonly Logger: AppLogger;

	private PubSubInstances: RedisPubSub[] = [];

	private readonly PublisherClients: any[] = [];

	private readonly SubscriberClients: any[] = [];

	// eslint-disable-next-line no-undef
	private HealthCheckInterval?: NodeJS.Timeout;

	constructor() {
		this.Logger = new AppLogger(undefined, RedisPubSubFactory.name);
	}

	/**
   * Creates a Redis PubSub instance with the given configuration
   * @param config Redis configuration
   * @returns Configured RedisPubSub instance
   */
	public CreatePubSub(config: IRedisConfig): RedisPubSub {
		this.Logger.info('Creating Redis PubSub instance');

		// Create Redis clients with connection pooling
		const Publisher = this.CreateRedisClient(config);
		const Subscriber = this.CreateRedisClient(config);

		// Store clients for cleanup
		this.PublisherClients.push(Publisher);
		this.SubscriberClients.push(Subscriber);

		const PubSub = new RedisPubSub({
			publisher: Publisher,
			subscriber: Subscriber,
		});

		this.PubSubInstances.push(PubSub);

		// Start health checks if enabled
		if (config.healthCheck?.enabled) {
			this.StartHealthChecks(config);
		}

		this.Logger.info('Redis PubSub instance created successfully');
		return PubSub;
	}

	/**
   * Creates a Redis client with the given configuration
   * @param config Redis configuration
   * @returns Redis client
   */
	private CreateRedisClient(config: IRedisConfig): any {
		const Options: any = {
			host: config.host,
			port: config.port,
			db: config.db ?? 0,
			connectTimeout: config.connectTimeout ?? REDIS_PUBSUB_RESPONSE_TIMEOUT,
		};

		if (config.password !== undefined) {
			Options.password = config.password;
		}

		if (config.tls) {
			Options.tls = config.tls;
		}

		const Client = new Redis(Options);

		// Event handlers
		Client.on('connect', () => {
			this.Logger.info(`Redis client connected to ${config.host}:${config.port}`);
		});

		Client.on('error', (error: Error) => {
			this.Logger.error(`Redis client error: ${error.message}`, error.stack);
		});

		Client.on('ready', () => {
			this.Logger.info('Redis client ready');
		});

		Client.on('end', () => {
			this.Logger.info('Redis client connection ended');
		});

		return Client;
	}

	/**
   * Starts health checks for Redis connections
   * @param config Redis configuration
   */
	private StartHealthChecks(config: IRedisConfig): void {
		if (!config.healthCheck) return;

		this.HealthCheckInterval = setInterval(() => {
			const Checks: Promise<void>[] = [];

			for (const Client of this.PublisherClients) {
				Checks.push(this.CheckClientHealth(Client, 'publisher'));
			}
			for (const Client of this.SubscriberClients) {
				Checks.push(this.CheckClientHealth(Client, 'subscriber'));
			}

			Promise.all(Checks).catch((error: unknown) => {
				const Err = error as Error;
				this.Logger.error(`Health check failed: ${Err.message}`, Err.stack);
			});
		}, config.healthCheck.interval ?? REDIS_PUBSUB_CLEANUP_INTERVAL);
	}

	/**
   * Checks the health of a Redis client
   * @param client Redis client
   * @param type Client type (publisher/subscriber)
   */
	// eslint-disable-next-line require-await
	private async CheckClientHealth(client: any, type: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const Timeout = setTimeout(() => {
				reject(new Error(`${type} client health check timeout`));
			}, REDIS_PUBSUB_HEALTH_CHECK_TIMEOUT);

			client.ping((error: any, result: any) => {
				clearTimeout(Timeout);
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
	public async GetHealthStatus(): Promise<{
		publisher: boolean;
		subscriber: boolean;
		pubSubInstances: number;
	}> {
		const Status = {
			publisher: false,
			subscriber: false,
			pubSubInstances: this.PubSubInstances.length,
		};

		try {
			for (const Client of this.PublisherClients) {
				await this.CheckClientHealth(Client, 'publisher');
				Status.publisher = true;
			}
		} catch (error) {
			const Err = error as Error;
			this.Logger.warn(`Publisher health check failed: ${Err.message}`);
		}

		try {
			for (const Client of this.SubscriberClients) {
				await this.CheckClientHealth(Client, 'subscriber');
				Status.subscriber = true;
			}
		} catch (error) {
			const Err = error as Error;
			this.Logger.warn(`Subscriber health check failed: ${Err.message}`);
		}

		return Status;
	}

	/**
   * Cleanup method called when module is destroyed
   */
	public async onModuleDestroy(): Promise<void> {
		this.Logger.info('Destroying Redis PubSub factory');

		// Clear health check interval
		if (this.HealthCheckInterval) {
			clearInterval(this.HealthCheckInterval);
		}

		// Close all PubSub instances
		for (const PubSub of this.PubSubInstances) {
			try {
				await PubSub.close();
			} catch (error) {
				const Err = error as Error;
				this.Logger.error(`Error closing PubSub instance: ${Err.message}`, Err.stack);
			}
		}

		this.PubSubInstances = [];

		// Close all Redis clients
		for (const Client of this.PublisherClients) {
			try {
				await Client.quit();
			} catch (error) {
				const Err = error as Error;
				this.Logger.error(`Error closing publisher client: ${Err.message}`, Err.stack);
			}
		}
		for (const Client of this.SubscriberClients) {
			try {
				await Client.quit();
			} catch (error) {
				const Err = error as Error;
				this.Logger.error(`Error closing subscriber client: ${Err.message}`, Err.stack);
			}
		}

		this.PublisherClients.length = 0;
		this.SubscriberClients.length = 0;

		this.Logger.info('Redis PubSub factory destroyed');
	}
}
