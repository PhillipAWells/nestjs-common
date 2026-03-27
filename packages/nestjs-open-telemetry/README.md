# NestJS OpenTelemetry Module

[![GitHub Release](https://img.shields.io/github/v/release/PhillipAWells/nestjs-common)](https://github.com/PhillipAWells/nestjs-common/releases)
[![CI](https://github.com/PhillipAWells/nestjs-common/actions/workflows/ci.yml/badge.svg)](https://github.com/PhillipAWells/nestjs-common/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-open-telemetry.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/PhillipAWells?style=social)](https://github.com/sponsors/PhillipAWells)

OpenTelemetry integration for NestJS applications. Provides distributed tracing with the `@Traced` decorator, manual span creation helpers, HTTP metrics recording, and a NestJS logger adapter that automatically injects trace context.

## Installation

```bash
yarn add @pawells/nestjs-open-telemetry
```

## Requirements

- **Node.js**: >= 24.0.0
- **NestJS**: >= 10.0.0
- **@opentelemetry/api**: >= 1.0.0
- **@pawells/nestjs-shared**: peer dependency (provides `InstrumentationRegistry`)

## Quick Start

### Module Setup

Import `OpenTelemetryModule` in your root application module. The module must be imported after `CommonModule` from `@pawells/nestjs-shared` (which provides the `InstrumentationRegistry`).

```typescript
import { Module } from '@nestjs/common';
import { CommonModule } from '@pawells/nestjs-shared';
import { OpenTelemetryModule } from '@pawells/nestjs-open-telemetry';

@Module({
  imports: [
    CommonModule,            // Provides InstrumentationRegistry
    OpenTelemetryModule.forRoot(),  // Registers OpenTelemetry exporter
  ],
})
export class AppModule {}
```

### Using @Traced Decorator

Automatically wrap any method in a distributed tracing span with the `@Traced()` decorator:

```typescript
import { Injectable } from '@nestjs/common';
import { Traced, SpanKind } from '@pawells/nestjs-open-telemetry';

@Injectable()
export class UserService {
  // Basic usage — spans are INTERNAL by default
  @Traced()
  async getUserById(userId: string) {
    return await this.db.findUser(userId);
  }

  // Custom span name and attributes
  @Traced({
    name: 'UserService.fetchFromAPI',
    attributes: { 'service.layer': 'business-logic' },
    captureReturn: true,  // Include return value in span
  })
  async fetchUserFromAPI(userId: string) {
    return await this.httpClient.get(`/api/users/${userId}`);
  }

  // CLIENT span for external HTTP calls
  @Traced({
    name: 'getUserDataFromExternalAPI',
    kind: SpanKind.CLIENT,
    attributes: { 'http.method': 'GET' },
  })
  async getDataFromExternal(userId: string) {
    return await fetch(`https://api.example.com/users/${userId}`);
  }

  // SERVER span for request handlers
  @Traced({
    kind: SpanKind.SERVER,
    captureArgs: true,
    captureReturn: true,
  })
  async createUser(dto: CreateUserDto) {
    return await this.db.createUser(dto);
  }
}
```

#### @Traced Decorator Options

```typescript
interface TracedOptions {
  /**
   * Custom span name. Defaults to "ClassName.methodName".
   */
  name?: string;

  /**
   * Span kind. Defaults to SpanKind.INTERNAL.
   * Common values:
   * - SpanKind.INTERNAL: Business logic (default)
   * - SpanKind.CLIENT: External API calls
   * - SpanKind.SERVER: Request handlers
   * - SpanKind.PRODUCER: Message producers
   * - SpanKind.CONSUMER: Message consumers
   */
  kind?: SpanKind;

  /**
   * Additional span attributes to always set.
   */
  attributes?: Record<string, string | number | boolean>;

  /**
   * Capture method arguments as span attributes. Defaults to true.
   * Arguments > 100 chars or complex objects are omitted for security.
   * PII (email, phone, SSN, credit cards) is automatically redacted.
   */
  captureArgs?: boolean;

  /**
   * Capture method return value as span attribute. Defaults to false.
   * Return values > 100 chars or complex objects are omitted for security.
   */
  captureReturn?: boolean;
}
```

#### SpanKind Values

Exported from `@pawells/nestjs-open-telemetry`:

- **INTERNAL** (default) — Internal business logic, synchronous operations
- **SERVER** — Request handlers, server-side operations
- **CLIENT** — External API calls, outbound requests
- **PRODUCER** — Message producers
- **CONSUMER** — Message consumers

### Manual Span Creation

For more control, use the tracing helpers from `lib/tracing.ts`:

#### getTracer(name, version?)

Get or create a tracer instance with namespace conventions.

```typescript
import { getTracer } from '@pawells/nestjs-open-telemetry';

const tracer = getTracer('user-service', '1.2.0');
// Actual tracer name: 'pawells.user-service'
```

#### createSpan(tracer, name, options?, makeActive?)

Create a span and optionally set it as active in context.

```typescript
import { getTracer, createSpan } from '@pawells/nestjs-open-telemetry';

const tracer = getTracer('user-service');
const { span, ctx } = createSpan(tracer, 'getUserById', {
  attributes: { 'user.id': '123' },
});

try {
  // Do work within context
  context.with(ctx, () => {
    // Span is active here
  });
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR });
} finally {
  span.end();
}
```

#### withSpan(tracer, name, fn, options?)

Execute a function within a span, automatically handling success/error status and cleanup.

```typescript
import { getTracer, withSpan } from '@pawells/nestjs-open-telemetry';

const tracer = getTracer('user-service');

// Works with async or sync functions
const user = await withSpan(tracer, 'getUserById', async () => {
  return await db.findUser(userId);
}, {
  attributes: { 'user.id': userId },
});
```

#### addAttributes(attributes, ctx?)

Add attributes to the currently active span. Silently no-ops if no span is active.

```typescript
import { addAttributes } from '@pawells/nestjs-open-telemetry';

addAttributes({
  'user.id': userId,
  'user.role': 'admin',
  'request.method': 'POST',
});
```

### HTTP Metrics

Record HTTP request metrics following OpenTelemetry semantic conventions:

#### recordHttpMetrics(method, route, statusCode, duration, requestSize?, responseSize?)

Record all HTTP request metrics at once.

```typescript
import { recordHttpMetrics } from '@pawells/nestjs-open-telemetry';

// In a middleware or HTTP interceptor
recordHttpMetrics(
  'GET',                    // HTTP method
  '/users/:id',            // Route pattern (normalized)
  200,                      // Status code
  45.2,                     // Duration in milliseconds
  0,                        // Optional: request body size in bytes
  1024,                     // Optional: response body size in bytes
);
```

Metrics recorded (following OpenTelemetry semantic conventions):
- `http.server.request.count` — Total HTTP requests
- `http.server.request.duration` — Request duration histogram
- `http.server.request.size` — Request body size histogram
- `http.server.response.size` — Response body size histogram

#### trackActiveRequests(delta, attributes?)

Track the number of active HTTP requests. Call with `+1` when a request starts, `-1` when it completes.

```typescript
import { trackActiveRequests } from '@pawells/nestjs-open-telemetry';

// Request started
trackActiveRequests(1, { method: 'GET' });

// Later, request completed
trackActiveRequests(-1, { method: 'GET' });
```

Metric recorded:
- `http.server.active_requests` — UpDownCounter tracking active requests

### OpenTelemetryLogger Adapter

Use `OpenTelemetryLogger` as your NestJS logger to automatically inject trace context (trace_id, span_id) into all logs.

```typescript
import { NestFactory } from '@nestjs/core';
import { OpenTelemetryLogger } from '@pawells/nestjs-open-telemetry';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new OpenTelemetryLogger({
      service: 'my-app',      // Optional: service name
      level: 'info',          // Optional: log level
      format: 'json',         // Optional: log format
    }),
  });
  await app.listen(3000);
}

bootstrap();
```

The logger automatically adds OpenTelemetry context to each log:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Request completed",
  "trace_id": "a1b2c3d4e5f6g7h8...",
  "span_id": "x1y2z3a4b5c6d7e8",
  "trace_flags": "01",
  "service": "my-app"
}
```

## OpenTelemetryExporter

The `OpenTelemetryExporter` is automatically registered by the module and implements the `IMetricsExporter` interface from `@pawells/nestjs-shared`.

It converts metrics recorded through the `InstrumentationRegistry` to OpenTelemetry instruments:

- **counter** → OpenTelemetry `Counter`
- **histogram** → OpenTelemetry `Histogram`
- **gauge** → OpenTelemetry `UpDownCounter` (push-based gauge semantics)
- **updown_counter** → OpenTelemetry `UpDownCounter`

Typically you don't interact with the exporter directly; the module handles registration automatically.

## Architecture

The module integrates with NestJS and OpenTelemetry as follows:

1. **@Traced Decorator** — Wraps methods in spans with automatic error handling and PII redaction
2. **Tracing Helpers** — Provide low-level span creation and context management
3. **HTTP Metrics** — Record request latency, status, and size metrics
4. **OpenTelemetryExporter** — Converts application metrics to OpenTelemetry instruments
5. **OpenTelemetryLogger** — Injects trace context into all logs
6. **InstrumentationRegistry Integration** — Works with `@pawells/nestjs-shared` to export metrics

## Configuration Reference

### OpenTelemetryModule.forRoot()

The module is initialized with no required configuration:

```typescript
@Module({
  imports: [
    OpenTelemetryModule.forRoot(),
  ],
})
export class AppModule {}
```

## Testing Utilities

The package exports two internal helper functions for test isolation and cleanup:

### resetTracerNamespace()

Resets the tracer namespace to its default value (`'pawells'`). Used in test teardown to ensure namespace isolation between tests.

```typescript
import { resetTracerNamespace } from '@pawells/nestjs-open-telemetry';

afterEach(() => {
  resetTracerNamespace();  // Clean up for next test
});
```

### resetHttpMetrics()

Resets the cached HTTP metrics to null, forcing re-initialization on next access. Used in test teardown to ensure metric state isolation between tests.

```typescript
import { resetHttpMetrics } from '@pawells/nestjs-open-telemetry';

afterEach(() => {
  resetHttpMetrics();  // Clean up for next test
});
```

## Re-exports

The package re-exports useful types from OpenTelemetry for convenience:

```typescript
import {
  Span,
  SpanContext,
  Attributes,
  SpanKind,
} from '@pawells/nestjs-open-telemetry';

// Also available from @opentelemetry/api
```

Logger configuration types:

```typescript
import {
  ILoggerConfig,
  LogLevel,
} from '@pawells/nestjs-open-telemetry';

// Also available from @pawells/logger
```

## Security Features

### PII Redaction

The `@Traced` decorator automatically detects and redacts Personally Identifiable Information (PII):

- **Email addresses** → `[REDACTED_EMAIL]`
- **Phone numbers** → `[REDACTED_PHONE]`
- **Social Security Numbers (SSN)** → `[REDACTED_SSN]`
- **Credit card numbers** (Luhn-validated) → `[REDACTED_CREDIT_CARD]`

### Argument Sanitization

- Arguments longer than 100 characters are truncated
- Complex objects are summarized (e.g., `Object(5 keys)` instead of stringified)
- Arrays > 5 items are summarized
- Null/undefined are converted to strings

### Return Value Redaction

Return values are only captured if explicitly enabled with `captureReturn: true`, and the same sanitization rules apply.

## Integration with Other Packages

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** — Provides `InstrumentationRegistry` and HTTP metrics interceptor
- **[@pawells/nestjs-auth](https://www.npmjs.com/package/@pawells/nestjs-auth)** — Trace authentication flows with `@Traced`
- **[@pawells/nestjs-graphql](https://www.npmjs.com/package/@pawells/nestjs-graphql)** — Trace GraphQL resolvers
- **[@pawells/nestjs-pyroscope](https://www.npmjs.com/package/@pawells/nestjs-pyroscope)** — Profiling integration

## Examples

### Complete Service Example

```typescript
import { Injectable } from '@nestjs/common';
import { Traced, SpanKind, getTracer, withSpan, addAttributes } from '@pawells/nestjs-open-telemetry';

@Injectable()
export class OrderService {
  constructor(private db: Database, private httpClient: HttpClient) {}

  // Automatic tracing with decorator
  @Traced({
    name: 'OrderService.getOrder',
    kind: SpanKind.INTERNAL,
  })
  async getOrder(orderId: string) {
    return await this.db.orders.findById(orderId);
  }

  // Manual span management with helpers
  async processOrder(orderId: string) {
    const tracer = getTracer('order-service');

    return withSpan(tracer, 'processOrder', async () => {
      addAttributes({
        'order.id': orderId,
        'operation': 'process',
      });

      const order = await this.getOrder(orderId);
      await this.validateOrder(order);
      await this.chargePayment(order);
      await this.shipOrder(order);

      return order;
    }, {
      attributes: { 'order.id': orderId },
    });
  }

  // CLIENT span for external calls
  @Traced({
    kind: SpanKind.CLIENT,
    name: 'ExternalPaymentAPI.charge',
  })
  private async chargePayment(order: Order) {
    return await this.httpClient.post('https://payment.example.com/charge', {
      orderId: order.id,
      amount: order.total,
    });
  }

  @Traced()
  private async validateOrder(order: Order) {
    addAttributes({ 'validation.status': 'passed' });
    return true;
  }

  @Traced()
  private async shipOrder(order: Order) {
    addAttributes({ 'shipping.method': 'standard' });
  }
}
```

### HTTP Middleware Example

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { recordHttpMetrics, trackActiveRequests } from '@pawells/nestjs-open-telemetry';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    trackActiveRequests(1, { method: req.method });
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      recordHttpMetrics(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration,
        req.get('content-length') ? parseInt(req.get('content-length')!, 10) : 0,
        res.get('content-length') ? parseInt(res.get('content-length')!, 10) : 0,
      );
      trackActiveRequests(-1, { method: req.method });
    });

    next();
  }
}
```

## Troubleshooting

### Spans not appearing in traces

Ensure:
1. OpenTelemetry SDK is initialized before your NestJS app
2. `OpenTelemetryModule` is imported after `CommonModule`
3. A span exporter is configured in your OpenTelemetry SDK

### PII redaction not working

PII redaction only applies to method arguments when `captureArgs: true` (default). If you're seeing PII in custom attributes, redact them manually:

```typescript
@Traced({
  attributes: {
    'user.email': sanitizeEmail(email),  // Redact manually
  },
})
```

### No trace context in logs

Ensure `OpenTelemetryLogger` is set as the NestJS logger during app creation:

```typescript
const app = await NestFactory.create(AppModule, {
  logger: new OpenTelemetryLogger(),
});
```

## License

MIT
