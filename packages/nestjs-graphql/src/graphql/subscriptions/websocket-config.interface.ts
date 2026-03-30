/**
 * Configuration interface for GraphQL WebSocket server
 *
 * Controls server behavior for WebSocket connections supporting GraphQL subscriptions.
 * All timeout and interval values are in milliseconds. Backpressure and CORS
 * are optional and have sensible defaults if not specified.
 *
 * @example
 * ```typescript
 * const config: IWebSocketServerConfig = {
 *   path: '/graphql/subscriptions',
 *   maxPayloadSize: 102400,
 *   keepalive: 30000,
 *   connectionTimeout: 60000,
 *   maxConnections: 1000,
 *   backpressure: {
 *     enabled: true,
 *     highWaterMark: 16384,
 *     lowWaterMark: 4096,
 *   },
 * };
 * ```
 */
export interface IWebSocketServerConfig {
	/**
	 * WebSocket path for subscriptions (e.g., '/graphql/subscriptions')
	 * This path is appended to the server root
	 */
	path: string;

	/**
	 * Maximum payload size in bytes
	 * @default 102400 (100KB)
	 */
	maxPayloadSize: number;

	/**
	 * Keepalive ping interval in milliseconds
	 * Keeps idle connections alive and detects dead connections
	 * @default 30000 (30 seconds)
	 */
	keepalive: number;

	/**
	 * Connection initialization timeout in milliseconds
	 * Time to wait for initial connection message before closing
	 * @default 60000 (60 seconds)
	 */
	connectionTimeout: number;

	/**
	 * Maximum number of concurrent WebSocket connections
	 * Undefined means unlimited (default)
	 */
	maxConnections?: number;

	/**
	 * Backpressure configuration for flow control
	 * Manages buffer sizes when client receives data faster than it can process
	 */
	backpressure?: {
		/** Whether backpressure monitoring is enabled */
		enabled: boolean;

		/** Upper buffer threshold; pauses writing when exceeded */
		highWaterMark: number;

		/** Lower buffer threshold; resumes writing when dropped below */
		lowWaterMark: number;
	};

	/**
	 * CORS configuration for WebSocket connections
	 * Controls which origins can establish WebSocket subscriptions
	 */
	cors?: {
		/** Allowed origins: string, array, wildcard '*', or boolean */
		origin?: string | string[] | boolean;

		/** Allowed HTTP methods for CORS preflight */
		methods?: string[];

		/** Headers allowed in preflight requests */
		allowedHeaders?: string[];

		/** Headers exposed to the client */
		exposedHeaders?: string[];

		/** Whether credentials (cookies) are included */
		credentials?: boolean;

		/** CORS preflight cache duration in seconds */
		maxAge?: number;
	};

	/**
	 * WebSocket subprotocol (e.g., 'graphql-ws')
	 * Used by clients to negotiate specific protocol version
	 */
	subprotocol?: string;

	/**
	 * Custom context function for WebSocket connections
	 * Called with connection context; returns context object for resolvers
	 * @param ctx WebSocket connection context
	 * @returns Custom context object
	 */
	context?: (ctx: any) => any;
}
