/**
 * GraphQL Subscriptions Constants
 *
 * Configuration for WebSocket connections, Redis pub/sub, and resilience.
 */

// WebSocket connections
export const MAX_WEBSOCKET_CONNECTIONS = 100;
export const WEBSOCKET_AUTH_TIMEOUT = 1_000;
export const WEBSOCKET_AUTH_RETRY_COUNT = 3;

// Redis pub/sub timeouts (milliseconds)
export const REDIS_PUBSUB_RESPONSE_TIMEOUT = 60_000; // 60 seconds
export const REDIS_PUBSUB_CLEANUP_INTERVAL = 30_000; // 30 seconds
export const REDIS_PUBSUB_MESSAGE_TIMEOUT = 5_000; // 5 seconds
export const REDIS_PUBSUB_HEALTH_CHECK_TIMEOUT = 5_000; // 5 seconds

// Connection configuration
export const CONNECTION_MAX_SUBSCRIPTIONS_PER_USER = 100;

// Rate limiting
export const RATE_LIMIT_CHECK_TIMEOUT = 1_000;
