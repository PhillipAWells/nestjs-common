import {
	Injectable,
	Logger,
	OnApplicationShutdown,
	OnModuleInit,
	Inject,
} from '@nestjs/common';
import {
	connect,
	type NatsConnection,
	type Subscription,
	type SubscriptionOptions,
	type PublishOptions,
	type RequestOptions,
	type Msg,
} from '@nats-io/transport-node';
import {
	jetstream as createJetStream,
	jetstreamManager as createJetStreamManager,
	type JetStreamClient,
	type JetStreamManager,
} from '@nats-io/jetstream';
import { NATS_MODULE_OPTIONS_RAW } from './nats.constants.js';
import type { NatsModuleOptions } from './nats.interfaces.js';

/**
 * Injectable service that manages the NATS connection lifecycle and provides
 * core pub/sub, request-reply, and JetStream operations.
 *
 * Connects to NATS on module initialization and drains the connection on application shutdown.
 * Subscriptions created via subscribe() are automatically re-established after reconnection
 * by the nats client library — no manual re-subscription is required.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class OrderService {
 *   constructor(private readonly natsService: NatsService) {}
 *
 *   publishOrder(order: Order): void {
 *     this.natsService.publishJson('orders.created', order);
 *   }
 * }
 * ```
 */
@Injectable()
export class NatsService implements OnModuleInit, OnApplicationShutdown {
	private readonly logger = new Logger(NatsService.name);
	private connection: NatsConnection | null = null;

	constructor(
		@Inject(NATS_MODULE_OPTIONS_RAW)
		private readonly options: NatsModuleOptions,
	) {}

	/**
	 * Connects to NATS and starts the status monitor loop.
	 * Called automatically by NestJS on module initialization.
	 */
	public async onModuleInit(): Promise<void> {
		this.connection = await connect(this.options);
		this.logger.log('Connected to NATS');
		this.monitorStatus();
	}

	/**
	 * Drains in-flight messages and closes the NATS connection.
	 * Called automatically by NestJS on application shutdown.
	 * Requires app.enableShutdownHooks() to be called on the NestJS application.
	 */
	public async onApplicationShutdown(_signal?: string): Promise<void> {
		if (this.connection !== null && !this.connection.isClosed()) {
			await this.connection.drain();
			this.logger.log('NATS connection drained and closed');
		}
	}

	/**
	 * Returns true if the connection is open and not draining.
	 * Useful for health check integrations.
	 */
	public isConnected(): boolean {
		return (
			this.connection !== null &&
			!this.connection.isClosed() &&
			!this.connection.isDraining()
		);
	}

	/**
	 * Returns the raw NatsConnection for advanced usage (e.g. JetStream management).
	 * @throws Error if the connection has not been established
	 */
	public getConnection(): NatsConnection {
		this.assertConnected();
		return this.connection as NatsConnection;
	}

	/**
	 * Publishes a raw string or binary message to a NATS subject.
	 * @param subject - NATS subject (e.g. 'orders.created')
	 * @param data - Optional string or Uint8Array payload
	 * @param options - Optional publish options (reply subject, headers)
	 * @throws Error if the connection is not established
	 */
	public publish(subject: string, data?: Uint8Array | string, options?: PublishOptions): void {
		this.assertConnected();
		(this.connection as NatsConnection).publish(subject, data, options);
	}

	/**
	 * Serializes data to JSON and publishes it to a NATS subject.
	 * @param subject - NATS subject
	 * @param data - Any JSON-serializable value
	 * @param options - Optional publish options
	 * @throws Error if the connection is not established
	 */
	public publishJson<T = unknown>(subject: string, data: T, options?: PublishOptions): void {
		this.publish(subject, JSON.stringify(data), options);
	}

	/**
	 * Subscribes to a NATS subject and calls handler for each message.
	 * Uses the async iterator pattern internally. The callback option from
	 * SubscriptionOptions is intentionally omitted — use the handler parameter instead.
	 *
	 * @param subject - NATS subject or wildcard pattern (e.g. 'orders.*', 'events.>')
	 * @param handler - Async or sync function called for each received message
	 * @param options - Optional subscription options (queue group, max messages, timeout)
	 * @returns The underlying Subscription object (call .unsubscribe() to stop)
	 * @throws Error if the connection is not established
	 */
	public subscribe(
		subject: string,
		handler: (msg: Msg) => Promise<void> | void,
		options?: Omit<SubscriptionOptions, 'callback'>,
	): Subscription {
		this.assertConnected();
		const sub = (this.connection as NatsConnection).subscribe(subject, options as SubscriptionOptions);
		this.consumeSubscription(sub, handler, subject);
		return sub;
	}

	/**
	 * Sends a request to a NATS subject and waits for a reply (request-reply pattern).
	 * @param subject - Target subject
	 * @param data - Optional string or binary payload
	 * @param options - Optional request options (timeout defaults to 5000ms in nats)
	 * @returns The reply message
	 * @throws Error if connection not established, no responders, or timeout
	 */
	public request(
		subject: string,
		data?: Uint8Array | string,
		options?: RequestOptions,
	): Promise<Msg> {
		this.assertConnected();
		return (this.connection as NatsConnection).request(subject, data, options);
	}

	/**
	 * Serializes a JSON request, sends it via request-reply, and deserializes the JSON response.
	 * @param subject - Target subject
	 * @param data - JSON-serializable request payload
	 * @param options - Optional request options
	 * @returns Deserialized response
	 */
	public async requestJson<TRequest = unknown, TResponse = unknown>(
		subject: string,
		data: TRequest,
		options?: RequestOptions,
	): Promise<TResponse> {
		const reply = await this.request(subject, JSON.stringify(data), options);
		return reply.json<TResponse>();
	}

	/**
	 * Returns a JetStream client for persistent messaging operations.
	 * Requires @nats-io/jetstream to be installed.
	 * @throws Error if connection not established
	 */
	public jetstream(): JetStreamClient {
		this.assertConnected();
		return createJetStream(this.connection as NatsConnection);
	}

	/**
	 * Returns a JetStreamManager for stream and consumer administration.
	 * Requires @nats-io/jetstream to be installed.
	 * @throws Error if connection not established
	 */
	public async jetstreamManager(): Promise<JetStreamManager> {
		this.assertConnected();
		const manager = await createJetStreamManager(this.connection as NatsConnection);
		return manager;
	}

	private assertConnected(): void {
		if (this.connection === null || this.connection.isClosed()) {
			throw new Error(
				'NATS connection is not established. Ensure NatsModule is initialized and app.enableShutdownHooks() is called.',
			);
		}
	}

	private consumeSubscription(
		sub: Subscription,
		handler: (msg: Msg) => Promise<void> | void,
		subject: string,
	): void {
		void (async (): Promise<void> => {
			for await (const msg of sub) {
				try {
					await handler(msg);
				} catch (err) {
					this.logger.error(
						`Handler error on subject "${subject}"`,
						err instanceof Error ? err.stack : String(err),
					);
				}
			}
		})().catch((err: unknown): void => {
			this.logger.error(
				`Subscription iterator closed for subject "${subject}"`,
				err instanceof Error ? err.stack : String(err),
			);
		});
	}

	private monitorStatus(): void {
		if (this.connection === null) {
			return;
		}
		const connection = this.connection;
		void (async (): Promise<void> => {
			for await (const status of connection.status()) {
				switch (status.type) {
					case 'disconnect':
						this.logger.warn('NATS disconnected');
						break;
					case 'reconnect':
						this.logger.log('NATS reconnected');
						break;
					case 'reconnecting':
						this.logger.warn('NATS reconnecting...');
						break;
					case 'error':
						this.logger.error('NATS async error', status);
						break;
					case 'ldm':
						this.logger.warn('NATS server entering lame duck mode');
						break;
					default:
						this.logger.debug(`NATS status: ${(status as { type: string; }).type}`);
				}
			}
		})().catch((err: unknown): void => {
			this.logger.debug(
				'NATS status monitor closed',
				err instanceof Error ? err.message : String(err),
			);
		});
	}
}
