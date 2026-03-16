/**
 * GraphQL types with circular dependency resolution
 * All types are organized to break circular references:
 * - Base types (without relationships) are defined first
 * - Extended types (with relationships) extend base types
 * - Type registry provides ordered registration
 */

// Base types without relationships
export { BaseUser } from './base-user.type.js';
export { BasePost } from './base-post.type.js';
export { BaseComment } from './base-comment.type.js';

// Extended types with relationships
export { User } from './user.type.js';
export { Post } from './post.type.js';
export { Comment } from './comment.type.js';

// Type registry and utilities
export {
	BASE_GRAPHQL_TYPES,
	EXTENDED_GRAPHQL_TYPES,
	ALL_GRAPHQL_TYPES,
	validateTypeRegistrationOrder,
	getTypeNames,
} from './type-registry.js';

// Pagination types
export { PageInfo } from './page-info.type.js';
export { Connection, Edge, CursorUtils } from './connection.type.js';

// Safety types
export { GraphQLErrorCode } from '../error-codes.js';
export type {
	IGraphQLUser,
	IGraphQLContextExtended,
	IGraphQLErrorInput,
	IFormattedGraphQLError,
	IWebSocketConnectionContext,
	ISubscriptionContext,
	ICursorData,
	IPaginationResult,
	ICORSConfig,
	ErrorFormatterFn,
	ContextFactoryFn,
	IWebSocketConnection,
} from './graphql-safety.types.js';
