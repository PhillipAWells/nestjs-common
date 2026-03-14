/**
 * GraphQL Context Management
 *
 * Context factory and interfaces for GraphQL execution:
 * - HTTP request context creation
 * - WebSocket connection context with subscription info
 * - Request tracing and ID generation
 * - Extensible context enhancement system
 *
 * @packageDocumentation
 */

export { GraphQLContextFactory } from './context-factory.js';
export type { GraphQLContext, WebSocketContext, ContextFactoryOptions } from './graphql-context.interface.js';
