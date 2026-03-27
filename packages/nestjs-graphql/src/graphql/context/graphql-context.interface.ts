import { Request, Response } from 'express';

/**
 * GraphQL Context Interface
 *
 * Defines the structure of the GraphQL execution context.
 * Contains request/response objects, user information, and
 * other contextual data available to resolvers.
 */
export interface GraphQLContext {
	/**
	 * HTTP request object
	 */
	req: Request;

	/**
	 * HTTP response object
	 */
	res: Response;

	/**
	 * Authenticated user information
	 */
	user?: any;

	/**
	 * Request ID for tracing
	 */
	requestId: string;

	/**
	 * Request start time
	 */
	startTime: Date;

	/**
	 * Custom context data
	 */
	[key: string]: any;
}

/**
 * WebSocket Context Interface
 *
 * Extended context for WebSocket connections (subscriptions)
 */
export interface WebSocketContext extends GraphQLContext {
	/**
	 * WebSocket connection information
	 */
	connection: {
		/**
		 * Connection ID
		 */
		id: string;

		/**
		 * Connection establishment time
		 */
		connectedAt: Date;

		/**
		 * Connection parameters
		 */
		params?: Record<string, any>;
	};

	/**
	 * Subscription-specific data
	 */
	subscription?: {
		/**
		 * Subscription ID
		 */
		id: string;

		/**
		 * Subscription operation name
		 */
		operationName?: string;

		/**
		 * Subscription variables
		 */
		variables?: Record<string, any>;
	};
}

/**
 * Context Factory Options
 */
export interface ContextFactoryOptions {
	/**
	 * Whether to include request tracing
	 * @default true
	 */
	enableTracing?: boolean;

	/**
	 * Custom context enhancers
	 */
	contextEnhancers?: Array<(context: GraphQLContext) => Promise<void> | void>;

	/**
	 * Request ID generator function
	 */
	requestIdGenerator?: () => string;
}
