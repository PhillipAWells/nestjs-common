/**
 * Redis Configuration Constants
 *
 * Centralized constants for Redis configuration, connection limits, and timeouts.
 */

// Port configuration
export const REDIS_MAX_PORT = 65_535;
export const REDIS_DEFAULT_PORT = 6_379;

// Database configuration
export const REDIS_MIN_DB = 0;
export const REDIS_MAX_DB = 15;
export const REDIS_DEFAULT_DB = 0;

// Password validation
export const REDIS_MIN_PASSWORD_LENGTH = 8;

// Retry configuration
export const REDIS_DEFAULT_MAX_RETRIES = 3;

// Timeout configuration (milliseconds)
export const REDIS_DEFAULT_CONNECT_TIMEOUT = 60_000; // 60 seconds
export const REDIS_MIN_TIMEOUT = 100; // Minimum for any timeout
export const REDIS_DEFAULT_COMMAND_TIMEOUT = 5_000; // 5 seconds

// Network configuration
export const REDIS_IPV4_FAMILY = 4;
export const REDIS_IPV6_FAMILY = 6;
export const REDIS_DEFAULT_FAMILY = REDIS_IPV4_FAMILY;

// Keep-alive configuration (milliseconds)
export const REDIS_DEFAULT_KEEP_ALIVE = 30_000; // 30 seconds

// Retry delay (milliseconds)
export const REDIS_DEFAULT_RETRY_DELAY = 100; // 100ms

// Default key prefix for namespacing
export const REDIS_DEFAULT_KEY_PREFIX = 'cache:';
