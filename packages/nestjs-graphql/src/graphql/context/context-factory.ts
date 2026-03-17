import { Injectable, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { GraphQLContext, WebSocketContext, ContextFactoryOptions } from './graphql-context.interface.js';
import type { IWebSocketConnection } from '../graphql/types/graphql-safety.types.js';

/**
 * GraphQL Context Factory
 *
 * Creates and configures GraphQL execution contexts for HTTP and WebSocket requests.
 * Provides request tracing, user context, and extensible context enhancement.
 */
@Injectable()
export class GraphQLContextFactory {
	private readonly logger = new Logger(GraphQLContextFactory.name);

	/**
	 * Creates GraphQL context for HTTP requests
	 *
	 * @param req - HTTP request object
	 * @param res - HTTP response object
	 * @param options - Factory options
	 * @returns Promise<GraphQLContext> - Configured context
	 */
	public async createHttpContext(
		req: Request,
		res: Response,
		options: ContextFactoryOptions = {},
	): Promise<GraphQLContext> {
		const requestId = this.generateRequestId(options);
		const startTime = new Date();

		const context: GraphQLContext = {
			req,
			res,
			requestId,
			startTime,
		};

		// Add user information if available
		if ((req as any).user) {
			(context as any).user = (req as any).user;
		}

		// Apply context enhancers
		await this.applyContextEnhancers(context, options);

		this.logger.debug(`Created HTTP GraphQL context: ${requestId}`);

		return context;
	}

	/**
	 * Creates GraphQL context for WebSocket connections
	 *
	 * @param connection - WebSocket connection context
	 * @param options - Factory options
	 * @returns Promise<WebSocketContext> - Configured WebSocket context
	 */
	public async createWebSocketContext(
		connection: IWebSocketConnection,
		options: ContextFactoryOptions = {},
	): Promise<WebSocketContext> {
		const requestId = this.generateRequestId(options);
		const startTime = new Date();

		const req = connection.request ?? ({} as Request);
		const res = {} as Response; // WebSocket doesn't have a response object

		const context: WebSocketContext = {
			req,
			res,
			requestId,
			startTime,
			connection: {
				id: connection.id ?? randomUUID(),
				connectedAt: new Date(),
				params: connection.params ?? {},
			},
		};

		// Add user information if available
		if (connection.user) {
			context.user = connection.user;
		}

		// Apply context enhancers
		await this.applyContextEnhancers(context, options);

		this.logger.debug(`Created WebSocket GraphQL context: ${requestId}`);

		return context;
	}

	/**
	 * Generates a unique request ID
	 */
	private generateRequestId(options: ContextFactoryOptions): string {
		if (options.requestIdGenerator) {
			return options.requestIdGenerator();
		}

		return randomUUID();
	}

	/**
	 * Applies context enhancers to the context
	 */
	private async applyContextEnhancers(
		context: GraphQLContext,
		options: ContextFactoryOptions,
	): Promise<void> {
		if (!options.contextEnhancers) {
			return;
		}

		for (const enhancer of options.contextEnhancers) {
			try {
				await enhancer(context);
			} catch (error) {
				this.logger.error(
					`Context enhancer failed: ${error instanceof Error ? error.message : String(error)}`,
					error instanceof Error ? error.stack : undefined,
				);
				// Continue with other enhancers even if one fails
			}
		}
	}

	/**
	 * Creates a context factory with pre-configured options
	 *
	 * @param options - Default factory options
	 * @returns Configured factory functions
	 */
	public static createFactory(options: ContextFactoryOptions = {}): {
		createHttpContext: (req: Request, res: Response) => Promise<GraphQLContext>;
		createWebSocketContext: (connection: IWebSocketConnection) => Promise<GraphQLContext>;
	} {
		const factory = new GraphQLContextFactory();

		return {
			createHttpContext: (req: Request, res: Response): Promise<GraphQLContext> =>
				factory.createHttpContext(req, res, options),

			createWebSocketContext: (connection: IWebSocketConnection): Promise<GraphQLContext> =>
				factory.createWebSocketContext(connection, options),
		};
	}
}
