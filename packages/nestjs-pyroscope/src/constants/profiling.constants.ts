// Metrics status codes
export const METRICS_STATUS_OK = 200;
export const METRICS_STATUS_REDIRECT_MIN = 300;

// Utility constants for profiling utilities
export const PROFILING_UTILS_TIMEOUT = 1000;
export const PROFILING_UTILS_MEMORY_THRESHOLD = 30000;

export const PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD = 1000;
export const PROFILING_RETRY_BASE_DELAY_MS = 100;
export const PROFILING_RETRY_MAX_DELAY_MS = 10000;
export const PROFILING_RETRY_JITTER_MS = 1000;
export const PROFILING_TAG_MAX_LENGTH = 200;

// Service internal limits
export const PROFILING_MAX_METRICS_HISTORY = 1000;
export const PROFILING_MAX_ACTIVE_PROFILES = 10000;

// Rounding precision for response time (2 decimal places)
export const PROFILING_RESPONSE_TIME_PRECISION = 100;

// Random ID generation radix and substring bounds
export const PROFILING_ID_RADIX = 36;
export const PROFILING_ID_SUBSTR_END = 11;

// Duration formatting threshold in milliseconds
export const PROFILING_DURATION_SECONDS_THRESHOLD = 1000;

// Percentile divisor (converts percentage 0–100 to fraction 0–1)
export const PROFILING_PERCENTILE_DIVISOR = 100;
