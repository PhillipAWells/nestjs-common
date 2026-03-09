// ============================================================================
// Cache Module Exports
// ============================================================================
export { CacheModule } from './cache/cache.module.js';
export { CacheService } from './cache/cache.service.js';
export { CacheInterceptor } from './cache/cache.interceptor.js';

// Base interceptor and strategies
export { BaseCacheInterceptor } from './cache/interceptors/base-cache.interceptor.js';
export type {
	CacheKeyGenerator,
	CacheMetadataExtractor,
	CacheContextHandler
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
	RedisConnectionInfo
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
export * from './graphql/subscriptions/index.js';

// Guards
export * from './graphql/guards/index.js';

// Interceptors
export * from './graphql/interceptors/index.js';

// Pipes
export * from './graphql/pipes/index.js';

// Services
export * from './graphql/services/index.js';

// Decorators
export * from './graphql/decorators/index.js';

// Context
export * from './graphql/context/index.js';

// Errors
export * from './graphql/errors/index.js';

// Loaders
export * from './graphql/loaders/index.js';
