/**
 * Cache statistics interface
 */
export interface CacheStats {
	hits: number;
	misses: number;
	sets: number;
	deletes: number;
	clears: number;
	errors: number;
	hitRate: number;
}

/**
 * Cache configuration interface
 */
export interface CacheConfig {
	defaultTtl: number;
	enableMetrics: boolean;
	keyPrefix: string;
}

/**
 * Cache key builder function type
 */
export type CacheKeyBuilder = (...args: any[]) => string;

/**
 * Cache invalidation strategy enum
 */
export enum CacheInvalidationStrategy {
	IMMEDIATE = 'immediate',
	DELAYED = 'delayed',
	PATTERN = 'pattern',
	TIME_BASED = 'time_based',
}

/**
 * Cache metrics interface
 */
export interface CacheMetrics {
	totalRequests: number;
	cacheHits: number;
	cacheMisses: number;
	hitRate: number;
	averageResponseTime: number;
	memoryUsage: number;
	uptime: number;
}

/**
 * Cache entry metadata
 */
export interface CacheEntryMetadata {
	key: string;
	ttl: number;
	createdAt: Date;
	lastAccessedAt?: Date;
	accessCount: number;
	size?: number;
}

/**
 * Cache operation result
 */
export interface CacheOperationResult<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	duration: number;
}

/**
 * Cache warming options
 */
export interface CacheWarmingOptions {
	enabled: boolean;
	interval: number; // in milliseconds
	keys: string[];
	priority: 'low' | 'medium' | 'high';
}

/**
 * Cache invalidation options
 */
export interface CacheInvalidationOptions {
	strategy: CacheInvalidationStrategy;
	delay?: number; // for delayed invalidation
	pattern?: string; // for pattern-based invalidation
	ttl?: number; // for time-based invalidation
}

/**
 * Redis connection status enumeration
 *
 * Represents the current state of the Redis connection used by the cache module.
 * Used to track connection lifecycle and health monitoring.
 */
export enum RedisConnectionStatus {
	/** Redis connection is established and operational */
	CONNECTED = 'connected',
	/** Redis connection is closed and no attempt to reconnect is in progress */
	DISCONNECTED = 'disconnected',
	/** Initial connection attempt in progress */
	CONNECTING = 'connecting',
	/** Reconnection attempt in progress after a previous failure */
	RECONNECTING = 'reconnecting',
	/** An error occurred during connection or operation */
	ERROR = 'error',
}

/**
 * Redis connection info
 */
export interface RedisConnectionInfo {
	status: RedisConnectionStatus;
	host: string;
	port: number;
	db: number;
	connectedClients?: number;
	uptime?: number;
	memoryUsage?: number;
	lastError?: string;
}
