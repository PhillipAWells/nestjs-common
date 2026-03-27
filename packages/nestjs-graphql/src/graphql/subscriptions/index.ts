/**
 * GraphQL Subscriptions and WebSocket Support
 *
 * Provides real-time GraphQL subscriptions over WebSocket connections with:
 * - Automatic WebSocket server lifecycle management
 * - JWT authentication for secure subscriptions
 * - Redis pub/sub for distributed deployments
 * - Connection management and cleanup
 * - Resilience and auto-recovery
 *
 * @packageDocumentation
 */

export { SubscriptionService } from './subscription.service.js';
export { RedisPubSubFactory } from './redis-pubsub.factory.js';
export { GraphQLWebSocketServer as WebSocketServer } from './websocket.server.js';
export { WebSocketAuthService } from './websocket-auth.service.js';
export { ConnectionManagerService } from './connection-manager.service.js';
export { ResilienceService } from './resilience.service.js';
export type { SubscriptionConfig, RedisConfig, WebSocketConfig, AuthConfig, ConnectionConfig, ResilienceConfig } from './subscription-config.interface.js';
export type { WebSocketServerConfig } from './websocket-config.interface.js';
