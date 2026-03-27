/**
 * HTTP status codes used for request classification.
 *
 * Successful requests: 200-399 (2xx success + 3xx redirects)
 * Client/server errors: 400+
 */
export const METRICS_STATUS_OK = 200;
export const METRICS_STATUS_CLIENT_ERROR_MIN = 400;

/**
 * Utility constants for profiling utilities.
 * @internal
 */
export const PROFILING_UTILS_TIMEOUT = 1000;
export const PROFILING_UTILS_MEMORY_THRESHOLD = 30000;

/**
 * Threshold for considering the profiling service degraded.
 * If active profiles exceed this count, the service is marked as degraded.
 */
export const PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD = 1000;

/**
 * Exponential backoff configuration for retry logic.
 *
 * - PROFILING_RETRY_BASE_DELAY_MS: Initial delay (100ms)
 * - PROFILING_RETRY_MAX_DELAY_MS: Maximum delay cap (10s)
 * - PROFILING_RETRY_JITTER_MS: Random jitter to add (1s)
 */
export const PROFILING_RETRY_BASE_DELAY_MS = 100;
export const PROFILING_RETRY_MAX_DELAY_MS = 10000;
export const PROFILING_RETRY_JITTER_MS = 1000;

/**
 * Maximum length for individual tag values (characters).
 * Longer values are truncated to prevent resource exhaustion.
 */
export const PROFILING_TAG_MAX_LENGTH = 200;

/**
 * Service internal limits to prevent unbounded memory growth.
 *
 * - PROFILING_MAX_METRICS_HISTORY: Max metrics kept in memory (1000)
 * - PROFILING_MAX_ACTIVE_PROFILES: Max concurrent active profiles (10,000)
 */
export const PROFILING_MAX_METRICS_HISTORY = 1000;
export const PROFILING_MAX_ACTIVE_PROFILES = 10000;

/**
 * Rounding precision for response time metrics.
 * Used to round to 2 decimal places (100 = 0.01).
 */
export const PROFILING_RESPONSE_TIME_PRECISION = 100;

/**
 * Constants for random ID generation.
 *
 * - PROFILING_ID_RADIX: Base for random number (36 = alphanumeric)
 * - PROFILING_ID_SUBSTR_END: Substring length for ID portion (11 chars)
 */
export const PROFILING_ID_RADIX = 36;
export const PROFILING_ID_SUBSTR_END = 11;

/**
 * Length of the UUID-based unique portion of a profile ID.
 * crypto.randomUUID() produces a 32-char hex string (after removing dashes);
 * we take the first 9 characters for a compact unique suffix.
 */
export const PROFILING_ID_UUID_LENGTH = 9;

/**
 * Duration formatting threshold in milliseconds.
 * Durations >= 1000ms are formatted as seconds instead of milliseconds.
 */
export const PROFILING_DURATION_SECONDS_THRESHOLD = 1000;

/**
 * Percentile divisor (converts percentage 0–100 to fraction 0–1).
 * Used in metric aggregation calculations.
 */
export const PROFILING_PERCENTILE_DIVISOR = 100;

/**
 * Maximum age (milliseconds) for an active profile before it is considered stale and evicted.
 * Prevents unbounded memory growth from profiles that are started but never stopped (30 minutes).
 */
// eslint-disable-next-line no-magic-numbers
export const PROFILING_STALE_PROFILE_TIMEOUT_MS = 30 * 60 * 1000;
