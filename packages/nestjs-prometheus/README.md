# @pawells/nestjs-prometheus

[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-prometheus.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-prometheus)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Prometheus metrics exporter for NestJS with `/metrics` endpoint.

## Installation

```bash
yarn add @pawells/nestjs-prometheus prom-client
```

## Requirements

- **Node.js**: >= 24.0.0
- **NestJS**: >= 10.0.0
- **prom-client**: >= 15.0.0
- **@pawells/nestjs-shared**: same version

## Peer Dependencies

```json
{
  "@nestjs/common": ">=10.0.0",
  "prom-client": ">=15.0.0"
}
```

## Quick Start

### Module Setup

```typescript
import { Module } from '@nestjs/common';
import { PrometheusModule } from '@pawells/nestjs-prometheus';

@Module({
  imports: [PrometheusModule.forRoot()],
})
export class AppModule {}
```

The module automatically exposes metrics at `GET /metrics` in Prometheus text format.

### Using PrometheusExporter

```typescript
import { PrometheusExporter } from '@pawells/nestjs-prometheus';

@Injectable()
export class CustomMetricsService {
  constructor(private prometheusExporter: PrometheusExporter) {}

  recordCustomMetric() {
    // Access the prom-client registry
    const registry = this.prometheusExporter.getRegistry();

    // Register custom metrics
    const customCounter = new registry.Counter({
      name: 'custom_operations_total',
      help: 'Total custom operations',
      labelNames: ['operation_type'],
    });

    customCounter.inc({ operation_type: 'create' });
  }
}
```

## Key Features

### Metrics Endpoint
- **GET /metrics**: Prometheus-compatible metrics in text format
- **Authentication**: Integrated with `@pawells/nestjs-shared` guards
- **Health Checks**: Service health status metrics

### Pre-configured Metrics
- **HTTP Request Metrics**: Duration, status codes, method/path
- **Process Metrics**: Memory, CPU, file descriptors
- **Custom Metrics**: Define application-specific metrics

### Integration
- **MetricsController**: Pre-built `/metrics` endpoint
- **PrometheusExporter**: Direct registry access
- **prom-client**: Full Prometheus client library support

## Configuration

### PrometheusModule.forRoot()

```typescript
interface PrometheusModuleConfig {
  endpoint?: string; // Default: '/metrics'
  defaultLabels?: Record<string, string>;
  collectDefaultMetrics?: boolean; // Default: true
}
```

### forRootAsync()

```typescript
PrometheusModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    endpoint: configService.get('METRICS_ENDPOINT') || '/metrics',
    defaultLabels: {
      service: configService.get('SERVICE_NAME'),
      environment: configService.get('NODE_ENV'),
    },
  }),
  inject: [ConfigService],
})
```

## Accessing Metrics

### Via Prometheus Scraper

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'my-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Manual HTTP Request

```bash
curl http://localhost:3000/metrics
```

### Metrics Format

```
# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE process_cpu_user_seconds_total counter
process_cpu_user_seconds_total 123.45

# HELP http_request_duration_seconds HTTP request latency in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1",method="GET",route="/api/users"} 42
```

## Custom Metrics Example

```typescript
import { PrometheusExporter } from '@pawells/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class OrderService {
  private orderCounter: Counter;
  private orderDuration: Histogram;

  constructor(exporter: PrometheusExporter) {
    const registry = exporter.getRegistry();

    this.orderCounter = new Counter({
      name: 'orders_created_total',
      help: 'Total orders created',
      labelNames: ['status'],
      registries: [registry],
    });

    this.orderDuration = new Histogram({
      name: 'order_processing_seconds',
      help: 'Order processing duration',
      labelNames: ['operation'],
      registries: [registry],
    });
  }

  async createOrder(dto: CreateOrderDto) {
    const timer = this.orderDuration.startTimer({ operation: 'create' });

    try {
      const order = { id: uuid(), ...dto };
      this.orderCounter.inc({ status: 'success' });
      return order;
    } catch (error) {
      this.orderCounter.inc({ status: 'error' });
      throw error;
    } finally {
      timer();
    }
  }
}
```

## Integration with HTTPMetricsInterceptor

Combine with `@pawells/nestjs-shared` for automatic HTTP metrics:

```typescript
import { HTTPMetricsInterceptor } from '@pawells/nestjs-shared';

@Module({
  imports: [PrometheusModule.forRoot()],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: HTTPMetricsInterceptor,
    },
  ],
})
export class AppModule {}
```

This automatically tracks:
- Request count by method and route
- Request duration (histogram)
- Response status codes
- Path normalization (`:id` for dynamic segments)

## Related Packages

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** - HTTP metrics interceptor
- **[@pawells/nestjs-open-telemetry](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)** - Additional observability

## License

MIT
