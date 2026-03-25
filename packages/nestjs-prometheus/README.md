# @pawells/nestjs-prometheus

[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-prometheus.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-prometheus)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Prometheus metrics exporter for NestJS with `/metrics` endpoint, integrated with `@pawells/nestjs-shared` InstrumentationRegistry for event-based metric collection.

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

Import `PrometheusModule` in your application module:

```typescript
import { Module } from '@nestjs/common';
import { PrometheusModule } from '@pawells/nestjs-prometheus';

@Module({
  imports: [PrometheusModule.forRoot()],
})
export class AppModule {}
```

This automatically registers the PrometheusExporter globally and exposes metrics at `GET /metrics` in Prometheus text format.

## How It Works

The module integrates with `@pawells/nestjs-shared`'s `InstrumentationRegistry` to:

1. **Register descriptors**: When a metric is registered with the InstrumentationRegistry, PrometheusExporter pre-creates the corresponding prom-client instrument (Counter, Gauge, or Histogram)
2. **Buffer values**: Metric values are buffered in memory as they are recorded
3. **Flush on pull**: When the `/metrics` endpoint is scraped, all pending values are flushed into prom-client instruments and returned in Prometheus text format
4. **Cleanup**: On shutdown, the registry and internal caches are cleared

This event-based design decouples metric recording from Prometheus scraping, preventing performance overhead on high-frequency metrics.

## The /metrics Endpoint

The module automatically exposes:

- **Endpoint**: `GET /metrics`
- **Content-Type**: `text/plain; version=0.0.4; charset=utf-8`
- **Headers**: `X-Robots-Tag: noindex, nofollow` (prevents indexing)
- **Authentication**: Protected by `MetricsGuard` from `@pawells/nestjs-shared`

### Authentication

The `/metrics` endpoint respects the optional `METRICS_API_KEY` environment variable:

- If **not set**: All requests are allowed
- If **set**: Requires Bearer token, X-API-Key header, or `?key=` query parameter

```bash
# With METRICS_API_KEY=secret123
curl -H "Authorization: Bearer secret123" http://localhost:3000/metrics
curl -H "X-API-Key: secret123" http://localhost:3000/metrics
curl "http://localhost:3000/metrics?key=secret123"
```

## Exported Metrics

The exporter provides three types of metrics:

### Node.js Default Metrics
Automatically collected via `prom-client`:
- `process_cpu_user_seconds_total` - User CPU time
- `process_cpu_system_seconds_total` - System CPU time
- `process_resident_memory_bytes` - RSS memory usage
- `nodejs_eventloop_delay_seconds` - Event loop delay
- `nodejs_gc_duration_seconds` - Garbage collection duration
- And many more...

### Custom Metrics
Applications can register custom metrics with the InstrumentationRegistry and they will be exported automatically.

### Example Metrics Output

```
# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE process_cpu_user_seconds_total counter
process_cpu_user_seconds_total 12.345

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.001",method="GET",route="/api/users"} 0
http_request_duration_seconds_bucket{le="0.01",method="GET",route="/api/users"} 5
http_request_duration_seconds_bucket{le="0.1",method="GET",route="/api/users"} 42
```

## Accessing Metrics

### Via Prometheus Scraper

Configure Prometheus to scrape your application:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'my-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
    # Optional: Add auth if METRICS_API_KEY is set
    authorization:
      credentials: 'secret123'
      type: Bearer
```

### Manual HTTP Request

```bash
curl http://localhost:3000/metrics

# With authentication
curl -H "Authorization: Bearer secret123" http://localhost:3000/metrics
```

## Integration with @pawells/nestjs-shared HTTPMetricsInterceptor

Combine PrometheusModule with HTTPMetricsInterceptor for automatic HTTP metrics:

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrometheusModule } from '@pawells/nestjs-prometheus';
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
- **Request count** by method and route
- **Request duration** (histogram with default buckets)
- **Response status codes**
- **Path normalization** (dynamic segments like UUIDs are normalized to `:id`)

## Module API

### PrometheusModule.forRoot()

Returns a DynamicModule configured as global, enabling single import at the top level:

```typescript
@Module({
  imports: [PrometheusModule.forRoot()],
})
export class AppModule {}
```

## Class Reference

### PrometheusModule

The main NestJS module. Implements `OnModuleInit` and `OnApplicationShutdown`.

**Static Methods:**
- `forRoot()` - Create global module with automatic registration

**Lifecycle Methods:**
- `onModuleInit()` - Registers the exporter with InstrumentationRegistry
- `onApplicationShutdown()` - Calls exporter.shutdown() to clean up resources

### PrometheusExporter

Implements `IMetricsExporter` from `@pawells/nestjs-shared`.

**Properties:**
- `supportsEventBased` - `true` (buffers metric values)
- `supportsPull` - `true` (supports pull-based retrieval)

**Methods:**
- `onDescriptorRegistered(descriptor: MetricDescriptor)` - Called when a metric is registered; creates the appropriate prom-client instrument
- `onMetricRecorded(value: MetricValue)` - Buffers a metric value to be flushed on next pull
- `getMetrics(): Promise<string>` - Flushes pending values and returns metrics in Prometheus text format
- `shutdown(): Promise<void>` - Clears registry and releases resources

**Internals:**
- Maintains a prom-client `Registry` for instrument management
- Buffers metric values per metric (max 1000 per metric to prevent unbounded memory growth)
- Atomically swaps pending arrays during flush to prevent data loss on concurrent records

### MetricsController

HTTP controller with single endpoint.

**Methods:**
- `getMetrics(response: Response): Promise<void>` - GET /metrics, protected by MetricsGuard

## Advanced Patterns

### Custom Metrics via InstrumentationRegistry

Register custom metrics with `@pawells/nestjs-shared`:

```typescript
import { Injectable } from '@nestjs/common';
import { InstrumentationRegistry } from '@pawells/nestjs-shared';

@Injectable()
export class OrderService {
  constructor(private readonly registry: InstrumentationRegistry) {}

  trackOrderCreation(status: string) {
    // Register descriptor (once)
    this.registry.registerDescriptor({
      name: 'orders_created_total',
      type: 'counter',
      help: 'Total orders created',
      labelNames: ['status'],
    });

    // Record value
    this.registry.recordMetric({
      descriptor: { name: 'orders_created_total' } as MetricDescriptor,
      value: 1,
      labels: { status },
    });
  }
}
```

When metrics are pulled from `/metrics`, they are automatically exported in Prometheus format.

## Metric Types

The PrometheusExporter supports these metric types (as defined in MetricDescriptor):

| Type | Mapping | Usage |
|------|---------|-------|
| `counter` | prom-client Counter | Monotonically increasing values (e.g., request count) |
| `gauge` | prom-client Gauge | Point-in-time values (e.g., memory usage) |
| `updown_counter` | prom-client Gauge | Values that can increase or decrease |
| `histogram` | prom-client Histogram | Distribution of values (e.g., request latency) |

### Gauge and UpDownCounter Accumulation Behavior

**Gauge (`gauge`)**: Records a point-in-time snapshot value. Each recorded value overwrites the previous one for a given label set.

**UpDownCounter (`updown_counter`)**: Accumulates values across scrapes. The PrometheusExporter maintains a running-total Map (`gaugeValues`) for each updown_counter metric, keyed by normalized label set. When a value is recorded:
1. All values for the same label set within a single scrape interval are accumulated together
2. The accumulated sum is then added to the persistent running total
3. This running total persists across Prometheus scrapes (resets only on exporter shutdown)

Example: If you record `+5` then `+3` for the same labels in one scrape cycle, the running total increases by `8` (not just `3`). On the next scrape, if you record `+2`, the running total increases by another `2`.

## Related Packages

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** - Foundation: InstrumentationRegistry, HTTPMetricsInterceptor, MetricsGuard
- **[@pawells/nestjs-open-telemetry](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)** - OpenTelemetry tracing and metrics integration
- **[prom-client](https://github.com/siimon/prom-client)** - Official Prometheus client library for Node.js

## License

MIT
