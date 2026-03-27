# NestJS NATS Module

[![GitHub Release](https://img.shields.io/github/v/release/PhillipAWells/nestjs-common)](https://github.com/PhillipAWells/nestjs-common/releases)
[![CI](https://github.com/PhillipAWells/nestjs-common/actions/workflows/ci.yml/badge.svg)](https://github.com/PhillipAWells/nestjs-common/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-nats.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-nats)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/PhillipAWells?style=social)](https://github.com/sponsors/PhillipAWells)

NestJS module for NATS pub/sub integration with automatic subscriber discovery, request-reply patterns, and JetStream support.

## Installation

```bash
yarn add @pawells/nestjs-nats @nats-io/transport-node @nats-io/jetstream
```

## Requirements

- **Node.js**: >= 24.0.0
- **NestJS**: >= 10.0.0
- **@nats-io/transport-node**: >= 3.0.0
- **@nats-io/jetstream**: >= 3.0.0

## Peer Dependencies

```json
{
  "@nats-io/jetstream": ">=3.0.0",
  "@nats-io/transport-node": ">=3.0.0",
  "@nestjs/common": ">=10.0.0",
  "@nestjs/core": ">=10.0.0"
}
```

## Quick Start

### Module Setup

```typescript
import { Module } from '@nestjs/common';
import { NatsModule } from '@pawells/nestjs-nats';

@Module({
  imports: [
    NatsModule.forRoot({
      servers: 'nats://localhost:4222',
    }, true), // isGlobal = true
  ],
})
export class AppModule {}
```

### Using NatsService

```typescript
import { Injectable } from '@nestjs/common';
import { NatsService } from '@pawells/nestjs-nats';

@Injectable()
export class OrderService {
  constructor(private readonly natsService: NatsService) {}

  publishOrder(order: Order): void {
    this.natsService.publishJson('orders.created', order);
  }

  async getUser(userId: string): Promise<User> {
    return this.natsService.requestJson<{ id: string }, User>(
      'users.get',
      { id: userId },
    );
  }

  subscribeToOrders(): void {
    this.natsService.subscribe('orders.*', (msg) => {
      console.log('Order received:', msg.json());
    });
  }
}
```

### Automatic Subscriber Discovery with @Subscribe

The `NatsSubscriberRegistry` automatically discovers and registers handler methods decorated with `@Subscribe`:

```typescript
import { Injectable } from '@nestjs/common';
import { Subscribe } from '@pawells/nestjs-nats';
import type { Msg } from '@nats-io/transport-node';

@Injectable()
export class OrderHandler {
  @Subscribe('orders.created')
  async onOrderCreated(msg: Msg): Promise<void> {
    const order = msg.json<Order>();
    console.log('Order created:', order);
    // Handle order creation
  }

  @Subscribe('orders.updated')
  async onOrderUpdated(msg: Msg): Promise<void> {
    const order = msg.json<Order>();
    console.log('Order updated:', order);
  }

  @Subscribe('tasks.process', 'worker-pool')
  async processTask(msg: Msg): Promise<void> {
    const task = msg.json<Task>();
    console.log('Processing task in worker pool:', task);
    // Multiple instances share the queue group for load balancing
  }
}
```

## Async Configuration

### Using a Factory Function

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NatsModule } from '@pawells/nestjs-nats';

@Module({
  imports: [
    ConfigModule.forRoot(),
    NatsModule.forRootAsync(
      {
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: async (configService: ConfigService) => ({
          servers: configService.get('NATS_SERVERS') || 'nats://localhost:4222',
          user: configService.get('NATS_USER'),
          pass: configService.get('NATS_PASS'),
        }),
      },
      true, // isGlobal
    ),
  ],
})
export class AppModule {}
```

### Using a Class-Based Factory

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NatsOptionsFactory, NatsModuleOptions } from '@pawells/nestjs-nats';

@Injectable()
export class NatsConfigService implements NatsOptionsFactory {
  constructor(private configService: ConfigService) {}

  async createNatsOptions(): Promise<NatsModuleOptions> {
    return {
      servers: this.configService.get('NATS_SERVERS') || 'nats://localhost:4222',
      user: this.configService.get('NATS_USER'),
      pass: this.configService.get('NATS_PASS'),
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot(),
    NatsModule.forRootAsync(
      {
        useClass: NatsConfigService,
      },
      true, // isGlobal
    ),
  ],
})
export class AppModule {}
```

### Reuse Existing Factory

```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    NatsModule.forRootAsync(
      {
        useExisting: NatsConfigService,
      },
      true, // isGlobal
    ),
  ],
})
export class AppModule {}
```

## Configuration Options

The `NatsModuleOptions` type extends NATS client's `NodeConnectionOptions` with the following key options:

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `servers` | `string \| string[]` | NATS server URL(s) | `'nats://localhost:4222'` |
| `user` | `string` | Username for authentication | (optional) |
| `pass` | `string` | Password for authentication | (optional) |
| `token` | `string` | Token for authentication | (optional) |
| `timeout` | `number` | Connection timeout in milliseconds | `5000` |
| `reconnect` | `boolean \| number` | Enable auto-reconnect or max attempts | `true` |
| `pingInterval` | `number` | Ping interval in milliseconds | `120000` |
| `maxReconnectAttempts` | `number` | Maximum reconnection attempts | `60` |

**Note**: Sensitive fields (`user`, `pass`, `token`, `authenticator`) are automatically stripped from the publicly injectable `NATS_MODULE_OPTIONS` token for security.

## Key Features

### Core Publishing

```typescript
// Publish raw string/binary message
natsService.publish('orders.created', 'raw message');

// Publish JSON-serialized data
natsService.publishJson('orders.updated', { id: 1, status: 'completed' });
```

### Subscription with Message Handler

```typescript
// Subscribe with automatic handler invocation
const sub = natsService.subscribe('orders.*', (msg) => {
  const order = msg.json();
  console.log('Order:', order);
});

// Unsubscribe when done
sub.unsubscribe();
```

### Request-Reply Pattern

```typescript
// Send request and wait for reply
const reply = await natsService.request('users.get', JSON.stringify({ id: 123 }));
const user = reply.json<User>();

// JSON request and response
const user = await natsService.requestJson<{ id: number }, User>(
  'users.get',
  { id: 123 },
);
```

### JetStream Integration

```typescript
// Get JetStream client for persistent messaging
const js = natsService.jetstream();
await js.publish('orders', 'message');

// Get JetStream manager for administration
const jsm = await natsService.jetstreamManager();
const streams = await jsm.streams.list();
```

### Health Checks

```typescript
// Check connection status
if (natsService.isConnected()) {
  console.log('NATS is connected');
}

// Get raw connection for advanced usage
const conn = natsService.getConnection();
```

## Automatic Subscriber Discovery

The `NatsSubscriberRegistry` service automatically:

1. Scans all NestJS providers and controllers after module initialization
2. Finds methods decorated with `@Subscribe(subject, [queue])`
3. Registers them as subscription handlers via `NatsService.subscribe()`
4. Logs registration with subject and optional queue group

**Note**: Due to NestJS dependency ordering, the `NatsService` connects during module init before `NatsSubscriberRegistry` registers handlers. This ordering is guaranteed and requires no manual configuration.

### Handler Binding

Handlers are automatically bound to their class instance, so `this` context is preserved:

```typescript
@Injectable()
export class OrderHandler {
  private readonly orderService: OrderService;

  constructor(orderService: OrderService) {
    this.orderService = orderService;
  }

  @Subscribe('orders.created')
  async onOrderCreated(msg: Msg): Promise<void> {
    // 'this' refers to OrderHandler instance
    await this.orderService.processOrder(msg.json());
  }
}
```

## Error Handling

Handler errors are logged and do not crash the subscription:

```typescript
@Subscribe('orders.created')
async onOrderCreated(msg: Msg): Promise<void> {
  // If this throws, the error is logged with context
  // The subscription continues listening for the next message
  await processOrder(msg.json());
}
```

Subscription errors (iterator closure, etc.) are logged at debug level.

## Reconnection Behavior

The NATS client library automatically handles reconnection and re-establishes subscriptions. The `NatsService` monitors connection status and logs:

- **disconnect**: When connection is temporarily lost
- **reconnecting**: When attempting to reconnect
- **reconnect**: When reconnection succeeds
- **error**: When an async error occurs (with error details)
- **ldm**: When the server enters lame duck mode

## Security

- **Credentials Sanitization**: User/pass/token are stripped from the public `NATS_MODULE_OPTIONS` token
- **Async Connection**: Module waits for successful connection before becoming available
- **Graceful Shutdown**: Connection is properly drained on application shutdown

## Common Patterns

### Conditional Subscription

```typescript
@Injectable()
export class OrderHandler {
  @Subscribe('orders.created')
  async onOrderCreated(msg: Msg): Promise<void> {
    const order = msg.json<Order>();
    if (order.total > 1000) {
      // Handle high-value orders
      await this.handleHighValueOrder(order);
    }
  }
}
```

### Batch Processing with Queue Groups

```typescript
@Injectable()
export class BatchProcessor {
  @Subscribe('tasks.batch', 'batch-workers')
  async processBatch(msg: Msg): Promise<void> {
    const batch = msg.json<Batch>();
    // Multiple instances process batches concurrently
    // Load is distributed across the 'batch-workers' queue group
    await this.processBatchItems(batch);
  }
}
```

### Multi-Subject Subscriptions

```typescript
@Injectable()
export class EventHandler {
  constructor(private natsService: NatsService) {}

  onModuleInit(): void {
    // Subscribe to multiple subjects manually
    this.natsService.subscribe('orders.*', msg => this.handleOrderEvent(msg));
    this.natsService.subscribe('users.*', msg => this.handleUserEvent(msg));
    this.natsService.subscribe('notifications.>', msg => this.handleNotification(msg));
  }

  private handleOrderEvent(msg: Msg): void { /* ... */ }
  private handleUserEvent(msg: Msg): void { /* ... */ }
  private handleNotification(msg: Msg): void { /* ... */ }
}
```

## Related Packages

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** - Foundation library with filters, guards, interceptors
- **[@pawells/nestjs-auth](https://www.npmjs.com/package/@pawells/nestjs-auth)** - Keycloak authentication integration

## License

MIT
