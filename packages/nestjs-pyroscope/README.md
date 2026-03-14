# @pawells/nestjs-pyroscope

[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-pyroscope.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-pyroscope)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Pyroscope profiling integration for NestJS with decorators and interceptors for continuous profiling.

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

## Quick Start

### Module Setup

```typescript
import { Module } from '@nestjs/common';
import { PyroscopeModule } from '@pawells/nestjs-pyroscope';

@Module({
  imports: [
    PyroscopeModule.forRoot({
      serverAddress: 'http://localhost:4040',
      appName: 'my-nestjs-app',
      enabled: process.env.NODE_ENV === 'production',
    }),
  ],
})
export class AppModule {}
```

### Using @Profile Decorator

Profile specific methods:

```typescript
import { Profile } from '@pawells/nestjs-pyroscope';

@Injectable()
export class UserService {
  @Profile()
  async findAllUsers() {
    // Automatic profiling of this method
    return await this.userRepository.find({});
  }

  @Profile('custom.profile.name')
  async complexQuery() {
    // Custom profile name
    return await this.compute();
  }
}
```

### Using @ProfileMethod Decorator

For synchronous methods:

```typescript
import { ProfileMethod } from '@pawells/nestjs-pyroscope';

@Injectable()
export class CalculationService {
  @ProfileMethod()
  calculateHash(data: string): string {
    // Synchronous method profiling
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
```

### Using @ProfileAsync Decorator

For async operations:

```typescript
import { ProfileAsync } from '@pawells/nestjs-pyroscope';

@Injectable()
export class DataProcessingService {
  @ProfileAsync('data.processing')
  async processLargeDataset(data: any[]) {
    // Async profiling with custom name
    return data.map(item => this.transform(item));
  }
}
```

### Using ProfilingInterceptor

Global profiling across all routes:

```typescript
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

### Health Monitoring

```typescript
import { HealthCheckService } from '@nestjs/terminus';
import { ProfilingHealthIndicator } from '@pawells/nestjs-pyroscope';

@Injectable()
export class HealthController implements OnModuleInit {
  constructor(
    private health: HealthCheckService,
    private profiling: ProfilingHealthIndicator,
  ) {}

  @Get('health')
  check() {
    return this.health.check([
      () => this.profiling.isHealthy(),
    ]);
  }
}
```

## Key Features

### Profiling Decorators
- **@Profile**: General method profiling
- **@ProfileMethod**: Synchronous method profiling
- **@ProfileAsync**: Asynchronous method profiling
- **Custom Names**: Specify custom profile identifiers

### Interceptors
- **ProfilingInterceptor**: Global request profiling
- **Route-level Profiling**: Per-controller profiling

### Services
- **PyroscopeService**: Configuration and management
- **MetricsService**: Profiling metrics and statistics
- **ProfilingHealthIndicator**: Health check integration

### Utilities
- **ProfilingConfigValidator**: Config validation
- **TagFormatter**: Profile tag formatting
- **MetricAggregator**: Aggregate profiling metrics
- **ProfilingErrorHandler**: Error handling
- **generateProfileId**: Generate unique profile IDs
- **formatDuration**: Format duration values
- **isProfilingEnabled**: Check if profiling is active

## Configuration

### PyroscopeModule.forRoot()

```typescript
interface IPyroscopeConfig {
  serverAddress: string; // Pyroscope server URL
  appName: string; // Application name for profiling
  appVersion?: string; // Application version
  environment?: string; // Environment (dev, staging, prod)
  enabled: boolean; // Enable/disable profiling
  tags?: Record<string, string>; // Global tags
  sampleRate?: number; // Sampling rate (0-100)
  heapProfiler?: {
    enabled: boolean;
    sampleRate?: number;
  };
  cpuProfiler?: {
    enabled: boolean;
  };
}
```

### forRootAsync()

```typescript
PyroscopeModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    serverAddress: configService.get('PYROSCOPE_SERVER'),
    appName: configService.get('SERVICE_NAME'),
    enabled: configService.get('NODE_ENV') === 'production',
    tags: {
      region: configService.get('REGION'),
      version: configService.get('APP_VERSION'),
    },
  }),
  inject: [ConfigService],
})
```

## Metrics

Get profiling metrics:

```typescript
import { MetricsService } from '@pawells/nestjs-pyroscope';

@Controller('profiling')
export class ProfilingController {
  constructor(private metrics: MetricsService) {}

  @Get('metrics')
  getMetrics() {
    return this.metrics.getMetrics();
  }
}
```

Response format:

```typescript
interface MetricsResponse {
  totalProfiles: number;
  activeProfiles: number;
  cpuSamples: number;
  heapSamples: number;
  lastProfileAt: Date;
  averageDuration: number;
  profilesByName: Record<string, {
    count: number;
    totalDuration: number;
    averageDuration: number;
  }>;
}
```

## Best Practices

### 1. Selective Profiling
Only profile critical paths and hot functions:

```typescript
@Profile() // Profile only what matters
async criticalOperation() {
  // ...
}
```

### 2. Named Profiles
Use descriptive profile names for better analysis:

```typescript
@Profile('user.repository.findById')
async findById(id: string) {
  // ...
}
```

### 3. Conditional Profiling
Enable/disable based on environment:

```typescript
@Profile(process.env.NODE_ENV === 'production' ? 'api.handler' : undefined)
async handler() {
  // ...
}
```

### 4. Environment Tags
Add context to profiles:

```typescript
PyroscopeModule.forRoot({
  serverAddress: 'http://localhost:4040',
  appName: 'my-app',
  tags: {
    environment: process.env.NODE_ENV,
    region: process.env.REGION,
    version: process.env.APP_VERSION,
  },
})
```

## Integration with Other Packages

Works seamlessly with:
- **[@pawells/nestjs-open-telemetry](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)** - Distributed tracing
- **[@pawells/nestjs-prometheus](https://www.npmjs.com/package/@pawells/nestjs-prometheus)** - Metrics export

## Related Packages

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** - Foundation library
- **[@pawells/nestjs-open-telemetry](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)** - Distributed tracing

## License

MIT
