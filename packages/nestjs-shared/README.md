# @pawells/nestjs-shared

[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-shared.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-shared)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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

### Common Module Setup

```typescript
import { Module } from '@nestjs/common';
import { CommonModule } from '@pawells/nestjs-shared';

@Module({
  imports: [CommonModule.forRoot()],
})
export class AppModule {}
```

### Using Filters and Interceptors

```typescript
import { GlobalExceptionFilter, LoggingInterceptor, HTTPMetricsInterceptor } from '@pawells/nestjs-shared';

// In your main.ts
const app = await NestFactory.create(AppModule);
app.useGlobalFilters(new GlobalExceptionFilter(logger));
app.useGlobalInterceptors(
  new LoggingInterceptor(logger),
  new HTTPMetricsInterceptor(metricsService),
);
```

### Configuration with Joi Validation

```typescript
import { ConfigModule, CreateEnvironmentSchema } from '@pawells/nestjs-shared';

@Module({
  imports: [
    ConfigModule.forRoot({
      schema: CreateEnvironmentSchema({
        NODE_ENV: CreateStringSchema(),
        PORT: CreatePortSchema(),
        DATABASE_URL: CreateUriSchema(),
      }),
    }),
  ],
})
export class AppModule {}
```

### Error Handling

```typescript
import { BaseApplicationError, ErrorCategorizerService } from '@pawells/nestjs-shared';

// Custom error
export class UserNotFoundError extends BaseApplicationError {
  constructor(userId: string) {
    super(
      `User ${userId} not found`,
      'USER_NOT_FOUND',
      404,
    );
  }
}

// Categorize errors
const errorCategory = errorCategorizerService.categorize(error);
```

### CSRF Protection

```typescript
import { CSRFGuard, CSRFService } from '@pawells/nestjs-shared';

@UseGuards(CSRFGuard)
@Controller('api')
export class ApiController {
  @Post('/form')
  submitForm() {
    // CSRF token automatically verified
  }
}
```

### Lazy Loading

Defer dependency resolution to avoid circular dependencies:

```typescript
import { LazyGetter, createMemoizedLazyGetter } from '@pawells/nestjs-shared';

@Injectable()
export class MyService implements LazyModuleRefService {
  private readonly userService: LazyGetter<UserService> = createMemoizedLazyGetter(
    () => this.moduleRef.get(UserService, { strict: false }),
  );

  constructor(private moduleRef: ModuleRef) {}

  getUser(id: string) {
    return this.userService().getById(id);
  }
}
```

## Key Features

### Filters
- **GlobalExceptionFilter**: Global error handling with structured responses
- **HttpExceptionFilter**: HTTP-specific exception handling

### Guards
- **CSRFGuard**: CSRF token verification
- **MetricsGuard**: Metrics collection guard
- **CustomThrottleGuard**: Rate limiting with custom configuration

### Interceptors
- **LoggingInterceptor**: Request/response logging with context
- **HTTPMetricsInterceptor**: HTTP metrics collection

### Pipes
- **BaseValidationPipe**: Foundation for validation
- **ValidationPipe**: Class-validator integration

### Services
- **AppLogger**: Contextual application logger
- **AuditLoggerService**: Audit trail logging
- **ErrorCategorizerService**: Error classification
- **ErrorSanitizerService**: Sensitive data redaction
- **HttpClientService**: HTTP client with timeouts
- **CSRFService**: CSRF token generation and verification
- **MetricsRegistryService**: Prometheus metrics registration
- **HealthCheckService**: Application health status

### Utilities
- **Lazy Loading**: `LazyGetter<T>`, `OptionalLazyGetter<T>` with memoization
- **Decorators**: Factory functions for creating custom decorators
- **Configuration**: Joi schema builders for validation
- **Request Helpers**: Extract properties from requests, context detection

### Modules
- **CommonModule**: Core filters, guards, and services
- **MetricsModule**: Metrics endpoint and collection
- **SharedThrottlerModule**: Rate limiting configuration

## Configuration Options

### CommonModule.forRoot()

```typescript
interface CommonModuleConfig {
  enableLogging?: boolean;
  enableMetrics?: boolean;
  enableCSRF?: boolean;
  corsOrigin?: string | RegExp;
  rateLimits?: RateLimitConfig[];
}
```

### MetricsModule.forRoot()

Metrics endpoint at `/metrics` (requires `prom-client`).

## Conditional Exports

```typescript
// Main exports
import { GlobalExceptionFilter } from '@pawells/nestjs-shared';

// Common-only exports
import { CSRFService } from '@pawells/nestjs-shared/common';

// Lazy loader types
import { LazyGetter } from '@pawells/nestjs-shared/common/utils/lazy-getter.types';
```

## Related Packages

- **[@pawells/nestjs-auth](https://www.npmjs.com/package/@pawells/nestjs-auth)** - JWT, sessions, OAuth/OIDC
- **[@pawells/nestjs-graphql](https://www.npmjs.com/package/@pawells/nestjs-graphql)** - GraphQL with caching and subscriptions
- **[@pawells/nestjs-open-telemetry](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)** - OpenTelemetry tracing
- **[@pawells/nestjs-prometheus](https://www.npmjs.com/package/@pawells/nestjs-prometheus)** - Prometheus metrics exporter

## License

MIT
