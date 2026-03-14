/**
 * GraphQL Decorators
 *
 * Decorators for GraphQL resolvers:
 * - Authentication and authorization (@Auth, @Public, @Roles)
 * - User context extraction (@CurrentUser, @AuthToken, @GraphQLContextParam)
 * - Subscription management (@Subscription)
 * - Caching decorators (@Cacheable, @CacheInvalidate)
 *
 * @packageDocumentation
 */

export { Subscription, SubscriptionFilter, SubscriptionAuth, SUBSCRIPTION_METADATA } from './subscription.decorator.js';
export type { SubscriptionOptions } from './subscription.decorator.js';

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
export type { CacheableOptions } from './cacheable.decorator.js';
export { CacheInvalidate, CACHE_INVALIDATE_METADATA } from './cache-invalidate.decorator.js';
export type { CacheInvalidateOptions } from './cache-invalidate.decorator.js';
