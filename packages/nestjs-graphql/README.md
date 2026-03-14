# @pawells/nestjs-graphql

[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-graphql.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-graphql)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

NestJS GraphQL module with Apollo Server 5.x, Redis caching, DataLoaders, subscriptions, and enterprise-grade features.

## Installation

```bash
yarn add @pawells/nestjs-graphql
```

## Requirements

- **Node.js**: >= 24.0.0
- **NestJS**: >= 10.0.0
- **GraphQL**: >= 16.0.0
- **@pawells/nestjs-shared**: same version

## Peer Dependencies

```json
{
  "@nestjs/apollo": ">=12.0.0",
  "@nestjs/cache-manager": ">=2.0.0",
  "@nestjs/common": ">=10.0.0",
  "@nestjs/core": ">=10.0.0",
  "@nestjs/graphql": ">=12.0.0",
  "@pawells/nestjs-auth": "*" (optional),
  "cache-manager": ">=5.0.0",
  "class-transformer": ">=0.5.0",
  "class-validator": ">=0.14.0",
  "dataloader": ">=2.0.0",
  "graphql": ">=16.0.0",
  "graphql-query-complexity": ">=0.12.0",
  "graphql-redis-subscriptions": ">=2.0.0",
  "ioredis": ">=5.0.0",
  "rxjs": ">=7.0.0",
  "uuid": ">=9.0.0"
}
```

## Quick Start

### Basic Setup

```typescript
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@pawells/nestjs-graphql';

@Module({
  imports: [
    GraphQLModule.forRoot({
      autoSchemaFile: 'schema.gql',
      playground: true,
      debug: true,
    }),
  ],
})
export class AppModule {}
```

### With Redis Caching

```typescript
@Module({
  imports: [
    GraphQLModule.forRoot({
      autoSchemaFile: 'schema.gql',
      redis: {
        host: 'localhost',
        port: 6379,
      },
      cache: {
        ttl: 300, // 5 minutes
      },
    }),
  ],
})
export class AppModule {}
```

### DataLoaders

```typescript
import { DataLoaderService, DataLoaderFactoryParams } from '@pawells/nestjs-graphql';

@Injectable()
export class UserLoader {
  private loader: DataLoader<string, User>;

  constructor(
    private userService: UserService,
    private dataLoaderService: DataLoaderService,
  ) {
    this.loader = this.dataLoaderService.createLoader({
      batchScheduleFn: (fn) => process.nextTick(fn),
    }, async (userIds) => {
      return this.userService.findByIds(userIds);
    });
  }

  load(userId: string) {
    return this.loader.load(userId);
  }
}
```

### Subscriptions with Redis

```typescript
@Resolver()
export class NotificationResolver {
  constructor(private pubSub: PubSub) {}

  @Subscription(() => Notification)
  notificationAdded() {
    return this.pubSub.asyncIterator(['NOTIFICATION_ADDED']);
  }

  @Mutation(() => Notification)
  addNotification(@Args() input: CreateNotificationInput) {
    const notification = { id: uuid(), ...input };
    this.pubSub.publish('NOTIFICATION_ADDED', { notificationAdded: notification });
    return notification;
  }
}
```

## Key Features

### Cache Management
- **CacheModule**: Redis-backed caching
- **CacheService**: Cache operations (get, set, delete, clear)
- **CacheInterceptor**: Automatic response caching
- **Cacheable Decorator**: Method-level caching
- **@CacheEvict**: Cache invalidation on mutations
- **@CacheInvalidate**: Selective cache clearing
- **Cache Metrics**: Hit/miss tracking and stats

### Scalars
- **ObjectIdScalar**: MongoDB ObjectId support
- **DateTimeScalar**: ISO 8601 DateTime
- **JSONScalar**: Arbitrary JSON objects

### Pagination
- **Connection**: Cursor-based pagination
- **Edge**: Individual items in connections
- **PageInfo**: Pagination metadata
- **CursorUtils**: Cursor encoding/decoding

### Error Handling
- **GraphQLErrorFormatter**: Structured error responses
- **GraphQLErrorCode**: Standardized error codes
- **Validation Errors**: Class-validator integration

### Query Optimization
- **DataLoaders**: Batch loading to prevent N+1
- **DataLoaderService**: DataLoader factory
- **Query Complexity Analysis**: Prevent expensive queries

### Subscriptions
- **RedisPubSub**: Subscription broadcasting via Redis
- **WebSocket Auth**: Secure WebSocket connections
- **Connection Lifecycle**: On connect/disconnect hooks

### Guards & Interceptors
- **GraphQL Auth Guards**: Authentication enforcement
- **GraphQL Interceptors**: Request/response processing
- **Context Handling**: Request context extraction

### Decorators
- **GraphQL Context Decorators**: Extract context values
- **GraphQL Auth Decorators**: Authentication metadata

## Configuration Options

### GraphQLModule.forRoot()

```typescript
interface GraphQLConfigOptions {
  autoSchemaFile?: string | boolean;
  playground?: boolean;
  debug?: boolean;
  includeStacktraceInErrorResponses?: boolean;

  // Caching
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  cache?: {
    ttl: number;
    maxSize?: number;
  };

  // Subscriptions
  subscriptions?: {
    'graphql-ws': { path: string };
  };

  // Query complexity
  maxQueryComplexity?: number;
}
```

## Advanced Features

### Cursor-Based Pagination

```typescript
import { Connection, Edge, PageInfo, CursorUtils } from '@pawells/nestjs-graphql';

@ObjectType()
export class UserConnection implements Connection<User> {
  @Field(() => [UserEdge])
  edges: Edge<User>[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;
}

@ObjectType()
export class UserEdge implements Edge<User> {
  @Field()
  cursor: string;

  @Field(() => User)
  node: User;
}
```

### Query Complexity Analysis

Prevent expensive queries:

```typescript
@Query(() => [User])
complexQuery() {
  // Automatic complexity calculation based on resolver returns
}
```

## Related Packages

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** - Foundation library
- **[@pawells/nestjs-auth](https://www.npmjs.com/package/@pawells/nestjs-auth)** - Authentication
- **[@pawells/nestjs-open-telemetry](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)** - Tracing
- **[@pawells/nestjs-prometheus](https://www.npmjs.com/package/@pawells/nestjs-prometheus)** - Metrics

## License

MIT
