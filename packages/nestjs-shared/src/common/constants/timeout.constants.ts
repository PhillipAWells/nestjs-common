/**
 * Service Timeout Constants
 * Timeout values for various external services and operations
 * All timeouts can be overridden via environment variables for operational flexibility
 * All timeout getters are functions to allow runtime override via process.env
 */

// Default timeout values in milliseconds
const DEFAULT_GRAFANA_TIMEOUT_MS = 1_000;
const DEFAULT_LOKI_TIMEOUT_MS = 1_000;
const DEFAULT_PROMETHEUS_TIMEOUT_MS = 1_000;
const DEFAULT_HTTP_CLIENT_TIMEOUT_MS = 30_000;
const DEFAULT_CONFIG_VALIDATION_TIMEOUT_MS = 3_000;

/** Grafana API request timeout in milliseconds (configurable via GRAFANA_TIMEOUT env var) */
export function getGrafanaTimeout(): number {
	return Number(process.env['GRAFANA_TIMEOUT'] ?? DEFAULT_GRAFANA_TIMEOUT_MS);
}

/** Loki API request timeout in milliseconds (configurable via LOKI_TIMEOUT env var) */
export function getLokiTimeout(): number {
	return Number(process.env['LOKI_TIMEOUT'] ?? DEFAULT_LOKI_TIMEOUT_MS);
}

/** Prometheus API request timeout in milliseconds (configurable via PROMETHEUS_TIMEOUT env var) */
export function getPrometheusTimeout(): number {
	return Number(process.env['PROMETHEUS_TIMEOUT'] ?? DEFAULT_PROMETHEUS_TIMEOUT_MS);
}

/** HTTP client default timeout in milliseconds (configurable via HTTP_CLIENT_TIMEOUT env var, default: 30 seconds) */
export function getHttpClientTimeout(): number {
	return Number(process.env['HTTP_CLIENT_TIMEOUT'] ?? DEFAULT_HTTP_CLIENT_TIMEOUT_MS);
}

/** Config validation timeout in milliseconds (configurable via CONFIG_VALIDATION_TIMEOUT env var) */
export function getConfigValidationTimeout(): number {
	return Number(process.env['CONFIG_VALIDATION_TIMEOUT'] ?? DEFAULT_CONFIG_VALIDATION_TIMEOUT_MS);
}

/** Deprecated: Use getGrafanaTimeout() instead. Will be removed in next major version. */
export const GRAFANA_TIMEOUT = getGrafanaTimeout();

/** Deprecated: Use getLokiTimeout() instead. Will be removed in next major version. */
export const LOKI_TIMEOUT = getLokiTimeout();

/** Deprecated: Use getPrometheusTimeout() instead. Will be removed in next major version. */
export const PROMETHEUS_TIMEOUT = getPrometheusTimeout();

/** Deprecated: Use getHttpClientTimeout() instead. Will be removed in next major version. */
export const HTTP_CLIENT_TIMEOUT = getHttpClientTimeout();

/** Deprecated: Use getConfigValidationTimeout() instead. Will be removed in next major version. */
export const CONFIG_VALIDATION_TIMEOUT = getConfigValidationTimeout();

/** Time conversion: microseconds to nanoseconds */
export const MICROSECONDS_TO_NANOSECONDS = 1_000_000;
