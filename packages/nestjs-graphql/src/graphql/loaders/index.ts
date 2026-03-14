/**
 * DataLoader Module
 *
 * Batch loading utilities to prevent N+1 queries in GraphQL resolvers.
 * Provides DataLoader factory, registry for request-scoped loaders,
 * and pre-built loaders for common entities.
 *
 * @packageDocumentation
 */

export * from './dataloader.factory.js';
export * from './dataloader-registry.js';
export * from './user.loader.js';
export * from './product.loader.js';
export * from './order.loader.js';
export * from './comment.loader.js';
export * from './tag.loader.js';
export * from './orders-by-user.loader.js';
export * from './comments-by-user.loader.js';
export * from './comments-by-post.loader.js';
