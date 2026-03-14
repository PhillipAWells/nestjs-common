/**
 * GraphQL Module Exports
 *
 * Complete GraphQL module with Apollo Server 5.x integration providing:
 * - Custom scalars (ObjectId, DateTime, JSON)
 * - Guards for authentication, authorization, rate limiting, and query complexity
 * - Interceptors for logging, error handling, caching, and performance monitoring
 * - Pipes for input validation and security checks
 * - Services for rate limiting, caching, and performance tracking
 * - Context management for HTTP and WebSocket connections
 * - DataLoaders for batch loading and N+1 prevention
 * - WebSocket subscriptions with authentication
 * - Structured error handling with standardized codes
 *
 * @packageDocumentation
 */

// GraphQL Core
export { GraphQLModule, GraphQLService } from './graphql/index.js';
export type { GraphQLConfigOptions, GraphQLAsyncConfig } from './graphql/index.js';

// Scalars
export { ObjectIdScalar, DateTimeScalar, JSONScalar } from './graphql/index.js';

// Types
export { PageInfo, Connection, Edge, CursorUtils } from './graphql/index.js';

// Enums
export { SortDirection } from './graphql/index.js';

// Error Handling
export { GraphQLErrorFormatter, GraphQLErrorCode } from './graphql/index.js';
export type { GraphQLErrorExtensions, ValidationError } from './graphql/index.js';

// Subscriptions
export * from './subscriptions/index.js';

// Guards
export * from './guards/index.js';

// Interceptors
export * from './interceptors/index.js';

// Pipes
export * from './pipes/index.js';

// Services
export * from './services/index.js';

// Decorators
export * from './decorators/index.js';

// Context
export * from './context/index.js';

// Errors
export * from './errors/index.js';

// Loaders
export * from './loaders/index.js';
