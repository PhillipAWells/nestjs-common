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
export type { CacheModuleAsyncOptions } from './cache/cache.interfaces.js';
export { CacheService } from './cache/cache.service.js';
export { CacheInterceptor } from './cache/cache.interceptor.js';

// Base interceptor and strategies
export { BaseCacheInterceptor } from './cache/interceptors/base-cache.interceptor.js';
export type {
	CacheKeyGenerator,
	CacheMetadataExtractor,
	CacheContextHandler,
} from './cache/interceptors/base-cache.interceptor.js';

// Configuration
export { getRedisConfig, getRedisConnectionOptions, createRedisOptions } from './cache/redis.config.js';
export type { RedisConfig, RedisConnectionOptions } from './cache/redis.config.js';

// Types
export type {
	CacheStats,
	CacheConfig as CacheCacheConfig,
	CacheKeyBuilder,
	CacheMetrics,
	CacheEntryMetadata,
	CacheOperationResult,
	CacheWarmingOptions,
	CacheInvalidationOptions,
	RedisConnectionInfo,
} from './cache/cache.types.js';
export { CacheInvalidationStrategy, RedisConnectionStatus } from './cache/cache.types.js';

// Decorators
export { Cacheable } from './cache/decorators/cacheable.decorator.js';
export { CacheEvict } from './cache/decorators/cache-evict.decorator.js';
export { CacheInvalidate } from './cache/decorators/cache-invalidate.decorator.js';

// Base decorator metadata and interfaces
export type { BaseCacheableOptions, BaseCacheInvalidateOptions } from './cache/decorators/cache-metadata.js';
export { CACHE_METADATA_KEYS } from './cache/decorators/cache-metadata.js';
export type { CacheMetadataKey } from './cache/decorators/cache-metadata.js';

// ============================================================================
// GraphQL Module Exports
// ============================================================================

// GraphQL Core
export { GraphQLModule, GraphQLService } from './graphql/graphql/index.js';
export type { GraphQLConfigOptions, GraphQLAsyncConfig } from './graphql/graphql/index.js';

// Scalars
export { ObjectIdScalar, DateTimeScalar, JSONScalar } from './graphql/graphql/index.js';

// Types
export { PageInfo, Connection, Edge, CursorUtils } from './graphql/graphql/index.js';

// Enums
export { SortDirection } from './graphql/graphql/index.js';

// Error Handling
export { GraphQLErrorFormatter, GraphQLErrorCode } from './graphql/graphql/index.js';
export type { GraphQLErrorExtensions, ValidationError } from './graphql/graphql/index.js';

// Subscriptions
export {
	SubscriptionService,
	RedisPubSubFactory,
	WebSocketServer,
	WebSocketAuthService,
	ConnectionManagerService,
	ResilienceService,
	type SubscriptionConfig,
	type WebSocketConfig,
	type AuthConfig,
	type ConnectionConfig,
	type ResilienceConfig,
	type WebSocketServerConfig,
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
	type RateLimitResult,
	type RateLimitConfig,
	type RateLimitStorage,
	type PerformanceMetrics,
	type PerformanceStats,
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
	type SubscriptionOptions,
} from './graphql/decorators/index.js';

// Context
export {
	GraphQLContextFactory,
	type GraphQLContext,
	type WebSocketContext,
	type ContextFactoryOptions,
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
	ValidationError as ValidationErrorClass,
	LegacyNotFoundError,
	LegacyValidationError,
	LegacyUnauthorizedError,
	LegacyForbiddenError,
	LegacyConflictError,
	LegacyRateLimitError,
	type ErrorConfig,
	type ErrorType,
	type GraphQLErrorConfig,
	type GraphQLErrorType,
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
	Comment,
	CommentLoader,
	CommentsByPostLoader,
	CommentsByUserLoader,
	Order,
	OrderLoader,
	OrdersByUserLoader,
	Product,
	ProductLoader,
	Tag,
	TagLoader,
	User,
	UserLoader,
	type BatchLoadFn,
	type DataLoaderOptions,
} from './graphql/loaders/index.js';
