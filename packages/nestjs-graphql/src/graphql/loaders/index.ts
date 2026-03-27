/**
 * DataLoader Module
 *
 * Batch loading utilities to prevent N+1 queries in GraphQL resolvers.
 * Provides DataLoader factory, registry for request-scoped loaders,
 * and pre-built loaders for common entities.
 *
 * @packageDocumentation
 */

export { BatchLoadFn, DataLoaderOptions, DataLoaderFactory } from './dataloader.factory.js';
export { DataLoaderRegistry } from './dataloader-registry.js';
export { User, UserLoader } from './user.loader.js';
export { Product, ProductLoader } from './product.loader.js';
export { Order, OrderLoader } from './order.loader.js';
export { Comment, CommentLoader } from './comment.loader.js';
export { Tag, TagLoader } from './tag.loader.js';
export { OrdersByUserLoader } from './orders-by-user.loader.js';
export { CommentsByUserLoader } from './comments-by-user.loader.js';
export { CommentsByPostLoader } from './comments-by-post.loader.js';
