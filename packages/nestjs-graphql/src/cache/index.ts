/**
 * Redis Cache Module
 *
 * Provides Redis-backed caching with:
 * - Automatic TTL management
 * - Cache statistics and metrics
 * - Decorator-based caching (@Cacheable, @CacheInvalidate, @CacheEvict)
 * - Configurable invalidation strategies
 * - HTTP interceptor for automatic response caching
 *
 * @packageDocumentation
 */

// Main exports
export { CacheModule } from './cache.module.js';
export type { ICacheModuleAsyncOptions } from './cache.interfaces.js';
export { CacheService } from './cache.service.js';
export { CacheInterceptor } from './cache.interceptor.js';

// Base interceptor and strategies
export { BaseCacheInterceptor } from './interceptors/base-cache.interceptor.js';
export type {
	ICacheKeyGenerator,
	ICacheMetadataExtractor,
	ICacheContextHandler,
} from './interceptors/base-cache.interceptor.js';

// Configuration
export { getRedisConfig, getRedisConnectionOptions, createRedisOptions } from './redis.config.js';
export type { IRedisConfig, IRedisConnectionOptions } from './redis.config.js';

// Types
export type {
	ICacheStats,
	ICacheConfig,
	TCacheKeyBuilder,
	ICacheMetrics,
	ICacheEntryMetadata,
	ICacheOperationResult,
	ICacheWarmingOptions,
	ICacheInvalidationOptions,
	IRedisConnectionInfo,
} from './cache.types.js';
export { CacheInvalidationStrategy, RedisConnectionStatus } from './cache.types.js';

// Decorators
export { Cacheable } from './decorators/cacheable.decorator.js';
export { CacheEvict } from './decorators/cache-evict.decorator.js';
export { CacheInvalidate } from './decorators/cache-invalidate.decorator.js';

// Base decorator metadata and interfaces
export type { IBaseCacheableOptions, IBaseCacheInvalidateOptions } from './decorators/cache-metadata.js';
export { CACHE_METADATA_KEYS } from './decorators/cache-metadata.js';
export type { TCacheMetadataKey } from './decorators/cache-metadata.js';
