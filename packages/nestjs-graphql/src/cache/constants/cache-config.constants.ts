/**
 * Cache Configuration Constants
 *
 * Constants for cache service timeouts, buffer sizes, and operational thresholds.
 */

// Retry configuration
export const CACHE_RETRY_DELAY_MS = 5; // milliseconds
export const CACHE_RETRY_MAX_ATTEMPTS = 60;

// Timeout configuration (milliseconds)
export const CACHE_OPERATION_TIMEOUT_MS = 1_000;
export const CACHE_COMMAND_TIMEOUT_MS = 5_000;

// Buffer and pool sizes
export const CACHE_BUFFER_SIZE = 512; // bytes
export const CACHE_POOL_SIZE = 100; // connections
export const CACHE_MAX_KEY_LENGTH = 512; // bytes

// Memory management
export const CACHE_MAX_OPERATION_TIMINGS = 10_000;
export const CACHE_OPERATION_TIMING_MAX_AGE_MS = 3_600_000; // 1 hour
export const CACHE_CLEANUP_INTERVAL_MS = 600_000; // 10 minutes

// Statistics logging
export const CACHE_STATS_LOG_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutes

// Histogram bucket sizes (for metrics)
export const CACHE_SIZE_BUCKET_100B = 100;
export const CACHE_SIZE_BUCKET_1KB = 1_000;
export const CACHE_SIZE_BUCKET_10KB = 10_000;
export const CACHE_SIZE_BUCKET_100KB = 100_000;
export const CACHE_SIZE_BUCKET_1MB = 1_024_000;
export const CACHE_SIZE_BUCKET_1024KB = 1_024; // Alternative naming

// Percentile thresholds (disable magic numbers for these as they're histogram buckets)
// [50, 95, 99] - see base-cache.service.ts line 690-714 for context

// Cache Interceptor Configuration
export const CACHE_INTERCEPTOR_DEFAULT_TTL = 300; // 5 minutes in seconds
export const CACHE_ETAG_BASE64_SUBSTRING_LENGTH = 16; // Base64 substring length for ETag
