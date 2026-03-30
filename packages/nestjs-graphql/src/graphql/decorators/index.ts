/**
 * GraphQL Decorators
 *
 * Decorators for GraphQL resolvers:
 * - Authentication and authorization (@Auth, @Public, @Roles)
 * - IUser context extraction (@CurrentUser, @AuthToken, @GraphQLContextParam)
 * - Subscription management (@Subscription)
 * - Caching decorators (@Cacheable, @CacheInvalidate)
 *
 * @packageDocumentation
 */

export { Subscription, SubscriptionFilter, SubscriptionAuth, SUBSCRIPTION_METADATA } from './subscription.decorator.js';
export type { ISubscriptionOptions } from './subscription.decorator.js';

export {
	Auth,
	Public,
	Roles,
	CurrentUser,
	AuthToken,
	GraphQLContextParam,
	GraphQLUser,
	GraphQLAuth,
	GraphQLPublic,
	GraphQLRoles,
	GraphQLCurrentUser,
	GraphQLAuthToken,
	IS_PUBLIC_KEY,
	ROLES_KEY,
} from './graphql-auth-decorators.js';

export { Cacheable, CACHEABLE_METADATA } from './cacheable.decorator.js';
export type { ICacheableOptions } from './cacheable.decorator.js';
export { CacheInvalidate, CACHE_INVALIDATE_METADATA } from './cache-invalidate.decorator.js';
export type { ICacheInvalidateOptions } from './cache-invalidate.decorator.js';
