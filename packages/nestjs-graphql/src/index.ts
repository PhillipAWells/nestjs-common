/**
 * @pawells/nestjs-graphql
 *
 * Enterprise-grade NestJS GraphQL module with Apollo Server 5.x integration.
 *
 * Provides:
 * - Redis-backed caching with @Cacheable, @CacheEvict, @CacheInvalidate decorators
 * - GraphQL module with custom scalars (ObjectId, DateTime, JSON)
 * - Query complexity analysis to prevent DoS attacks
 * - WebSocket subscriptions with authentication
 * - DataLoaders for N+1 query prevention
 * - Guards for authentication, authorization, rate limiting
 * - Interceptors for logging, error handling, caching, performance monitoring
 * - Pipes for input validation with XSS detection
 * - Standardized error handling with GraphQLErrorFormatter
 * - Cursor-based pagination utilities
 * - BSON serialization support
 *
 * @example
 * ```typescript
 * import { GraphQLModule, CacheModule } from '@pawells/nestjs-graphql';
 *
 * @Module({
 *   imports: [
 *     CacheModule.forRoot(),
 *     GraphQLModule.forRoot({
 *       autoSchemaFile: 'schema.gql',
 *       playground: false,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * @see {@link GraphQLModule} - Main GraphQL module
 * @see {@link CacheModule} - Redis caching module
 * @see {@link RateLimitService} - Rate limiting
 * @see {@link DataLoaderRegistry} - Batch loading
 * @see {@link GraphQLWebSocketServer} - WebSocket subscriptions
 *
 * @packageDocumentation
 */

// ============================================================================
// Cache Module Exports
// ============================================================================
export { CacheModule } from './cache/cache.module.js';
export type { ICacheModuleAsyncOptions } from './cache/cache.interfaces.js';
export { CacheService } from './cache/cache.service.js';
export { CacheInterceptor } from './cache/cache.interceptor.js';

// Base interceptor and strategies
export { BaseCacheInterceptor } from './cache/interceptors/base-cache.interceptor.js';
export type {
	ICacheKeyGenerator,
	ICacheMetadataExtractor,
	ICacheContextHandler,
} from './cache/interceptors/base-cache.interceptor.js';

// Configuration
export { GetRedisConfig as getRedisConfig, GetRedisConnectionOptions as getRedisConnectionOptions, CreateRedisOptions as createRedisOptions } from './cache/redis.config.js';
export type { IRedisConfig, IRedisConnectionOptions } from './cache/redis.config.js';

// Types
export type {
	ICacheStats,
	ICacheConfig as CacheCacheConfig,
	TCacheKeyBuilder,
	ICacheMetrics,
	ICacheEntryMetadata,
	ICacheOperationResult,
	ICacheWarmingOptions,
	ICacheInvalidationOptions,
	IRedisConnectionInfo,
} from './cache/cache.types.js';
export { CacheInvalidationStrategy, RedisConnectionStatus } from './cache/cache.types.js';

// Decorators
export { Cacheable } from './cache/decorators/cacheable.decorator.js';
export { CacheEvict } from './cache/decorators/cache-evict.decorator.js';
export { CacheInvalidate } from './cache/decorators/cache-invalidate.decorator.js';

// Base decorator metadata and interfaces
export type { IBaseCacheableOptions, IBaseCacheInvalidateOptions } from './cache/decorators/cache-metadata.js';
export { CACHE_METADATA_KEYS } from './cache/decorators/cache-metadata.js';
export type { TCacheMetadataKey } from './cache/decorators/cache-metadata.js';

// ============================================================================
// GraphQL Module Exports
// ============================================================================

// GraphQL Core
export { GraphQLModule, GraphQLService } from './graphql/graphql/index.js';
export type { IGraphQLConfigOptions, IGraphQLAsyncConfig } from './graphql/graphql/index.js';

// Scalars
export { ObjectIdScalar, DateTimeScalar, JSONScalar } from './graphql/graphql/index.js';

// Types
export { PageInfo, Connection, Edge, CursorUtils } from './graphql/graphql/index.js';

// Enums
export { SortDirection } from './graphql/graphql/index.js';

// Error Handling
export { GraphQLErrorFormatter, GraphQLErrorCode } from './graphql/graphql/index.js';
export type { IGraphQLErrorExtensions, IValidationError } from './graphql/graphql/index.js';

// Subscriptions
export {
	SubscriptionService,
	RedisPubSubFactory,
	WebSocketServer,
	WebSocketAuthService,
	ConnectionManagerService,
	ResilienceService,
	type ISubscriptionConfig,
	type IWebSocketConfig,
	type IAuthConfig,
	type IConnectionConfig,
	type IResilienceConfig,
	type IWebSocketServerConfig,
} from './graphql/subscriptions/index.js';

// Guards
export {
	GraphQLAuthGuard,
	GraphQLRolesGuard,
	GraphQLPublicGuard,
	GraphQLRateLimitGuard,
	QueryComplexityGuard,
} from './graphql/guards/index.js';

// Interceptors
export {
	GraphQLLoggingInterceptor,
	GraphQLPerformanceInterceptor,
	GraphQLErrorInterceptor,
	GraphQLCacheInterceptor,
	GraphQLPerformanceMonitoringInterceptor,
	BsonResponseInterceptor,
} from './graphql/interceptors/index.js';

// Pipes
export {
	GraphQLValidationPipe,
	GraphQLInputValidationPipe,
} from './graphql/pipes/index.js';

// Services
export {
	RateLimitService,
	MemoryRateLimitStorage,
	GraphQLCacheService,
	GraphQLPerformanceService,
	BsonSerializationService,
	type IRateLimitResult,
	type IRateLimitConfig,
	type IRateLimitStorage,
	type IPerformanceMetrics,
	type IPerformanceStats,
} from './graphql/services/index.js';

// Decorators
export {
	Subscription,
	SubscriptionFilter,
	SubscriptionAuth,
	SUBSCRIPTION_METADATA,
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
	type ISubscriptionOptions,
} from './graphql/decorators/index.js';

// Context
export {
	GraphQLContextFactory,
	type IGraphQLContext,
	type IWebSocketContext,
	type IContextFactoryOptions,
} from './graphql/context/index.js';

// Errors
export {
	BaseApplicationError,
	createError,
	BadRequestError,
	UnauthorizedError,
	ForbiddenError,
	NotFoundError,
	ConflictError,
	InternalServerError,
	createGraphQLError,
	GRAPHQL_ERROR_CONFIGS,
	GraphqlError,
	RateLimitError,
	IValidationError as ValidationErrorClass,
	LegacyNotFoundError,
	LegacyValidationError,
	LegacyUnauthorizedError,
	LegacyForbiddenError,
	LegacyConflictError,
	LegacyRateLimitError,
	type IErrorConfig,
	type TErrorType,
	type IGraphQLErrorConfig,
	type TGraphQLErrorType,
	BaseErrorConfigs,
	BaseBadRequestError,
	BaseUnauthorizedError,
	BaseForbiddenError,
	BaseNotFoundError,
	BaseConflictError,
	BaseUnprocessableEntityError,
	BaseInternalServerError,
	BaseBadGatewayError,
	BaseServiceUnavailableError,
	BaseGatewayTimeoutError,
} from './graphql/errors/index.js';

// Loaders
export {
	DataLoaderFactory,
	DataLoaderRegistry,
	IComment,
	CommentLoader,
	CommentsByPostLoader,
	CommentsByUserLoader,
	IOrder,
	OrderLoader,
	OrdersByUserLoader,
	IProduct,
	ProductLoader,
	ITag,
	TagLoader,
	IUser,
	UserLoader,
	type IBatchLoadFn,
	type IDataLoaderOptions,
} from './graphql/loaders/index.js';
