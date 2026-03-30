import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { IGraphQLContext, IWebSocketContext, IContextFactoryOptions } from './graphql-context.interface.js';
import type { IWebSocketConnection } from '../graphql/types/graphql-safety.types.js';

/**
 * GraphQL Context Factory
 *
 * Creates and configures GraphQL execution contexts for HTTP and WebSocket requests.
 * Provides request tracing, user context, and extensible context enhancement.
 */
@Injectable()
export class GraphQLContextFactory {
	// eslint-disable-next-line @typescript-eslint/prefer-readonly
	private ModuleRef?: ModuleRef;

	private get AppLogger(): AppLogger | undefined {
		return this.ModuleRef?.get(AppLogger, { strict: false });
	}

	private get Logger(): AppLogger | undefined {
		return this.AppLogger?.createContextualLogger(GraphQLContextFactory.name);
	}

	constructor(moduleRef?: ModuleRef) {
		this.ModuleRef = moduleRef;
	}

	/**
	 * Creates GraphQL context for HTTP requests
	 *
	 * @param req - HTTP request object
	 * @param res - HTTP response object
	 * @param options - Factory options
	 * @returns Promise<IGraphQLContext> - Configured context
	 */
	public async createHttpContext(
		req: Request,
		res: Response,
		options: IContextFactoryOptions = {},
	): Promise<IGraphQLContext> {
		const requestId = this.generateRequestId(options);
		const startTime = new Date();

		const context: IGraphQLContext = {
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

		this.Logger?.debug(`Created HTTP GraphQL context: ${requestId}`);

		return context;
	}

	/**
	 * Creates GraphQL context for WebSocket connections
	 *
	 * @param connection - WebSocket connection context
	 * @param options - Factory options
	 * @returns Promise<IWebSocketContext> - Configured WebSocket context
	 */
	public async createWebSocketContext(
		connection: IWebSocketConnection,
		options: IContextFactoryOptions = {},
	): Promise<IWebSocketContext> {
		const requestId = this.generateRequestId(options);
		const startTime = new Date();

		const req = connection.request ?? ({} as Request);
		const res = {} as Response; // WebSocket doesn't have a response object

		const context: IWebSocketContext = {
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

		this.Logger?.debug(`Created WebSocket GraphQL context: ${requestId}`);

		return context;
	}

	/**
	 * Generates a unique request ID
	 */
	private generateRequestId(options: IContextFactoryOptions): string {
		if (options.requestIdGenerator) {
			return options.requestIdGenerator();
		}

		return randomUUID();
	}

	/**
	 * Applies context enhancers to the context
	 */
	private async applyContextEnhancers(
		context: IGraphQLContext,
		options: IContextFactoryOptions,
	): Promise<void> {
		if (!options.contextEnhancers) {
			return;
		}

		for (const enhancer of options.contextEnhancers) {
			try {
				await enhancer(context);
			} catch (error) {
				this.Logger?.error(
					`Context enhancer failed: ${getErrorMessage(error)}`,
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
	public static createFactory(options: IContextFactoryOptions = {}): {
		createHttpContext: (req: Request, res: Response) => Promise<IGraphQLContext>;
		createWebSocketContext: (connection: IWebSocketConnection) => Promise<IGraphQLContext>;
	} {
		const factory = new GraphQLContextFactory(undefined);

		return {
			createHttpContext: (req: Request, res: Response): Promise<IGraphQLContext> =>
				factory.createHttpContext(req, res, options),

			createWebSocketContext: (connection: IWebSocketConnection): Promise<IGraphQLContext> =>
				factory.createWebSocketContext(connection, options),
		};
	}
}
