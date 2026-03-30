// Filters
export { GlobalExceptionFilter } from './filters/global-exception.filter.js';
export { HttpExceptionFilter } from './filters/http-exception.filter.js';

// Interceptors
export { LoggingInterceptor } from './interceptors/logging.interceptor.js';
export { HTTPMetricsInterceptor } from './interceptors/http-metrics.interceptor.js';

// Pipes
export { BaseValidationPipe } from './pipes/base-validation.pipe.js';
export { ValidationPipe } from './pipes/validation.pipe.js';

// Decorators
export * from './decorators/index.js';
export type { IBaseDecoratorOptions } from './decorators/index.js';
export * from './decorators/metric.decorators.js';

// Interfaces
export type { ILogContext, ILogEntry, ILogMetadata } from './interfaces/index.js';
export { LogLevel, LOG_LEVEL_STRINGS } from './interfaces/index.js';
export type { ILogger, IContextualLogger } from './interfaces/index.js';
export type { ICacheProvider } from './interfaces/index.js';
export { CACHE_PROVIDER } from './interfaces/index.js';

// Services
export { AppLogger } from './services/logger.service.js';
export { NestLoggerAdapter } from './services/nest-logger-adapter.service.js';
export { AuditLoggerService } from './services/audit-logger.service.js';
export { ErrorSanitizerService, ERROR_SANITIZER_OPTIONS, type IErrorSanitizerOptions } from './services/error-sanitizer.service.js';
export { ErrorCategorizerService } from './services/error-categorizer.service.js';
export { HttpClientService } from './services/http-client.service.js';
export { CSRFService } from './services/csrf.service.js';
export { MetricsRegistryService } from './services/metrics-registry.service.js';
export { HealthCheckService, HealthStatus, type IHealthCheck } from './services/health-check.service.js';

// Metrics
export { BaseMetricsCollector } from './metrics/index.js';

// Controllers
export { MetricsController } from './controllers/metrics.controller.js';

// Guards
export { CSRFGuard } from './guards/csrf.guard.js';
export { MetricsGuard } from './guards/metrics.guard.js';

// Modules
export { CommonModule } from './common.module.js';
export { MetricsModule } from './metrics.module.js';
export { SharedThrottlerModule, type ISharedThrottlerConfig } from './modules/throttler.module.js';

// Factories
export * from './factories/module-factory.js';
export { ApplySecurityMiddleware } from './factories/security-bootstrap.factory.js';
export type { ISecurityBootstrapOptions } from './factories/security-bootstrap.factory.js';
export { CreateRateLimitConfig } from './factories/rate-limit-config.factory.js';
export type { IRateLimitConfig, IRateLimitDescriptor } from './factories/rate-limit-config.factory.js';

// Utils - Lazy Module Ref Pattern
export * from './utils/lazy-getter.types.js';
export { LazyModuleRefBase } from './utils/lazy-getter.types.js';
export { escapeNewlines, sanitizeObject, sanitizeXss, MAX_SANITIZE_DEPTH } from './utils/sanitization.utils.js';
export { getErrorStack, getErrorMessage } from './utils/error.utils.js';
export { IAsyncModuleOptions, createAsyncOptionsProvider, createAsyncProviders } from './utils/module.utils.js';

// Constants
export * from './constants/http-status.constants.js';
export {
	GRAFANA_TIMEOUT,
	LOKI_TIMEOUT,
	PROMETHEUS_TIMEOUT,
	HTTP_CLIENT_TIMEOUT,
	CONFIG_VALIDATION_TIMEOUT,
} from './constants/timeout.constants.js';

// Errors
export * from './errors/index.js';
