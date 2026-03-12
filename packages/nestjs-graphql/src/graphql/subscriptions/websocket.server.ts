import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

/**
 * Stub WebSocket server for GraphQL subscriptions
 * TODO: Re-enable after fixing graphql-ws moduleResolution (requires node16+)
 * The full implementation requires 'graphql-ws/use/ws' which needs moduleResolution: node16+
 */
@Injectable()
export class GraphQLWebSocketServer implements OnModuleDestroy {
	private readonly logger = new Logger(GraphQLWebSocketServer.name);

	// private readonly wsServer: WebSocketServer | null = null; // Unused in stub
	private readonly disposeServer: (() => Promise<void>) | (() => void) = () => {};

	public initialize(): void {
		this.logger.warn('GraphQLWebSocketServer is stubbed - GraphQL subscriptions disabled');
	}

	public async onModuleDestroy(): Promise<void> {
		if (this.disposeServer) {
			await Promise.resolve(this.disposeServer());
		}
	}
}
