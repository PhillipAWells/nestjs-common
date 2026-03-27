import { metrics, type Attributes, type Counter, type Histogram, type Meter, type MetricOptions, type UpDownCounter } from '@opentelemetry/api';
import {
	ATTR_HTTP_REQUEST_METHOD,
	ATTR_HTTP_RESPONSE_STATUS_CODE,
	ATTR_HTTP_ROUTE,
} from '@opentelemetry/semantic-conventions/incubating';

/**
 * Maximum number of cached meters before evicting oldest entries
 */
const MAX_METER_CACHE_SIZE = 100;

/**
 * Global meter cache to ensure singleton meters per name
 */
const meterCache = new Map<string, Meter>();

/**
 * Get a meter for creating metrics.
 * Meters are cached by name to ensure singleton behavior.
 *
 * @param name - Meter name (typically service or module name)
 * @param version - Meter version (optional)
 * @returns Meter instance
 */
export function getMeter(
	name: string,
	version?: string,
): Meter {
	const cacheKey = version ? `${name}@${version}` : name;
	// Return cached meter if exists
	const cached = meterCache.get(cacheKey);
	if (cached !== undefined) {
		return cached;
	}
	// Evict oldest entry if cache is full (simple FIFO)
	if (meterCache.size >= MAX_METER_CACHE_SIZE) {
		const firstKey = meterCache.keys().next().value as string | undefined;
		if (typeof firstKey === 'string') {
			meterCache.delete(firstKey);
		}
	}
	// Get meter from global provider
	const meter = version ? metrics.getMeter(name, version) : metrics.getMeter(name);
	meterCache.set(cacheKey, meter);
	return meter;
}

/**
 * Create a counter metric.
 *
 * @param name - Metric name (should follow OpenTelemetry naming conventions)
 * @param options - Metric options
 * @param meterName - Optional meter name (defaults to '@pawells/nestjs-open-telemetry')
 * @returns Counter instance
 */
export function createCounter(
	name: string,
	options?: MetricOptions,
	meterName = '@pawells/nestjs-open-telemetry',
): Counter {
	const meter = getMeter(meterName);
	return meter.createCounter(name, options);
}

/**
 * Create a histogram metric.
 *
 * @param name - Metric name
 * @param options - Metric options
 * @param meterName - Optional meter name (defaults to '@pawells/nestjs-open-telemetry')
 * @returns Histogram instance
 */
export function createHistogram(
	name: string,
	options?: MetricOptions,
	meterName = '@pawells/nestjs-open-telemetry',
): Histogram {
	const meter = getMeter(meterName);
	return meter.createHistogram(name, options);
}

/**
 * Create an up-down counter metric.
 *
 * @param name - Metric name
 * @param options - Metric options
 * @param meterName - Optional meter name (defaults to '@pawells/nestjs-open-telemetry')
 * @returns UpDownCounter instance
 */
export function createUpDownCounter(
	name: string,
	options?: MetricOptions,
	meterName = '@pawells/nestjs-open-telemetry',
): UpDownCounter {
	const meter = getMeter(meterName);
	return meter.createUpDownCounter(name, options);
}

/**
 * Lazy-initialized HTTP server metrics following OpenTelemetry semantic conventions.
 * These metrics are created on first access, after SDK initialization.
 */
let cachedHttpMetrics: {
	requests: Counter;
	duration: Histogram;
	activeRequests: UpDownCounter;
	requestSize: Histogram;
	responseSize: Histogram;
} | null = null;

/**
 * Get or initialize HTTP metrics.
 * @internal
 * @private
 */
function getHttpMetrics(): {
	readonly requests: Counter;
	readonly duration: Histogram;
	readonly activeRequests: UpDownCounter;
	readonly requestSize: Histogram;
	readonly responseSize: Histogram;
} {
	if (cachedHttpMetrics !== null) {
		return cachedHttpMetrics;
	}
	cachedHttpMetrics = {
		requests: createCounter('http.server.request.count', {
			description: 'Total HTTP requests',
			unit: '1',
		}),
		duration: createHistogram('http.server.request.duration', {
			description: 'HTTP request duration',
			unit: 'ms',
		}),
		activeRequests: createUpDownCounter('http.server.active_requests', {
			description: 'Active HTTP requests',
			unit: '1',
		}),
		requestSize: createHistogram('http.server.request.size', {
			description: 'HTTP request body size',
			unit: 'bytes',
		}),
		responseSize: createHistogram('http.server.response.size', {
			description: 'HTTP response body size',
			unit: 'bytes',
		}),
	};
	return cachedHttpMetrics;
}

/**
 * Record HTTP request metrics automatically.
 * This is a convenience function that records all relevant HTTP metrics
 * following OpenTelemetry semantic conventions.
 *
 * Metrics are lazily initialized on first access. If OpenTelemetry is not initialized,
 * metrics will be silently dropped (no-op behavior).
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param route - HTTP route pattern (/users/:id)
 * @param statusCode - HTTP response status code
 * @param duration - Request duration in milliseconds
 * @param requestSize - Optional request body size in bytes
 * @param responseSize - Optional response body size in bytes
 *
 * @example
 * ```typescript
 * recordHttpMetrics('GET', '/users/:id', 200, 45.2, 0, 1024);
 * ```
 */
export function recordHttpMetrics(
	method: string,
	route: string,
	statusCode: number,
	duration: number,
	requestSize?: number,
	responseSize?: number,
): void {
	const attributes = {
		[ATTR_HTTP_REQUEST_METHOD]: method,
		[ATTR_HTTP_ROUTE]: route,
		[ATTR_HTTP_RESPONSE_STATUS_CODE]: statusCode,
	};

	const httpMetrics = getHttpMetrics();

	// Record request count
	httpMetrics.requests.add(1, attributes);
	// Record duration
	httpMetrics.duration.record(duration, attributes);
	// Record sizes if provided
	if (requestSize !== undefined) {
		httpMetrics.requestSize.record(requestSize, attributes);
	}
	if (responseSize !== undefined) {
		httpMetrics.responseSize.record(responseSize, attributes);
	}
}

/**
 * Track active HTTP requests.
 * Call with delta=1 when request starts, delta=-1 when request completes.
 *
 * Metrics are lazily initialized on first access. If OpenTelemetry is not initialized,
 * calls will be silently dropped (no-op behavior).
 *
 * @param delta - Change in active requests (+1 or -1)
 * @param attributes - Optional attributes
 *
 * @example
 * ```typescript
 * // Request started
 * trackActiveRequests(1, { method: 'GET' });
 *
 * // Request completed
 * trackActiveRequests(-1, { method: 'GET' });
 * ```
 */
export function trackActiveRequests(delta: number, attributes?: Attributes): void {
	const httpMetrics = getHttpMetrics();
	httpMetrics.activeRequests.add(delta, attributes);
}

/**
 * Reset cached HTTP metrics to null.
 * Used for test isolation and cleanup.
 * @internal
 * @private
 */
export function resetHttpMetrics(): void {
	cachedHttpMetrics = null;
}
