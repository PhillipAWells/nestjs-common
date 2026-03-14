import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { ModuleRef } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { WebSocketAuthService } from './websocket-auth.service.js';
import type { WebSocketServerConfig } from './websocket-config.interface.js';

/**
 * GraphQL WebSocket server for subscription support
 *
 * Integrates graphql-ws with the NestJS HTTP server to enable real-time
 * GraphQL subscriptions over WebSocket. Uses the LazyModuleRefService pattern
 * to resolve dependencies after module initialization.
 *
 * Lifecycle:
 * 1. Module initializes (OnModuleInit on other services)
 * 2. Schema is built by Apollo driver
 * 3. onApplicationBootstrap fires — WebSocket server is attached
 * 4. onModuleDestroy fires — connections are cleanly disposed
 *
 * @example
 * ```typescript
 * // In your GraphQL module:
 * @Module({
 *   providers: [GraphQLWebSocketServer],
 * })
 * export class SubscriptionModule {}
 * ```
 */
@Injectable()
export class GraphQLWebSocketServer implements OnApplicationBootstrap, OnModuleDestroy, LazyModuleRefService {
	private readonly logger = new Logger(GraphQLWebSocketServer.name);
	private wsServer: WebSocketServer | null = null;
	private disposeServer: (() => Promise<void>) | null = null;
	private serverConfig: WebSocketServerConfig | null = null;

	constructor(public readonly Module: ModuleRef) {}

	private get httpAdapterHost(): HttpAdapterHost | undefined {
		try {
			return this.Module.get(HttpAdapterHost, { strict: false });
		} catch {
			return undefined;
		}
	}

	private get schemaHost(): GraphQLSchemaHost | undefined {
		try {
			return this.Module.get(GraphQLSchemaHost, { strict: false });
		} catch {
			return undefined;
		}
	}

	private get authService(): WebSocketAuthService | undefined {
		try {
			return this.Module.get(WebSocketAuthService, { strict: false });
		} catch {
			return undefined;
		}
	}

	/**
	 * Set configuration for the WebSocket server.
	 * Must be called before onApplicationBootstrap for auto-initialization,
	 * or before calling initialize() manually.
	 */
	public configure(config: WebSocketServerConfig): void {
		this.serverConfig = config;
	}

	/**
	 * Auto-initializes the WebSocket server after all modules are ready.
	 * Only runs if configure() was called with a valid config.
	 */
	public async onApplicationBootstrap(): Promise<void> {
		if (!this.serverConfig) {
			this.logger.debug('No WebSocket config set — skipping auto-initialization. Call configure() then initialize() to enable subscriptions.');
			return;
		}
		await this.initialize(this.serverConfig);
	}

	/**
	 * Initialize the WebSocket server and attach it to the HTTP server.
	 *
	 * @param config WebSocket server configuration
	 */
	// eslint-disable-next-line require-await
	public async initialize(config: WebSocketServerConfig): Promise<void> {
		const { httpAdapterHost } = this;
		if (!httpAdapterHost?.httpAdapter) {
			this.logger.warn('HttpAdapterHost unavailable — WebSocket server cannot start');
			return;
		}

		const { schemaHost } = this;
		if (!schemaHost?.schema) {
			this.logger.warn('GraphQLSchemaHost unavailable — WebSocket server cannot start (schema not yet built)');
			return;
		}

		const httpServer = httpAdapterHost.httpAdapter.getHttpServer() as import('http').Server;
		const { schema } = schemaHost;
		const { authService } = this;

		this.wsServer = new WebSocketServer({ server: httpServer, path: config.path });

		const cleanup = useServer(
			{
				schema,
				onConnect: async (ctx) => {
					if (!authService) {
						this.logger.debug('No WebSocketAuthService — accepting connection without auth');
						return true;
					}

					const params = ctx.connectionParams ?? {};
					const result = await authService.authenticate(params);

					if (!result.authenticated) {
						this.logger.warn(`WebSocket connection rejected: ${result.error ?? 'authentication failed'}`);
						return false;
					}

					return true;
				},
			},
			this.wsServer,
			config.keepalive,
		);

		this.disposeServer = async () => {
			await cleanup.dispose();
		};
		this.logger.log(`GraphQL WebSocket server listening at ${config.path}`);
	}

	/**
	 * Gracefully shuts down the WebSocket server on module destroy.
	 */
	public async onModuleDestroy(): Promise<void> {
		if (this.disposeServer) {
			await this.disposeServer();
			this.disposeServer = null;
		}

		if (this.wsServer) {
			const { wsServer } = this;
			await new Promise<void>((resolve) => {
				wsServer.close(() => resolve());
			});
			this.wsServer = null;
		}

		this.logger.debug('GraphQL WebSocket server shut down');
	}
}
