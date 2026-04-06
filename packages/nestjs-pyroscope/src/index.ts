/** @packageDocumentation */

// Public API exports

// Profiling decorators
export {
	Profile,
	ProfileMethod,
	ProfileAsync,
} from './decorators/profile.decorator.js';

// Profiling service
export { PyroscopeService } from './service.js';

// Module
export { PyroscopeModule } from './module.js';

// Error classes
export { PyroscopeError } from './errors/pyroscope.errors.js';

// Metrics service
export { MetricsService } from './services/metrics.service.js';
export type { IMetricsResponse } from './services/metrics.service.js';

// Profiling interceptors
export { ProfilingInterceptor } from './interceptors/profiling.interceptor.js';

// Health monitoring
export { ProfilingHealthIndicator } from './indicators/profiling.health.js';
export { HealthController } from './controllers/health.controller.js';
export type { IHealthResponse } from './controllers/health.controller.js';

// Profiling interfaces and types
export type {
	IPyroscopeConfig,
	TProfileType,
	IProfileMetrics,
	IProfileContext,
} from './interfaces/profiling.interface.js';

// Module configuration interfaces
export type {
	IPyroscopeModuleOptions,
	IPyroscopeModuleAsyncOptions,
} from './interfaces/module.interface.js';

// Profiling utilities and helpers
export {
	ProfilingConfigValidator,
	TagFormatter,
	MetricAggregator,
	ProfilingErrorHandler,
	GenerateProfileId,
	FormatDuration,
	IsProfilingEnabled,
} from './utils/profiling.utils.js';
