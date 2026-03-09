// Main exports
export { CacheModule } from './cache.module.js';
export { CacheService } from './cache.service.js';
export { CacheInterceptor } from './cache.interceptor.js';

// Base interceptor and strategies
export { BaseCacheInterceptor } from './interceptors/base-cache.interceptor.js';
export type {
	CacheKeyGenerator,
	CacheMetadataExtractor,
	CacheContextHandler
} from './interceptors/base-cache.interceptor.js';

// Configuration
export { getRedisConfig, getRedisConnectionOptions, createRedisOptions } from './redis.config.js';
export type { RedisConfig, RedisConnectionOptions } from './redis.config.js';

// Types
export type {
	CacheStats,
	CacheConfig,
	CacheKeyBuilder,
	CacheMetrics,
	CacheEntryMetadata,
	CacheOperationResult,
	CacheWarmingOptions,
	CacheInvalidationOptions,
	RedisConnectionInfo
} from './cache.types.js';
export { CacheInvalidationStrategy, RedisConnectionStatus } from './cache.types.js';

// Decorators
export { Cacheable } from './decorators/cacheable.decorator.js';
export { CacheEvict } from './decorators/cache-evict.decorator.js';
export { CacheInvalidate } from './decorators/cache-invalidate.decorator.js';

// Base decorator metadata and interfaces
export type { BaseCacheableOptions, BaseCacheInvalidateOptions } from './decorators/cache-metadata.js';
export { CACHE_METADATA_KEYS } from './decorators/cache-metadata.js';
export type { CacheMetadataKey } from './decorators/cache-metadata.js';
