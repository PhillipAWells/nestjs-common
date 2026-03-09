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
 * Redis connection status
 */
export enum RedisConnectionStatus {
	CONNECTED = 'connected',
	DISCONNECTED = 'disconnected',
	CONNECTING = 'connecting',
	RECONNECTING = 'reconnecting',
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
