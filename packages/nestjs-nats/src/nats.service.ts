import {
	Injectable,
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
import type { TNatsModuleOptions } from './nats.interfaces.js';
import { NatsLogger } from './logger.js';

/**
 * Extract error message from Error or unknown value.
 * If the value is an Error, return its message. Otherwise, coerce to string.
 */
function GetErrorMessage(err: unknown): string {
	if (err instanceof Error) {
		return err.message;
	}
	return String(err);
}

/**
 * Extract stack trace from Error or unknown value.
 * If the value is an Error with a stack, return the stack. Otherwise, coerce to string.
 */
function GetErrorStack(err: unknown): string {
	if (err instanceof Error) {
		return err.stack ?? err.message;
	}
	return String(err);
}

/**
 * Injectable service that manages the NATS connection lifecycle and provides
 * core pub/sub, request-reply, and JetStream operations.
 *
 * Connects to NATS on module initialization and drains the connection on application shutdown.
 * Subscriptions created via `Subscribe()` are automatically re-established after reconnection
 * by the nats client library — no manual re-subscription is required.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class OrderService {
 *   constructor(private readonly NatsService: NatsService) {}
 *
 *   publishOrder(order: IOrder): void {
 *     this.NatsService.PublishJson('orders.created', order);
 *   }
 * }
 * ```
 */
@Injectable()
export class NatsService implements OnModuleInit, OnApplicationShutdown {
	private readonly Logger: NatsLogger;
	private readonly Options: TNatsModuleOptions;
	private Connection: NatsConnection | null = null;

	constructor(
		@Inject(NATS_MODULE_OPTIONS_RAW)
		options: TNatsModuleOptions,
	) {
		this.Logger = new NatsLogger(NatsService.name);
		this.Options = options;
	}

	/**
	 * Connects to NATS and starts the status monitor loop.
	 * Called automatically by NestJS on module initialization.
	 */
	public async onModuleInit(): Promise<void> {
		this.Connection = await connect(this.Options);
		this.Logger.Info('Connected to NATS');
		this.MonitorStatus();
	}

	/**
	 * Drains in-flight messages and closes the NATS connection.
	 * Called automatically by NestJS on application shutdown.
	 * Requires app.enableShutdownHooks() to be called on the NestJS application.
	 */
	public async onApplicationShutdown(_signal?: string): Promise<void> {
		if (this.Connection !== null && !this.Connection.isClosed()) {
			await this.Connection.drain();
			this.Logger.Info('NATS connection drained and closed');
		}
	}

	/**
	 * Returns true if the connection is open and not draining.
	 * Useful for health check integrations.
	 */
	public IsConnected(): boolean {
		return (
			this.Connection !== null &&
			!this.Connection.isClosed() &&
			!this.Connection.isDraining()
		);
	}

	/**
	 * Returns the raw NatsConnection for advanced usage (e.g. JetStream management).
	 * @throws Error if the connection has not been established
	 */
	public GetConnection(): NatsConnection {
		this.AssertConnected();
		return this.Connection as NatsConnection;
	}

	/**
	 * Publishes a raw string or binary message to a NATS subject.
	 * @param subject - NATS subject (e.g. 'orders.created')
	 * @param data - Optional string or Uint8Array payload
	 * @param options - Optional publish options (reply subject, headers)
	 * @throws Error if the connection is not established
	 */
	public Publish(subject: string, data?: Uint8Array | string, options?: PublishOptions): void {
		this.AssertConnected();
		(this.Connection as NatsConnection).publish(subject, data, options);
	}

	/**
	 * Serializes data to JSON and publishes it to a NATS subject.
	 * @param subject - NATS subject
	 * @param data - Any JSON-serializable value
	 * @param options - Optional publish options
	 * @throws Error if the connection is not established
	 */
	public PublishJson<T = unknown>(subject: string, data: T, options?: PublishOptions): void {
		this.Publish(subject, JSON.stringify(data), options);
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
	public Subscribe(
		subject: string,
		handler: (msg: Msg) => Promise<void> | void,
		options?: Omit<SubscriptionOptions, 'callback'>,
	): Subscription {
		this.AssertConnected();
		const Sub = (this.Connection as NatsConnection).subscribe(subject, options as SubscriptionOptions);
		this.ConsumeSubscription(Sub, handler, subject);
		return Sub;
	}

	/**
	 * Sends a request to a NATS subject and waits for a reply (request-reply pattern).
	 * @param subject - Target subject
	 * @param data - Optional string or binary payload
	 * @param options - Optional request options (timeout defaults to 5000ms in nats)
	 * @returns The reply message
	 * @throws Error if connection not established, no responders, or timeout
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async
	public Request(
		subject: string,
		data?: Uint8Array | string,
		options?: RequestOptions,
	): Promise<Msg> {
		this.AssertConnected();
		return (this.Connection as NatsConnection).request(subject, data, options);
	}

	/**
	 * Serializes a JSON request, sends it via request-reply, and deserializes the JSON response.
	 * @param subject - Target subject
	 * @param data - JSON-serializable request payload
	 * @param options - Optional request options
	 * @returns Deserialized response
	 */
	public async RequestJson<TRequest = unknown, TResponse = unknown>(
		subject: string,
		data: TRequest,
		options?: RequestOptions,
	): Promise<TResponse> {
		const Reply = await this.Request(subject, JSON.stringify(data), options);
		return Reply.json<TResponse>();
	}

	/**
	 * Returns a JetStream client for persistent messaging operations.
	 * Requires @nats-io/jetstream to be installed.
	 * @throws Error if connection not established
	 */
	public Jetstream(): JetStreamClient {
		this.AssertConnected();
		return createJetStream(this.Connection as NatsConnection);
	}

	/**
	 * Returns a JetStreamManager for stream and consumer administration.
	 * Requires @nats-io/jetstream to be installed.
	 * @throws Error if connection not established
	 */
	public async JetstreamManager(): Promise<JetStreamManager> {
		this.AssertConnected();
		const Manager = await createJetStreamManager(this.Connection as NatsConnection);
		return Manager;
	}

	private AssertConnected(): void {
		if (this.Connection === null || this.Connection.isClosed() || this.Connection.isDraining()) {
			throw new Error(
				'NATS connection is not established or is draining. Ensure NatsModule is imported and the application has fully initialized.',
			);
		}
	}

	private ConsumeSubscription(
		sub: Subscription,
		handler: (msg: Msg) => Promise<void> | void,
		subject: string,
	): void {
		void (async (): Promise<void> => {
			for await (const Msg of sub) {
				try {
					await handler(Msg);
				} catch (err) {
					this.Logger.Error(
						`Handler error on subject "${subject}"`,
						GetErrorStack(err),
					);
				}
			}
		})().catch((err: unknown): void => {
			this.Logger.Error(
				`Subscription iterator closed for subject "${subject}"`,
				GetErrorStack(err),
			);
		});
	}

	private MonitorStatus(): void {
		if (!this.Connection) {
			return;
		}
		const { Connection } = this;
		void (async (): Promise<void> => {
			for await (const Status of Connection.status()) {
				switch (Status.type) {
					case 'disconnect':
						this.Logger.Warn('NATS disconnected');
						break;
					case 'reconnect':
						this.Logger.Info('NATS reconnected');
						break;
					case 'reconnecting':
						this.Logger.Warn('NATS reconnecting...');
						break;
					case 'error': {
						const ErrorStatus = Status as { error?: unknown };
						const ErrorInfo = ErrorStatus.error ?? Status;
						this.Logger.Error('NATS async error', GetErrorStack(ErrorInfo));
						break;
					}
					case 'ldm':
						this.Logger.Warn('NATS server entering lame duck mode');
						break;
					default: {
						const DefaultStatus = Status as Record<string, unknown>;
						this.Logger.Debug(`NATS status: ${DefaultStatus.type}`);
					}
				}
			}
		})().catch((err: unknown): void => {
			this.Logger.Debug(
				'NATS status monitor closed',
				GetErrorMessage(err),
			);
		});
	}
}
