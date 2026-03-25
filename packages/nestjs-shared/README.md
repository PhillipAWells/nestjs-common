# NestJS Shared Module

[![GitHub Release](https://img.shields.io/github/v/release/PhillipAWells/nestjs-common)](https://github.com/PhillipAWells/nestjs-common/releases)
[![CI](https://github.com/PhillipAWells/nestjs-common/actions/workflows/ci.yml/badge.svg)](https://github.com/PhillipAWells/nestjs-common/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-shared.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-shared)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/PhillipAWells?style=social)](https://github.com/sponsors/PhillipAWells)

Foundational NestJS infrastructure library providing filters, guards, interceptors, logging, CSRF protection, error handling, configuration, metrics, and lazy loading utilities.

## Installation

```bash
yarn add @pawells/nestjs-shared
```

## Requirements

- **Node.js**: >= 24.0.0
- **NestJS**: >= 10.0.0

## Peer Dependencies

```json
{
  "@nestjs/common": ">=10.0.0",
  "@nestjs/config": ">=3.0.0",
  "@nestjs/core": ">=10.0.0",
  "@nestjs/throttler": ">=5.0.0",
  "@opentelemetry/api": ">=1.0.0",
  "class-transformer": ">=0.5.0",
  "class-validator": ">=0.14.0",
  "compression": ">=1.0.0",
  "csrf-csrf": ">=3.0.0",
  "express": ">=4.0.0",
  "helmet": ">=7.0.0",
  "joi": ">=17.0.0",
  "prom-client": ">=15.0.0",
  "rxjs": ">=7.0.0",
  "xss": ">=1.0.0"
}
```

## Quick Start

### 1. Initialize ConfigModule (MUST come first)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@pawells/nestjs-shared';

@Module({
  imports: [
    ConfigModule,  // Must be first
  ],
})
export class AppModule {}
```

### 2. Import CommonModule

```typescript
import { Module } from '@nestjs/common';
import { CommonModule } from '@pawells/nestjs-shared';

@Module({
  imports: [
    ConfigModule,     // Must be first
    CommonModule,     // Depends on ConfigModule
  ],
})
export class AppModule {}
```

### 3. Use Global Filters and Interceptors

Global filters and interceptors are automatically registered by CommonModule:
- **GlobalExceptionFilter** & **HttpExceptionFilter**: Standardized error responses
- **LoggingInterceptor**: Request/response logging
- **HTTPMetricsInterceptor**: HTTP metrics collection
- **ValidationPipe**: Automatic DTO validation

All are applied globally and available for injection in services.

## Features

### Error Handling

Comprehensive error handling with structured responses, categorization, and sanitization.

```typescript
import {
  BaseApplicationError,
  GlobalExceptionFilter,
  ErrorCategorizerService,
  ErrorSanitizerService,
} from '@pawells/nestjs-shared';

// Create custom error
export class UserNotFoundError extends BaseApplicationError {
  constructor(userId: string) {
    super(`User ${userId} not found`, {
      code: 'USER_NOT_FOUND',
      statusCode: 404,
      context: { userId }
    });
  }
}

// Throw it
throw new UserNotFoundError('123');

// Automatically caught by GlobalExceptionFilter
// Response includes code, message, timestamp, sanitized context, stack (dev only)
```

**Error Categories**: Errors are automatically categorized as transient (retryable) or permanent (fail-fast) with recommended recovery strategies.

### Logging

Centralized, structured logging with automatic redaction of sensitive data.

```typescript
import { AppLogger } from '@pawells/nestjs-shared';

constructor(private logger: AppLogger) {}

// Flexible logging methods
this.logger.info('User created', 'UserService', { userId: '123' });
this.logger.debug('Cache hit', { metadata: { key: 'users:123' } });
this.logger.error('Database error', error.stack, { query: '...' });
this.logger.warn('Rate limit approaching', { context: 'RateLimiter' });
this.logger.fatal('System shutdown', { context: 'ShutdownService' });

// Automatic redaction of sensitive fields: passwords, tokens, API keys, emails, IPs
this.logger.info('Login attempt', { password: 'secret' });
// Logs: { password: '[REDACTED]' }

// OpenTelemetry integration: traceId and spanId automatically included
```

**Log Levels**: Controlled by LOG_LEVEL environment variable (debug, info, warn, error, fatal, silent).

### Metrics

Prometheus metrics for HTTP requests and custom metrics.

```typescript
import { MetricsRegistryService } from '@pawells/nestjs-shared';

constructor(private metrics: MetricsRegistryService) {}

// Record custom metrics
const orderCounter = this.metrics.createCounter(
  'orders_total',
  'Total orders processed'
);
orderCounter.inc({ status: 'completed' });

// HTTP metrics are automatic (duration, count, size)
// Access at GET /metrics in Prometheus format
const prometheusMetrics = await this.metrics.getMetrics();
```

**Features**:
- Automatic HTTP request metrics (duration histogram, request counter, size histogram)
- Dynamic path normalization (UUIDs, ObjectIDs, numeric IDs → `:id`) to prevent unbounded cardinality
- Default Node.js metrics collection
- Custom metric creation (counter, gauge, histogram)
- Controlled by METRICS_ENABLED environment variable (default: true)

### CSRF Protection

Double-Submit Cookie pattern with per-IP rate limiting.

```typescript
import { CSRFGuard, CSRFService } from '@pawells/nestjs-shared';

// Globally applied by CommonModule
// Or manually on specific controller
@UseGuards(CSRFGuard)
@Controller('api')
export class ApiController {
  constructor(private csrf: CSRFService) {}

  @Post('/form')
  async submitForm(@Req() req: Request, @Res() res: Response) {
    // Generate token
    const token = await this.csrf.generateToken(req, res);
    res.render('form', { csrfToken: token });
  }

  @Post('/process')
  async processForm(@Req() req: Request) {
    // Validation done automatically by CSRFGuard
    // Safe methods (GET, HEAD, OPTIONS) bypass validation
  }
}
```

**Features**:
- Token generation with rate limiting (10 per IP per 60s)
- Session binding or IP-based fallback
- Automatic pruning of stale timestamps
- Capacity monitoring with safety margins
- Configurable proxy trust for X-Forwarded-For header
- CSRF_SECRET entropy validation at startup

### Validation

Automatic DTO validation and transformation.

```typescript
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

@Post()
async createUser(@Body() dto: CreateUserDto) {
  // DTO automatically validated and transformed
  // Validation errors formatted as error array with field paths
}
```

**Features**:
- Automatic DTO validation via ValidationPipe
- Nested object support with path prefixes
- Comprehensive error formatting
- Class transformation with class-transformer

### Health Checks

Kubernetes-ready health, readiness, and liveness probes.

```typescript
import { HealthCheckService, HealthStatus } from '@pawells/nestjs-shared';

constructor(private health: HealthCheckService) {}

@Get('/health')
getHealth() {
  return this.health.getHealth('my-service', '1.0.0');
}

@Get('/ready')
getReadiness() {
  return this.health.getReadiness({
    database: HealthStatus.OK,
    cache: HealthStatus.OK,
  });
}

@Get('/live')
getLiveness() {
  return this.health.getLiveness();
}
```

### Configuration

Type-safe environment variable access with validation.

```typescript
import { ConfigService } from '@pawells/nestjs-shared';

constructor(private config: ConfigService) {}

// Type-safe getters
const port = this.config.getNumber('PORT') ?? 3000;
const nodeEnv = this.config.getString('NODE_ENV') ?? 'development';
const dbUrl = this.config.getOrThrow('DATABASE_URL');

// Validation
this.config.validate({
  PORT: { required: true },
  DATABASE_URL: { required: true },
  LOG_LEVEL: { required: false },
});
```

### Audit Logging

Security event logging for compliance and forensics.

```typescript
import { AuditLoggerService } from '@pawells/nestjs-shared';

constructor(private audit: AuditLoggerService) {}

// Log authentication
this.audit.logAuthenticationAttempt('user@example.com', true, '192.168.1.1');

// Log authorization failure
this.audit.logAuthorizationFailure('user-123', 'documents', 'delete', '192.168.1.1');

// Log CSRF violations
this.audit.logCsrfViolation('192.168.1.1', '/api/users');

// Log custom security events
this.audit.logSecurityEvent({
  userId: 'user-123',
  action: 'password_change',
  resource: 'users/123',
  result: 'success',
  ipAddress: '192.168.1.1'
});
```

### Lazy Loading

Defer dependency resolution to avoid circular dependencies.

```typescript
import {
  LazyGetter,
  LazyModuleRefService,
  createMemoizedLazyGetter,
} from '@pawells/nestjs-shared';

@Injectable()
export class MyService implements LazyModuleRefService {
  private readonly userService: LazyGetter<UserService> = createMemoizedLazyGetter(
    () => this.moduleRef.get(UserService, { strict: false }),
  );

  constructor(public readonly Module: ModuleRef) {}

  async getUser(id: string) {
    // UserService resolved lazily on first call
    return this.userService().getById(id);
  }
}
```

**Features**:
- LazyGetter<T>: Required dependency getter
- OptionalLazyGetter<T>: Optional dependency getter
- CreateMemoizedLazyGetter: Caching factory
- CreateOptionalLazyGetter: Safe optional resolution
- IsLazyModuleRefService: Type guard for pattern detection

### HTTP Client

Robust HTTP client with timeout, SSL/TLS, and sensitive data redaction.

```typescript
import { HttpClientService } from '@pawells/nestjs-shared';

constructor(private http: HttpClientService) {}

// GET request
const response = await this.http.get<User>('https://api.example.com/users/123');

// POST request with custom timeout
const response = await this.http.post<User>(
  'https://api.example.com/users',
  { name: 'John', email: 'john@example.com' },
  { timeout: 5000, correlationId: 'req-123' }
);

// HTTPS with custom CA certificate
const cert = fs.readFileSync('/path/to/ca.pem');
const response = await this.http.get(
  'https://internal-api.local/data',
  { ca: cert }
);
```

**Features**:
- Configurable timeouts (default: HTTP_CLIENT_TIMEOUT)
- SSL/TLS certificate validation (strict by default)
- Custom CA certificate support
- Payload size limit (10MB)
- Automatic content-type parsing
- Correlation ID support
- Sensitive data redaction in logs
- Duration tracking

### Decorators

Request property extractors for cleaner controller methods.

```typescript
import { Query, Params, Body, Headers, Cookies } from '@pawells/nestjs-shared';

@Controller('users')
export class UserController {
  @Get(':id')
  getUser(
    @Params('id') id: string,
    @Query('include') include?: string,
  ) {
    // Route params and query params extracted
  }

  @Post()
  createUser(
    @Body() dto: CreateUserDto,
    @Headers('authorization') auth?: string,
  ) {
    // Body and headers extracted
  }

  @Get()
  listUsers(@Cookies('sessionId') sessionId?: string) {
    // Cookies extracted
  }
}
```

## Core Modules

### CommonModule

Global module providing all shared infrastructure.

```typescript
// Automatically applied globally
@Global()
@Module({
  providers: [
    // Filters (global)
    GlobalExceptionFilter,
    HttpExceptionFilter,

    // Interceptors (global)
    LoggingInterceptor,
    HTTPMetricsInterceptor,

    // Pipe (global)
    ValidationPipe,

    // Services (injectable)
    AppLogger,
    AuditLoggerService,
    CSRFService,
    ErrorCategorizerService,
    ErrorSanitizerService,
    HttpClientService,
    MetricsRegistryService,
    HealthCheckService,
  ],
  exports: [...],
})
export class CommonModule {}
```

### ConfigModule

Configuration service with validation.

```typescript
@Module({
  imports: [ConfigModule],
  // ConfigService and ValidationService automatically available
})
export class AppModule {}
```

### MetricsModule

Prometheus metrics endpoint and collection.

```typescript
// Automatically imported by CommonModule
// Provides:
// - MetricsRegistryService (injectable)
// - GET /metrics endpoint (Prometheus format)
```

## API Reference

### Services

#### AppLogger
Structured logging service with context support, metadata, and automatic sensitive data redaction.

**Methods**:
- `debug(message, context?, metadata?)`: Debug level
- `info(message, context?, metadata?)`: Info level
- `warn(message, context?, metadata?)`: Warning level
- `error(message, trace?, context?, metadata?)`: Error level with optional stack trace
- `fatal(message, trace?, context?, metadata?)`: Fatal level with optional stack trace
- `createContextualLogger(context)`: Create child logger with context

#### ErrorCategorizerService
Classifies errors as transient/permanent and recommends recovery strategy.

**Methods**:
- `categorizeError(error)`: Returns ErrorCategory with type, retryable, strategy, backoffMs
- `isRetryable(error)`: Boolean check
- `logRecoveryAttempt(error, attempt, maxAttempts)`: Log retry attempt
- `logRecoverySuccess(error, attempts)`: Log successful recovery
- `logRecoveryFailed(error, attempts)`: Log failed recovery

#### ErrorSanitizerService
Removes sensitive information from error responses and logs.

**Methods**:
- `sanitizeErrorResponse(error, isDevelopment)`: Sanitize error for response
- `sanitizeMessage(message)`: Sanitize error message string

Redactions: File paths, database URIs, API keys, Bearer tokens, email addresses, IP addresses, sensitive field values.

#### CSRFService
CSRF token generation and validation with rate limiting.

**Methods**:
- `generateToken(req, res)`: Generate and set CSRF token (rate limited)
- `validateToken(req)`: Validate CSRF token
- `refreshToken(req, res)`: Generate new token after sensitive operation
- `getMiddleware()`: Get CSRF protection middleware

#### MetricsRegistryService
Prometheus metrics management.

**Methods**:
- `recordHttpRequest(method, route, statusCode, duration, size?)`: Record HTTP metrics
- `createCounter(name, help, labelNames?)`: Create counter metric
- `createGauge(name, help, labelNames?)`: Create gauge metric
- `createHistogram(name, help, labelNames?, buckets?)`: Create histogram metric
- `recordCounter(name, value?, labels?)`: Record counter value
- `recordGauge(name, value, labels?)`: Record gauge value
- `recordHistogram(name, value, labels?)`: Record histogram value
- `getMetrics()`: Get metrics in Prometheus format
- `getMetricsAsJSON()`: Get metrics as JSON
- `clear()`: Clear all metrics (testing)

#### HealthCheckService
Kubernetes health probes.

**Methods**:
- `getHealth(serviceName?, version?)`: General health check
- `getReadiness(checks?)`: Readiness probe (can receive traffic)
- `getLiveness()`: Liveness probe (is alive)

#### HttpClientService
HTTP client with timeout and SSL/TLS support.

**Methods**:
- `request<T>(options)`: Make HTTP request
- `get<T>(url, options?)`: GET request
- `post<T>(url, data?, options?)`: POST request
- `put<T>(url, data?, options?)`: PUT request
- `delete<T>(url, options?)`: DELETE request

#### ConfigService
Type-safe environment variable access.

**Methods**:
- `get<T>(propertyPath, defaultValue?)`: Get config value
- `getOrThrow<T>(propertyPath)`: Get or throw
- `getString(propertyPath, defaultValue?)`: Get as string
- `getNumber(propertyPath, defaultValue?)`: Get as number
- `validate(schema)`: Validate configuration

#### AuditLoggerService
Security event logging.

**Methods**:
- `logAuthenticationAttempt(email, success, ipAddress?, reason?)`
- `logAuthorizationFailure(userId, resource, action, ipAddress?)`
- `logTokenGeneration(userId, tokenType)`
- `logTokenRevocation(userId, reason)`
- `logRateLimitViolation(endpoint, ipAddress, limit)`
- `logCsrfViolation(ipAddress, endpoint)`
- `logConfigurationChange(userId, config, oldValue, newValue)`
- `logDataAccess(userId, resource, action)`
- `logSecurityEvent(entry)`

### Filters

#### GlobalExceptionFilter
Catches unhandled exceptions (except HttpException).

- Standardizes response format
- Sanitizes sensitive data
- Categorizes errors
- Logs with context

#### HttpExceptionFilter
Handles HTTP exceptions.

- Formats NestJS built-in exceptions
- Sanitizes responses
- Categorizes for logging

### Interceptors

#### LoggingInterceptor
Logs incoming requests and outgoing responses.

- Uses DEBUG level for /health and /metrics
- Uses INFO level for other requests
- Includes method, URL, IP, duration

#### HTTPMetricsInterceptor
Collects HTTP request metrics.

- Duration histogram
- Request counter
- Request size histogram
- Automatic route normalization

### Guards

#### CSRFGuard
Validates CSRF tokens on state-changing requests.

- Bypasses safe methods (GET, HEAD, OPTIONS)
- Enforces validation for POST/PUT/DELETE/PATCH
- Throws 403 on validation failure
- Logs violations to audit log

### Pipes

#### ValidationPipe
Validates DTOs using class-validator.

- Automatic transformation via class-transformer
- Nested object support with path prefixes
- Comprehensive error formatting

## Interfaces & Types

### ILogger
Basic logging interface without contextual logger creation.

### IContextualLogger
Extended logging with contextual logger creation.

### LazyModuleRefService
Interface for services using lazy ModuleRef pattern.

```typescript
interface LazyModuleRefService {
  Module: ModuleRef;
}
```

### LazyGetter<T>
Function that returns a dependency.

```typescript
type LazyGetter<T> = () => T;
```

### OptionalLazyGetter<T>
Function that returns a dependency or undefined.

```typescript
type OptionalLazyGetter<T> = () => T | undefined;
```

### ErrorCategory
Error classification for recovery strategy.

```typescript
interface ErrorCategory {
  type: 'transient' | 'permanent';
  retryable: boolean;
  strategy: 'retry' | 'fail' | 'backoff';
  backoffMs?: number;
}
```

### IHealthCheck
Health check response structure.

```typescript
interface IHealthCheck {
  status: string;
  timestamp: string;
  service?: string;
  version?: string;
  checks?: Record<string, string>;
}
```

## Conditional Exports

```typescript
// Main exports (all major classes and utilities)
import { AppLogger, CSRFService } from '@pawells/nestjs-shared';

// Common-only exports (lower-level utilities)
import { CSRFService } from '@pawells/nestjs-shared/common';

// Lazy loader types
import { LazyGetter } from '@pawells/nestjs-shared/common/utils/lazy-getter.types';
```

## Configuration

### Environment Variables

- **NODE_ENV**: development, production, etc. (affects error details, logging)
- **LOG_LEVEL**: debug, info, warn, error, fatal, silent (default: info)
- **PORT**: Server port (default: 3000)
- **CSRF_SECRET**: Required for CSRF protection (min 32 chars, high entropy)
- **METRICS_ENABLED**: Enable metrics (default: true)
- **SERVICE_NAME**: Service name for logging (default: unknown-service)

### CSRF_SECRET Generation

```bash
# Generate secure CSRF_SECRET
openssl rand -hex 32
```

## Security Defaults

- **Token Blacklist** (when implemented): Fails closed — treats unavailable cache as blacklist
- **CSRF Token Generation**: Per-IP rate limited (10 per 60s)
- **CSRF Validation**: Signed tokens with session/IP binding
- **Error Sanitization**: Stack traces only in development; sensitive fields redacted
- **CORS**: Implemented via security bootstrap (if configured)
- **HTTP Client**: Strict SSL/TLS certificate validation (rejectUnauthorized: true)
- **Metrics**: Dynamic path normalization prevents unbounded cardinality
- **Logging**: Automatic redaction of passwords, tokens, API keys, emails, IPs

## Examples

### Complete Application Setup

```typescript
import { NestFactory } from '@nestjs/core';
import { ConfigModule, CommonModule, MetricsModule } from '@pawells/nestjs-shared';

@Module({
  imports: [
    ConfigModule,                  // MUST be first
    CommonModule,                  // Depends on ConfigModule
    MetricsModule.forRoot(),       // Optional: Prometheus metrics
    // ... feature modules
  ],
})
export class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // All filters, interceptors, pipes already registered globally

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
}

bootstrap();
```

### Custom Error Handling

```typescript
import { BaseApplicationError, ErrorCategorizerService } from '@pawells/nestjs-shared';

export class InsufficientFundsError extends BaseApplicationError {
  constructor(required: number, available: number) {
    super(`Insufficient funds: need ${required}, have ${available}`, {
      code: 'INSUFFICIENT_FUNDS',
      statusCode: 402,
      context: { required, available }
    });
  }
}

// In service
@Catch(InsufficientFundsError)
export class PaymentService {
  constructor(private errorCategorizer: ErrorCategorizerService) {}

  async processPayment(amount: number) {
    if (amount > balance) {
      const error = new InsufficientFundsError(amount, balance);
      // Automatically caught by GlobalExceptionFilter
      // Categorized by ErrorCategorizerService (permanent/fail)
      // Sanitized by ErrorSanitizerService
      throw error;
    }
  }
}
```

## Related Packages

- **[@pawells/nestjs-auth](https://www.npmjs.com/package/@pawells/nestjs-auth)** - JWT, sessions, OAuth/OIDC, Keycloak
- **[@pawells/nestjs-graphql](https://www.npmjs.com/package/@pawells/nestjs-graphql)** - GraphQL with caching and subscriptions
- **[@pawells/nestjs-open-telemetry](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)** - OpenTelemetry tracing
- **[@pawells/nestjs-prometheus](https://www.npmjs.com/package/@pawells/nestjs-prometheus)** - Prometheus metrics exporter

## License

MIT
