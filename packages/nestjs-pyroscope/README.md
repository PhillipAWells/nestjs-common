# NestJS Pyroscope Module

[![GitHub Release](https://img.shields.io/github/v/release/PhillipAWells/nestjs-common)](https://github.com/PhillipAWells/nestjs-common/releases)
[![CI](https://github.com/PhillipAWells/nestjs-common/actions/workflows/ci.yml/badge.svg)](https://github.com/PhillipAWells/nestjs-common/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-pyroscope.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-pyroscope)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/PhillipAWells?style=social)](https://github.com/sponsors/PhillipAWells)

Pyroscope continuous profiling integration for NestJS with decorators, interceptors, and health monitoring. Provides automatic profiling of HTTP requests and methods with minimal setup.

## Installation

```bash
yarn add @pawells/nestjs-pyroscope @pyroscope/nodejs
```

## Requirements

- **Node.js**: >= 24.0.0
- **NestJS**: >= 10.0.0
- **@pyroscope/nodejs**: ^0.4.10

## Peer Dependencies

```json
{
  "@nestjs/common": ">=10.0.0",
  "@nestjs/terminus": ">=10.0.0",
  "rxjs": ">=7.0.0"
}
```

## Overview

`nestjs-pyroscope` is a standalone NestJS module that integrates Pyroscope continuous profiling. It provides:

- **PyroscopeService**: Core service for profiling lifecycle management
- **Profiling Decorators**: `@Profile`, `@ProfileMethod`, `@ProfileAsync` for selective method profiling
- **ProfilingInterceptor**: Global HTTP request profiling across all endpoints
- **Built-in Health Endpoints**: `/profiling/health`, `/profiling/metrics`, `/profiling/status`, `/profiling/metrics/prometheus`
- **ProfilingHealthIndicator**: Integration with NestJS health checks
- **MetricsService**: Aggregation and export of profiling metrics (JSON and Prometheus formats)
- **Utilities**: Configuration validation, tag formatting, metric aggregation, error handling

## Quick Start

### 1. Module Setup (Synchronous)

```typescript
import { Module } from '@nestjs/common';
import { PyroscopeModule } from '@pawells/nestjs-pyroscope';

@Module({
  imports: [
    PyroscopeModule.forRoot({
      isGlobal: true,
      config: {
        enabled: process.env.NODE_ENV === 'production',
        serverAddress: 'http://localhost:4040',
        applicationName: 'my-nestjs-app',
        tags: {
          version: '1.0.0',
          environment: process.env.NODE_ENV,
        },
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Module Setup (Asynchronous)

Use `forRootAsync` when your configuration depends on other providers:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PyroscopeModule } from '@pawells/nestjs-pyroscope';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PyroscopeModule.forRootAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        enabled: configService.get('PROFILING_ENABLED') === 'true',
        serverAddress: configService.get('PYROSCOPE_SERVER_ADDRESS'),
        applicationName: configService.get('APP_NAME'),
        environment: configService.get('NODE_ENV'),
        tags: {
          version: configService.get('APP_VERSION'),
          region: configService.get('REGION'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Usage

### Profiling Decorators

The package provides three decorators for different profiling scenarios. All require `PyroscopeService` to be injected.

#### @Profile - Class-level Decorator

Profiles **all methods** in a class automatically.

**When to use:**
- You want profiling on all methods without per-method decoration
- Minimal setup required

```typescript
import { Injectable } from '@nestjs/common';
import { Profile, PyroscopeService } from '@pawells/nestjs-pyroscope';

@Profile({ tags: { service: 'user' } })
@Injectable()
export class UserService {
  constructor(private pyroscope: PyroscopeService) {}

  async findById(id: string) {
    // Automatically profiled as 'UserService.findById'
    return this.database.users.findOne(id);
  }

  async update(id: string, data: any) {
    // Automatically profiled as 'UserService.update'
    return this.database.users.update(id, data);
  }

  getCount() {
    // Sync methods also profiled
    return this.database.users.count();
  }
}
```

#### @ProfileMethod - Method-level Decorator

Profiles **specific methods** with optional custom names and tags.

**When to use:**
- You want selective profiling of specific methods
- You need custom profile names or method-level tags

```typescript
import { Injectable } from '@nestjs/common';
import { ProfileMethod, PyroscopeService } from '@pawells/nestjs-pyroscope';

@Injectable()
export class OrderService {
  constructor(private pyroscope: PyroscopeService) {}

  @ProfileMethod({ name: 'order.create.expensive' })
  async createOrder(orderData: any) {
    // Profiled with custom name 'order.create.expensive'
    return this.processPayment(orderData);
  }

  @ProfileMethod({ tags: { operation: 'query' } })
  async findActiveOrders() {
    // Profiled with custom tags
    return this.database.orders.find({ status: 'active' });
  }

  @ProfileMethod()
  calculateTotal(items: any[]) {
    // Sync method profiling with default name 'OrderService.calculateTotal'
    return items.reduce((sum, item) => sum + item.price, 0);
  }
}
```

#### @ProfileAsync - Async Method Decorator

Specifically designed for **async/Promise-based** methods.

**When to use:**
- You have async methods and want guaranteed Promise handling
- You prefer explicit async decoration
- You want accurate timing for Promise-based operations

```typescript
import { Injectable } from '@nestjs/common';
import { ProfileAsync, PyroscopeService } from '@pawells/nestjs-pyroscope';

@Injectable()
export class ApiService {
  constructor(private pyroscope: PyroscopeService) {}

  @ProfileAsync({ name: 'api.fetch.user-profile' })
  async fetchUserProfile(userId: string) {
    // Guaranteed async/await handling with proper timing
    const response = await fetch(`https://api.example.com/users/${userId}`);
    return response.json();
  }

  @ProfileAsync({ tags: { endpoint: 'search' } })
  async search(query: string) {
    // Async profiling with custom tags
    return await this.elasticsearch.search(query);
  }
}
```

### ProfilingInterceptor - Global Request Profiling

Automatically profiles **all HTTP requests** with no additional decorators needed.

**Features:**
- Captures HTTP method, path, and status code
- Records timing from request start to response
- Distinguishes between successful and failed requests
- Includes User-Agent header

**When to use:**
- You want automatic profiling of all HTTP requests
- You need comprehensive request performance metrics
- You want global observability without per-endpoint decoration

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ProfilingInterceptor } from '@pawells/nestjs-pyroscope';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ProfilingInterceptor,
    },
  ],
})
export class AppModule {}
```

Example profiling profile names generated by the interceptor:
- `HTTP GET /users/:id`
- `HTTP POST /orders`
- `HTTP DELETE /users/:id/sessions`

### Manual Profiling with PyroscopeService

For fine-grained control, use `PyroscopeService` directly:

```typescript
import { Injectable } from '@nestjs/common';
import { PyroscopeService, IProfileContext } from '@pawells/nestjs-pyroscope';

@Injectable()
export class DataProcessingService {
  constructor(private pyroscope: PyroscopeService) {}

  async processLargeDataset(data: any[]) {
    // Manual profiling with fine-grained control
    const context: IProfileContext = {
      functionName: 'processLargeDataset',
      tags: { dataSize: data.length.toString() },
      startTime: Date.now(),
    };

    this.pyroscope.startProfiling(context);

    try {
      // Your processing logic
      const result = data.map(item => this.transform(item));
      return result;
    } finally {
      // Always stop profiling, even on error
      const metrics = this.pyroscope.stopProfiling(context);
      console.log(`Processing took ${metrics.duration}ms`);
    }
  }

  // Or use the convenience method
  async processWithTracking(data: any[]) {
    return await this.pyroscope.trackFunction(
      'processWithTracking',
      async () => {
        // Your logic here
        return data.map(item => this.transform(item));
      },
      { dataSize: data.length.toString() }
    );
  }
}
```

## Health Monitoring

### Built-in Health Endpoints

The module automatically registers four health endpoints at `/profiling/*` (can be disabled):

#### GET /profiling/health

Returns health status with server connectivity and active profile information.

```json
{
  "status": "healthy",
  "timestamp": 1710429254123,
  "uptime": 3600.5,
  "pyroscope": {
    "connected": true,
    "serverAddress": "http://localhost:4040",
    "applicationName": "my-app",
    "lastUpdate": 1710429254123
  },
  "profiling": {
    "enabled": true,
    "activeProfiles": 12,
    "totalProfiles": 5430
  }
}
```

#### GET /profiling/metrics

Returns aggregated profiling metrics (JSON format).

```json
{
  "timestamp": 1710429254123,
  "cpu": {
    "samples": 1250,
    "duration": 45000
  },
  "memory": {
    "samples": 890,
    "allocations": 512000000
  },
  "requests": {
    "total": 5430,
    "successful": 5389,
    "failed": 41,
    "averageResponseTime": 125.34
  }
}
```

#### GET /profiling/status

Returns combined health and metrics in a single response.

#### GET /profiling/metrics/prometheus

Returns metrics in Prometheus exposition format for integration with Prometheus servers.

```
# HELP profiling_cpu_samples_total Total number of CPU profiling samples collected
# TYPE profiling_cpu_samples_total counter
profiling_cpu_samples_total 1250

# HELP profiling_requests_total Total number of requests profiled
# TYPE profiling_requests_total counter
profiling_requests_total 5430
...
```

### ProfilingHealthIndicator - NestJS Health Check Integration

Integrate with NestJS health checks using `@nestjs/terminus`:

```typescript
import { Controller, Get, Injectable } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ProfilingHealthIndicator } from '@pawells/nestjs-pyroscope';

@Controller('health')
@Injectable()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private profiling: ProfilingHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.profiling.check('profiling'),
    ]);
  }
}
```

## Configuration Reference

### IPyroscopeConfig Interface

All configuration uses plain TypeScript interfaces (no Joi validation).

```typescript
interface IPyroscopeConfig {
  // Required fields
  enabled: boolean;                    // Enable/disable profiling
  serverAddress: string;               // Pyroscope server URL (http:// or https://)
  applicationName: string;             // Application identifier for Pyroscope

  // Optional: Metadata
  environment?: string;                // Environment name (dev, staging, prod)
  version?: string;                    // Application version
  sampleRate?: number;                 // Sampling rate (0-1)
  profileTypes?: TProfileType[];       // Profile types to collect

  // Optional: Tags
  tags?: Record<string, string>;       // Global tags applied to all profiles

  // Optional: Authentication
  basicAuthUser?: string;              // Basic auth username
  basicAuthPassword?: string;          // Basic auth password

  // Optional: TLS/SSL
  tlsEnabled?: boolean;                // Enable TLS
  tlsCertPath?: string;                // Path to TLS cert
  tlsKeyPath?: string;                 // Path to TLS key
  tlsCaPath?: string;                  // Path to CA cert
  tlsInsecureSkipVerify?: boolean;     // Skip TLS verification (unsafe)

  // Optional: Logging
  logLevel?: 'debug' | 'info' | 'warn' | 'error';  // Log level

  // Optional: Health and Monitoring
  enableHealthChecks?: boolean;        // Enable health endpoints (default: true)
  degradedActiveProfilesThreshold?: number;  // Threshold for degraded status (default: 1000)

  // Optional: Retry Configuration
  retryBaseDelayMs?: number;           // Base delay for exponential backoff (default: 100)
  retryMaxDelayMs?: number;            // Max delay for retries (default: 10000)
  retryJitterMs?: number;              // Jitter to add to delays (default: 1000)

  // Optional: Tag Handling
  tagMaxLength?: number;               // Max tag value length (default: 200)
}
```

### Profile Types

```typescript
type TProfileType = 'cpu' | 'memory' | 'goroutine' | 'mutex' | 'block';
```

### IProfileMetrics Interface

Represents profiling metrics collected during a profiling session. Used to track performance data from individual operations:

```typescript
interface IProfileMetrics {
  cpuTime: number;              // CPU time consumed in milliseconds
  memoryUsage: number;          // Memory usage in bytes
  duration: number;             // Total operation duration in milliseconds
  timestamp: number;            // Timestamp when metrics were recorded
  tags?: Record<string, string>; // Optional metadata tags for filtering/analysis
}
```

**When to use:**
- You need to access metrics from a completed profiling session
- You want to store or analyze profiling data programmatically
- You're implementing custom metrics aggregation or reporting

**Example:**

```typescript
import { Injectable } from '@nestjs/common';
import { PyroscopeService, IProfileMetrics } from '@pawells/nestjs-pyroscope';

@Injectable()
export class PerformanceAnalyzer {
  constructor(private pyroscope: PyroscopeService) {}

  async trackAndLog(operation: string) {
    const context = {
      functionName: operation,
      startTime: Date.now(),
      tags: { operation },
    };

    this.pyroscope.startProfiling(context);

    try {
      // Your logic here
      await this.expensiveOperation();
    } finally {
      const metrics = this.pyroscope.stopProfiling(context);
      console.log(`Operation: ${operation}`);
      console.log(`Duration: ${metrics.duration}ms`);
      console.log(`CPU: ${metrics.cpuTime}ms`);
      console.log(`Memory: ${metrics.memoryUsage} bytes`);
    }
  }
}
```

### IProfileContext Interface

Represents the lifecycle and metadata of a profiling session. Used internally by PyroscopeService and provided by decorators/interceptors:

```typescript
interface IProfileContext {
  profileId?: string;               // Unique profile identifier
  functionName: string;             // Name of the function/operation being profiled
  className?: string;               // Class name (for class methods)
  methodName?: string;              // Method name (for class methods)
  startTime?: number;               // Start timestamp in milliseconds
  endTime?: number;                 // End timestamp in milliseconds
  duration?: number;                // Computed duration in milliseconds
  error?: Error;                    // Error object if operation failed
  tags?: Record<string, string>;    // Metadata tags for profiling context
}
```

**When to use:**
- You're implementing manual profiling with `PyroscopeService.startProfiling()` and `.stopProfiling()`
- You need to track profiling metadata for complex operations
- You're building custom decorators or profiling utilities

**Example:**

```typescript
import { Injectable } from '@nestjs/common';
import { PyroscopeService, IProfileContext } from '@pawells/nestjs-pyroscope';

@Injectable()
export class DataProcessingService {
  constructor(private pyroscope: PyroscopeService) {}

  async processWithContext(data: any[]) {
    const context: IProfileContext = {
      functionName: 'processLargeDataset',
      className: 'DataProcessingService',
      methodName: 'processWithContext',
      startTime: Date.now(),
      tags: {
        dataSize: data.length.toString(),
        environment: process.env.NODE_ENV || 'development',
      },
    };

    this.pyroscope.startProfiling(context);

    try {
      const result = data.map(item => this.transform(item));
      context.duration = Date.now() - (context.startTime || 0);
      return result;
    } catch (error) {
      context.error = error as Error;
      context.duration = Date.now() - (context.startTime || 0);
      throw error;
    } finally {
      this.pyroscope.stopProfiling(context);
    }
  }
}
```

## MetricsService API

The `MetricsService` is injected with the module and provides metrics aggregation:

```typescript
import { Injectable } from '@nestjs/common';
import { MetricsService } from '@pawells/nestjs-pyroscope';

@Injectable()
export class MetricsController {
  constructor(private metrics: MetricsService) {}

  getMetrics() {
    // Get aggregated metrics snapshot
    const snapshot = this.metrics.getMetrics();

    // Record individual metrics
    this.metrics.recordCPUSample(125);  // CPU time in ms
    this.metrics.recordMemorySample(1024000);  // Memory in bytes
    this.metrics.recordRequest(200, 45);  // Status code and duration

    // Export Prometheus format
    const prometheus = this.metrics.getPrometheusMetrics();

    // Reset all metrics
    this.metrics.reset();
  }
}
```

## Utility Classes

### ProfilingConfigValidator

```typescript
import { ProfilingConfigValidator } from '@pawells/nestjs-pyroscope';

const result = ProfilingConfigValidator.validate(config);
if (!result.isValid) {
  console.error('Config errors:', result.errors);
}
```

### TagFormatter

```typescript
import { TagFormatter } from '@pawells/nestjs-pyroscope';

// Convert camelCase to snake_case
TagFormatter.format({ userId: '123', userName: 'john' });
// Returns: { user_id: '123', user_name: 'john' }

// Merge tags
TagFormatter.merge({ env: 'prod' }, { region: 'us-east-1' });
// Returns: { env: 'prod', region: 'us-east-1' }

// Sanitize tags
TagFormatter.sanitize({ valid: 'value', empty: '', token: 'verylongvalue' });
// Returns: { valid: 'value', token: 'very' } (long value truncated)
```

### MetricAggregator

```typescript
import { MetricAggregator } from '@pawells/nestjs-pyroscope';

const metrics = [
  { duration: 100 },
  { duration: 200 },
  { duration: 150 },
];

// Calculate statistics
const avg = MetricAggregator.averageDuration(metrics);  // 150
const p95 = MetricAggregator.percentile(metrics, 95);   // ~200

// Group by tags
const grouped = MetricAggregator.groupByTags(
  metricsWithTags,
  ['operation']
);
```

### ProfilingErrorHandler

```typescript
import { ProfilingErrorHandler } from '@pawells/nestjs-pyroscope';

try {
  // Operation
} catch (error) {
  if (ProfilingErrorHandler.isRecoverableError(error)) {
    // Schedule retry
    const delay = ProfilingErrorHandler.getRetryDelay(error, attempt);
    setTimeout(() => retry(), delay);
  }

  // Format error safely for logging
  const message = ProfilingErrorHandler.formatError(error);
  logger.error(message);
}
```

### Utility Functions

```typescript
import {
  generateProfileId,
  formatDuration,
  isProfilingEnabled,
} from '@pawells/nestjs-pyroscope';

// Generate unique profile ID
const id = generateProfileId('operation');
// Returns: 'operation_1710429254123_abc123def'

// Format duration
formatDuration(450);   // '450.00ms'
formatDuration(1500);  // '1.50s'

// Check if enabled via env
if (isProfilingEnabled()) {
  // PYROSCOPE_ENABLED=true or PYROSCOPE_ENABLED=1
}
```

## Best Practices

### 1. Selective Profiling

Profile only critical paths and hot functions to minimize overhead:

```typescript
@Injectable()
export class UserService {
  @ProfileMethod({ name: 'user.expensive-operation' })
  async expensiveOperation() {
    // Only profile what matters
  }

  // Don't profile trivial operations
  getName() {
    return this.name;
  }
}
```

### 2. Use Descriptive Names

Provide meaningful profile names for better analysis in Pyroscope UI:

```typescript
@ProfileMethod({ name: 'payment.processing.stripe' })
async processPayment(amount: number) {
  // Clear, specific name for easy tracking
}
```

### 3. Add Contextual Tags

Include relevant context in tags for filtering and analysis:

```typescript
@ProfileMethod({ tags: { 'query-type': 'complex', 'table': 'orders' } })
async executeComplexQuery() {
  // Tags help correlate performance with operation type
}
```

### 4. Environment-based Configuration

Configure differently per environment:

```typescript
PyroscopeModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    enabled: configService.get('NODE_ENV') !== 'test',
    serverAddress: configService.get('PYROSCOPE_SERVER'),
    applicationName: configService.get('APP_NAME'),
    environment: configService.get('NODE_ENV'),
    tags: {
      region: configService.get('REGION'),
      version: configService.get('APP_VERSION'),
      service: configService.get('SERVICE_NAME'),
    },
  }),
  inject: [ConfigService],
})
```

### 5. Disable Health Endpoints in Production

If you want to disable the built-in health endpoints:

```typescript
PyroscopeModule.forRoot({
  config: { /* ... */ },
  enableHealthChecks: false,
})
```

### 6. Secure Health Endpoints

⚠️ **WARNING**: The health endpoints expose infrastructure and performance information. Protect them at the network level:

```typescript
// Example: Protect with middleware
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(authMiddleware)
      .forRoutes('profiling');
  }
}
```

## Integration with Other Packages

The `nestjs-pyroscope` package works seamlessly with other `@pawells/nestjs-*` packages:

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** - Foundation library with filters, guards, error handling
- **[@pawells/nestjs-auth](https://www.npmjs.com/package/@pawells/nestjs-auth)** - Keycloak integration: token validation, guards, decorators, Admin API client
- **[@pawells/nestjs-open-telemetry](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)** - Distributed tracing
- **[@pawells/nestjs-prometheus](https://www.npmjs.com/package/@pawells/nestjs-prometheus)** - Prometheus metrics export
- **[@pawells/nestjs-graphql](https://www.npmjs.com/package/@pawells/nestjs-graphql)** - GraphQL with subscriptions and caching

## Implementation Notes

### Fire-and-Forget Initialization

Pyroscope client initialization happens asynchronously in the background to avoid blocking module startup. If initialization fails, profiling gracefully degrades and the application continues normally.

### Memory Management

The service automatically manages memory to prevent unbounded growth:

- **Max Active Profiles**: 10,000 concurrent profiles (older ones evicted)
- **Stale Profile Timeout**: 30 minutes (profiles older than this are evicted)
- **Metrics History**: 1,000 entries (oldest entries discarded)

### Dynamic Tags Not Supported

@pyroscope/nodejs does not support dynamic tag manipulation. Tags must be set during module initialization via `config.tags`. Context tags are tracked for metrics but don't affect Pyroscope server-side profiling.

## License

MIT
