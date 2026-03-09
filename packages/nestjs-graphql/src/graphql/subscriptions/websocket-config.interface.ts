/**
 * Configuration interface for WebSocket server
 */
export interface WebSocketServerConfig {
	/** WebSocket path for subscriptions */
	path: string;

	/** Maximum payload size in bytes (default: 100KB) */
	maxPayloadSize: number;

	/** Keepalive interval in milliseconds (default: 30s) */
	keepalive: number;

	/** Connection timeout in milliseconds (default: 60s) */
	connectionTimeout: number;

	/** Maximum concurrent connections */
	maxConnections?: number;

	/** Backpressure configuration */
	backpressure?: {
		enabled: boolean;
		highWaterMark: number;
		lowWaterMark: number;
	};

	/** CORS configuration */
	cors?: {
		origin?: string | string[] | boolean;
		methods?: string[];
		allowedHeaders?: string[];
		exposedHeaders?: string[];
		credentials?: boolean;
		maxAge?: number;
	};

	/** Subprotocol configuration */
	subprotocol?: string;

	/** Custom context function */
	context?: (ctx: any) => any;
}
