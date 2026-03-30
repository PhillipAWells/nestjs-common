/**
 * @packageDocumentation
 *
 * Foundational NestJS infrastructure library providing essential utilities for building secure, observable, and maintainable applications.
 *
 * ## Key Features
 *
 * - **Error Handling**: Structured error responses with categorization (transient/permanent) and automatic sanitization
 * - **Logging**: Centralized, structured logging with automatic redaction of sensitive data
 * - **Metrics**: Prometheus metrics with automatic HTTP request tracking and custom metric support
 * - **Validation**: Automatic DTO validation and transformation with comprehensive error formatting
 * - **CSRF Protection**: Double-Submit Cookie pattern with per-IP rate limiting
 * - **Security**: Global filters, guards, and interceptors for standardized protection
 * - **Configuration**: Type-safe environment variable access with Joi validation
 * - **Lazy Loading**: Defer dependency resolution to avoid circular dependencies
 * - **Audit Logging**: Security event logging for compliance and forensics
 * - **Health Checks**: Kubernetes-ready liveness, readiness, and general health probes
 * - **HTTP Client**: Robust HTTP client with timeout, SSL/TLS, and sensitive data redaction
 *
 * ## Quick Start
 *
 * @example
 * ```typescript
 * import { Module } from '@nestjs/common';
 * import { ConfigModule, CommonModule } from '@pawells/nestjs-shared';
 *
 * @Module({
 *   imports: [
 *     ConfigModule,     // MUST come first
 *     CommonModule,     // Depends on ConfigModule
 *   ],
 * })
 * export class AppModule {}
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *   const port = process.env['PORT'] ?? 3000;
 *   await app.listen(port);
 * }
 * ```
 *
 * ## Modules
 *
 * - **ConfigModule**: Environment configuration with validation (must be imported first)
 * - **CommonModule**: Global infrastructure (filters, interceptors, pipes, services)
 * - **MetricsModule**: Prometheus metrics endpoint and collection
 */

// ============================================================================
// Metrics Exporter Interfaces
// ============================================================================
export type { IMetricsExporter, MetricDescriptor, MetricValue, MetricType } from './common/interfaces/metrics-exporter.interface.js';
export { InstrumentationRegistry } from './common/registry/instrumentation-registry.js';

// ============================================================================
// Common Module Exports
// ============================================================================
export {
	GlobalExceptionFilter,
	HttpExceptionFilter,
	LoggingInterceptor,
	HTTPMetricsInterceptor,
	BaseValidationPipe,
	ValidationPipe,
	RequestProperty,
	getNestedProperty,
	getRequestFromContext,
	createRequestPropertyDecorator,
	createConditionalDecorator,
	createValidatingDecorator,
	createTransformingDecorator,
	BaseDecoratorOptions,
	ConditionalDecoratorOptions,
	ValidatingDecoratorOptions,
	TransformingDecoratorOptions,
	Query,
	Params,
	Body,
	Headers,
	Cookies,
	LogContext,
	GRAFANA_TIMEOUT,
	LOKI_TIMEOUT,
	PROMETHEUS_TIMEOUT,
	HTTP_CLIENT_TIMEOUT,
	CONFIG_VALIDATION_TIMEOUT,
	LogEntry,
	LogLevel,
	LogMetadata,
	LOG_LEVEL_STRINGS,
	ILogger,
	IContextualLogger,
	AppLogger,
	NestLoggerAdapter,
	AuditLoggerService,
	ErrorSanitizerService,
	ErrorCategorizerService,
	HttpClientService,
	CSRFService,
	MetricsRegistryService,
	HealthCheckService,
	HealthStatus,
	BaseMetricsCollector,
	MetricsController,
	CSRFGuard,
	MetricsGuard,
	CommonModule,
	MetricsModule,
	SharedThrottlerModule,
	type SharedThrottlerConfig,
	BaseApplicationError,
	createError,
	ERROR_CONFIGS,
	ErrorConfig,
	ErrorType,
	BadRequestError as CommonBadRequestError,
	UnauthorizedError as CommonUnauthorizedError,
	ForbiddenError as CommonForbiddenError,
	NotFoundError as CommonNotFoundError,
	ConflictError as CommonConflictError,
	UnprocessableEntityError as CommonUnprocessableEntityError,
	InternalServerError as CommonInternalServerError,
	BadGatewayError as CommonBadGatewayError,
	ServiceUnavailableError as CommonServiceUnavailableError,
	GatewayTimeoutError as CommonGatewayTimeoutError,
	ApplySecurityMiddleware,
	SecurityBootstrapOptions,
	CreateRateLimitConfig,
	RateLimitConfig,
	RateLimitDescriptor,
	LazyGetter,
	OptionalLazyGetter,
	TokenLazyGetter,
	LazyModuleRefService,
	LazyModuleRefBase,
	LazyGetterDependencies,
	OptionalGetterConfig,
	CreateMemoizedLazyGetter as createMemoizedLazyGetter,
	CreateOptionalLazyGetter as createOptionalLazyGetter,
	IsLazyModuleRefService as isLazyModuleRefService,
	LazyGetterNamingConventions,
	type IHealthCheck,
	getErrorStack,
	getErrorMessage,
	AsyncModuleOptions,
	createAsyncOptionsProvider,
	createAsyncProviders,
} from './common/index.js';

// ============================================================================
// Config Module Exports
// ============================================================================
export {
	ConfigService,
	ValidationService,
	ConfigModule,
	AppConfig,
	DatabaseConfig,
	CacheConfig as ConfigCacheConfig,
	AuthConfig,
	ValidationResult,
	ConfigSchema,
	EnvironmentOptions,
	CreateValidationSchema,
	ValidateConfig,
	CreateStringSchema,
	CreateNumberSchema,
	CreateBooleanSchema,
	CreateUriSchema,
	CreatePortSchema,
	CreateEnvironmentSchema,
	CreateJwtExpirationSchema,
} from './config/index.js';

// ============================================================================
// Guards Exports
// ============================================================================
export { CustomThrottleGuard } from './guards/index.js';
