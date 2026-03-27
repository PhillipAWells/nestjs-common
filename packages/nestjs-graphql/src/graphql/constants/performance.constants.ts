/**
 * GraphQL Performance Service Constants
 *
 * Thresholds and configuration for performance monitoring and optimization.
 */

// Performance thresholds (milliseconds)
export const SLOW_OPERATION_THRESHOLD_MS = 1_000; // 1 second
export const PERFORMANCE_WARNING_THRESHOLD_MS = 5_000; // 5 seconds

// Time conversion
export const MILLISECONDS_TO_SECONDS = 1_000;

// Metrics history and limits
export const MAX_METRICS_HISTORY = 10_000; // Keep last 10k metrics
export const DEFAULT_RECENT_METRICS_LIMIT = 100; // Default limit for recent metrics
export const DEFAULT_SLOW_OPERATIONS_LIMIT = 50; // Default limit for slow operations
export const DEFAULT_ERRORS_LIMIT = 50; // Default limit for error metrics

// Time range for statistics (milliseconds)
export const DEFAULT_STATS_TIME_RANGE_MS = 3_600_000; // 1 hour

// Percentiles for performance analysis
 
export const PERCENTILE_50 = 50;
 
export const PERCENTILE_95 = 95;
 
export const PERCENTILE_99 = 99;
