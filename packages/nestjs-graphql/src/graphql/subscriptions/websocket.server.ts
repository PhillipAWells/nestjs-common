import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost , ModuleRef } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { WebSocketServer } from 'ws';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { WebSocketAuthService } from './websocket-auth.service.js';
import type { IWebSocketServerConfig } from './websocket-config.interface.js';

// Lazy load graphql-ws to handle module resolution issues with different bundler environments
const GetUseServer = (): any => {
	return require('@nestjs/graphql/node_modules/graphql-ws/dist/use/ws.cjs').useServer as any;
};

/**
 * GraphQL WebSocket server for subscription support
 *
 * Integrates graphql-ws with the NestJS HTTP server to enable real-time
 * GraphQL subscriptions over WebSocket. Uses the ILazyModuleRefService pattern
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
export class GraphQLWebSocketServer implements OnApplicationBootstrap, OnModuleDestroy, ILazyModuleRefService {
	public readonly Module: ModuleRef;
	private readonly Logger: AppLogger;
	private WsServer: WebSocketServer | null = null;
	private DisposeServer: (() => Promise<void>) | null = null;
	private ServerConfig: IWebSocketServerConfig | null = null;

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
		this.Logger = new AppLogger(undefined, GraphQLWebSocketServer.name);
	}

	private get HttpAdapterHost(): HttpAdapterHost | undefined {
		try {
			return this.Module.get(HttpAdapterHost, { strict: false });
		} catch {
			return undefined;
		}
	}

	private get SchemaHost(): GraphQLSchemaHost | undefined {
		try {
			return this.Module.get(GraphQLSchemaHost, { strict: false });
		} catch {
			return undefined;
		}
	}

	private get AuthService(): WebSocketAuthService | undefined {
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
	public configure(config: IWebSocketServerConfig): void {
		this.ServerConfig = config;
	}

	/**
	 * Auto-initializes the WebSocket server after all modules are ready.
	 * Only runs if configure() was called with a valid config.
	 */
	public async onApplicationBootstrap(): Promise<void> {
		if (!this.ServerConfig) {
			this.Logger.debug('No WebSocket config set — skipping auto-initialization. Call configure() then initialize() to enable subscriptions.');
			return;
		}
		await this.Initialize(this.ServerConfig);
	}

	/**
	 * Initialize the WebSocket server and attach it to the HTTP server.
	 *
	 * @param config WebSocket server configuration
	 */
	// eslint-disable-next-line require-await
	public async Initialize(config: IWebSocketServerConfig): Promise<void> {
		const { HttpAdapterHost: HttpAdapterHostVar } = this;
		if (!HttpAdapterHostVar?.httpAdapter) {
			this.Logger.warn('HttpAdapterHost unavailable — WebSocket server cannot start');
			return;
		}

		const { SchemaHost: SchemaHostVar } = this;
		if (!SchemaHostVar?.schema) {
			this.Logger.warn('GraphQLSchemaHost unavailable — WebSocket server cannot start (schema not yet built)');
			return;
		}

		const HttpServer = HttpAdapterHostVar.httpAdapter.getHttpServer() as import('http').Server;
		const { schema } = SchemaHostVar;
		const { AuthService: AuthServiceVar } = this;

		this.WsServer = new WebSocketServer({ server: HttpServer, path: config.path });

		const UseServer = GetUseServer();
		const Cleanup = UseServer(
			{
				schema,
				onConnect: async (ctx: any) => {
					if (!AuthServiceVar) {
						this.Logger.debug('No WebSocketAuthService — accepting connection without auth');
						return true;
					}

					const Params = ctx.connectionParams ?? {};
					const Result = await AuthServiceVar.Authenticate(Params);

					if (!Result.authenticated) {
						this.Logger.warn(`WebSocket connection rejected: ${Result.error ?? 'authentication failed'}`);
						return false;
					}

					return true;
				},
			},
			this.WsServer,
			config.keepalive,
		);

		this.DisposeServer = async () => {
			await Cleanup.dispose();
		};
		this.Logger.info(`GraphQL WebSocket server listening at ${config.path}`);
	}

	/**
	 * Gracefully shuts down the WebSocket server on module destroy.
	 */
	public async onModuleDestroy(): Promise<void> {
		if (this.DisposeServer) {
			await this.DisposeServer();
			this.DisposeServer = null;
		}

		if (this.WsServer) {
			const { WsServer } = this;
			await new Promise<void>((resolve) => {
				WsServer.close(() => resolve());
			});
			this.WsServer = null;
		}

		this.Logger.debug('GraphQL WebSocket server shut down');
	}
}
