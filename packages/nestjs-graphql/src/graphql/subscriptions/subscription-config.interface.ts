/**
 * Configuration interface for GraphQL subscriptions with Redis PubSub
 */
export interface SubscriptionConfig {
	/** Redis connection configuration */
	redis: RedisConfig;

	/** WebSocket server configuration */
	websocket: WebSocketConfig;

	/** Authentication configuration */
	auth: AuthConfig;

	/** Connection management configuration */
	connection: ConnectionConfig;

	/** Resilience configuration */
	resilience: ResilienceConfig;
}

/**
 * Redis connection configuration
 */
export interface RedisConfig {
	/** Redis host */
	host: string;

	/** Redis port */
	port: number;

	/** Redis password (optional) */
	password?: string;

	/** Redis database number */
	db?: number;

	/** Connection timeout in milliseconds */
	connectTimeout?: number;

	/** Command timeout in milliseconds */
	commandTimeout?: number;

	/** Maximum number of connections in pool */
	maxConnections?: number;

	/** Minimum number of connections in pool */
	minConnections?: number;

	/** TLS configuration for production */
	tls?: {
		ca?: string;
		cert?: string;
		key?: string;
		rejectUnauthorized?: boolean;
	};

	/** Retry configuration */
	retry?: {
		attempts: number;
		delay: number;
		backoff: 'fixed' | 'exponential';
	};

	/** Health check configuration */
	healthCheck?: {
		enabled: boolean;
		interval: number;
		timeout: number;
	};
}

/**
 * WebSocket server configuration
 */
export interface WebSocketConfig {
	/** WebSocket path */
	path: string;

	/** Maximum payload size in bytes */
	maxPayloadSize: number;

	/** Keepalive interval in milliseconds */
	keepalive: number;

	/** Connection timeout in milliseconds */
	connectionTimeout: number;

	/** Maximum concurrent connections */
	maxConnections?: number;

	/** Backpressure configuration */
	backpressure?: {
		enabled: boolean;
		highWaterMark: number;
		lowWaterMark: number;
	};
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
	/** JWT secret for token validation */
	jwtSecret: string;

	/** Token expiration time */
	tokenExpiration: string;

	/** Refresh token configuration */
	refreshToken?: {
		enabled: boolean;
		expiration: string;
	};

	/** Authentication header name */
	headerName?: string;

	/** Query parameter name for token */
	queryParam?: string;
}

/**
 * Connection management configuration
 */
export interface ConnectionConfig {
	/** Maximum subscriptions per user */
	maxSubscriptionsPerUser: number;

	/** Connection cleanup interval in milliseconds */
	cleanupInterval: number;

	/** Connection timeout in milliseconds */
	timeout: number;

	/** Statistics collection */
	stats?: {
		enabled: boolean;
		interval: number;
	};
}

/**
 * Resilience configuration
 */
export interface ResilienceConfig {
	/** Keepalive configuration */
	keepalive: {
		enabled: boolean;
		interval: number;
		timeout: number;
	};

	/** Reconnection configuration */
	reconnection: {
		enabled: boolean;
		attempts: number;
		delay: number;
		backoff: 'fixed' | 'exponential';
	};

	/** Error recovery configuration */
	errorRecovery: {
		enabled: boolean;
		retryDelay: number;
		maxRetries: number;
	};

	/** Graceful shutdown configuration */
	shutdown: {
		timeout: number;
		force: boolean;
	};
}
