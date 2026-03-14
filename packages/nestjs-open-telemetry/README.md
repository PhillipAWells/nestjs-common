# @pawells/nestjs-open-telemetry

[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-open-telemetry.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

OpenTelemetry integration for NestJS with tracing, metrics, and logger adapter.

## Installation

```bash
yarn add @pawells/nestjs-open-telemetry
```

## Requirements

- **Node.js**: >= 24.0.0
- **NestJS**: >= 10.0.0
- **@opentelemetry/api**: >= 1.0.0
- **@pawells/nestjs-shared**: same version

## Peer Dependencies

```json
{
  "@nestjs/common": ">=10.0.0",
  "@opentelemetry/api": ">=1.0.0"
}
```

## Optional DevDependencies (for development)

```json
{
  "@opentelemetry/sdk-trace-node": "^1.0.0",
  "@opentelemetry/semantic-conventions": "^1.0.0"
}
```

## Quick Start

### Module Setup

```typescript
import { Module } from '@nestjs/common';
import { OpenTelemetryModule } from '@pawells/nestjs-open-telemetry';

@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      serviceName: 'my-app',
      tracing: {
        enabled: true,
      },
      metrics: {
        enabled: true,
      },
    }),
  ],
})
export class AppModule {}
```

### Using @Traced Decorator

```typescript
import { Traced, SpanKind } from '@pawells/nestjs-open-telemetry';

@Injectable()
export class UserService {
  @Traced({ spanName: 'user.findById', kind: SpanKind.INTERNAL })
  async findById(id: string) {
    // Automatically traced
    return { id, name: 'John' };
  }

  @Traced({ spanName: 'user.create', kind: SpanKind.SERVER })
  async create(dto: CreateUserDto) {
    // HTTP request span
    return { id: '123', ...dto };
  }
}
```

### Manual Span Creation

```typescript
import { getTracer, createSpan, withSpan, addAttributes } from '@pawells/nestjs-open-telemetry';

export async function complexOperation() {
  const tracer = getTracer();

  return withSpan(tracer.startSpan('complex.operation'), async (span) => {
    addAttributes(span, {
      'operation.type': 'batch',
      'batch.size': 100,
    });

    // Perform work
    return { success: true };
  });
}
```

### HTTP Metrics

```typescript
import { recordHttpMetrics, trackActiveRequests } from '@pawells/nestjs-open-telemetry';

// In a middleware or interceptor
recordHttpMetrics({
  method: 'GET',
  path: '/api/users',
  status: 200,
  duration: 150, // milliseconds
});

trackActiveRequests('increment'); // Track active connections
```

### Logger Adapter

```typescript
import { OpenTelemetryLogger } from '@pawells/nestjs-open-telemetry';

const app = await NestFactory.create(AppModule, {
  logger: new OpenTelemetryLogger(),
});
```

## Key Features

### Tracing
- **@Traced Decorator**: Automatic span creation on methods
- **SpanKind Support**: CLIENT, SERVER, INTERNAL, PRODUCER, CONSUMER
- **Manual Span Management**: Direct tracer access
- **Context Propagation**: Automatic trace context passing

### Metrics
- **HTTP Metrics**: Request latency, status codes
- **Active Requests**: Track concurrent connections
- **Custom Metrics**: Record application-specific metrics
- **Metric Aggregation**: Summary and histogram support

### Logger Integration
- **OpenTelemetryLogger**: NestJS logger adapter
- **Structured Logging**: JSON log format with trace context
- **Log Correlation**: Automatic trace ID injection

### Re-exports
- **Span, SpanContext, Attributes**: OpenTelemetry API types
- **ILoggerConfig, LogLevel**: Logger configuration types

## Configuration

### OpenTelemetryModule.forRoot()

```typescript
interface OpenTelemetryConfig {
  serviceName: string;
  serviceVersion?: string;

  tracing?: {
    enabled: boolean;
    samplingRate?: number;
  };

  metrics?: {
    enabled: boolean;
    interval?: number; // milliseconds
  };

  exporter?: {
    otlpEndpoint?: string;
    customExporter?: SpanExporter;
  };
}
```

### forRootAsync()

```typescript
OpenTelemetryModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    serviceName: configService.get('SERVICE_NAME'),
    tracing: { enabled: true },
  }),
  inject: [ConfigService],
})
```

## Span Attributes

Common attributes to add to spans:

```typescript
addAttributes(span, {
  'http.method': 'GET',
  'http.url': '/api/users',
  'http.status_code': 200,
  'db.system': 'mongodb',
  'db.operation': 'find',
  'db.mongodb.collection': 'users',
});
```

## Integration with Other Packages

Works seamlessly with:
- **[@pawells/nestjs-prometheus](https://www.npmjs.com/package/@pawells/nestjs-prometheus)** - Metrics export
- **[@pawells/nestjs-auth](https://www.npmjs.com/package/@pawells/nestjs-auth)** - Trace auth flows
- **[@pawells/nestjs-graphql](https://www.npmjs.com/package/@pawells/nestjs-graphql)** - Trace resolvers

## Related Packages

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** - Foundation library
- **[@pawells/nestjs-prometheus](https://www.npmjs.com/package/@pawells/nestjs-prometheus)** - Prometheus metrics

## License

MIT
