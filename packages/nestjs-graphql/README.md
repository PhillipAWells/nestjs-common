# @pawells/nestjs-graphql

[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-graphql.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-graphql)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Enterprise-grade NestJS GraphQL module with Apollo Server 5.x, Redis caching, DataLoaders, WebSocket subscriptions, query complexity analysis, and comprehensive error handling.

## Installation

```bash
yarn add @pawells/nestjs-graphql
```

### Optional Dependencies

For WebSocket subscriptions with authentication:
```bash
yarn add @pawells/nestjs-auth
```

For BSON serialization support:
```bash
yarn add bson
```

## Requirements

- **Node.js**: >= 24.0.0
- **NestJS**: >= 10.0.0
- **GraphQL**: >= 16.0.0
- **@pawells/nestjs-shared**: same version
- **Redis**: For caching and pub/sub (optional but recommended)

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
  "cache-manager-redis-store": ">=3.0.0",
  "class-transformer": ">=0.5.0",
  "class-validator": ">=0.14.0",
  "dataloader": ">=2.0.0",
  "graphql": ">=16.0.0",
  "graphql-query-complexity": ">=0.12.0",
  "graphql-redis-subscriptions": ">=2.0.0",
  "graphql-ws": ">=5.0.0",
  "ioredis": ">=5.0.0",
  "mongodb": ">=4.0.0" (optional, for ObjectId scalar),
  "rxjs": ">=7.0.0",
  "uuid": ">=9.0.0",
  "ws": ">=8.0.0"
}
```

## Quick Start

### Basic Module Setup

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
import { Module } from '@nestjs/common';
import { CacheModule, GraphQLModule } from '@pawells/nestjs-graphql';

@Module({
  imports: [
    CacheModule.forRoot(),
    GraphQLModule.forRoot({
      autoSchemaFile: 'schema.gql',
      playground: true,
    }),
  ],
})
export class AppModule {}
```

### Asynchronous Configuration

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@pawells/nestjs-graphql';

@Module({
  imports: [
    ConfigModule.forRoot(),
    GraphQLModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        autoSchemaFile: 'schema.gql',
        playground: configService.get('NODE_ENV') !== 'production',
        debug: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Module Features

### Cache Module

The Cache Module provides Redis-backed caching with automatic storage management, TTL support, and metrics tracking.

#### Basic Usage

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from '@pawells/nestjs-graphql';

@Injectable()
export class UserService {
  constructor(private cacheService: CacheService) {}

  async getUser(id: string) {
    const cached = await this.cacheService.get(`user:${id}`);
    if (cached) return cached;

    const user = await this.db.user.findUnique({ where: { id } });
    await this.cacheService.set(`user:${id}`, user, 300); // 5 minutes

    return user;
  }
}
```

#### @Cacheable Decorator

Automatically cache method results with configurable TTL and cache keys:

```typescript
@Cacheable({ key: 'users:all', ttl: 300000 })
async getAllUsers(): Promise<User[]> {
  return this.db.user.findMany();
}

// Dynamic cache key based on arguments
@Cacheable({
  key: (id: string) => `user:${id}`,
  ttl: 600000,
  condition: (id: string) => id !== 'system', // Skip caching for system user
})
async getUserById(id: string): Promise<User> {
  return this.db.user.findUnique({ where: { id } });
}
```

#### @CacheInvalidate Decorator

Invalidate specific cache keys after mutation:

```typescript
@CacheInvalidate({ keys: 'users:all' })
async createUser(input: CreateUserInput): Promise<User> {
  return this.db.user.create({ data: input });
}

// Multiple keys with dynamic generation
@CacheInvalidate({
  keys: (userId: string) => [
    'users:all',
    `user:${userId}`,
    `user:${userId}:profile`,
  ],
})
async updateUser(userId: string, input: UpdateUserInput): Promise<User> {
  return this.db.user.update({ where: { id: userId }, data: input });
}
```

#### @CacheEvict Decorator

Pattern-based cache invalidation (requires Redis):

```typescript
// Evict all keys matching the pattern
@CacheEvict({ pattern: 'post:*' })
async deleteAllPosts(): Promise<void> {
  return this.db.post.deleteMany();
}
```

#### Cache Service API

```typescript
// Get value from cache
const value = await cacheService.get('key');

// Set value with TTL (milliseconds)
await cacheService.set('key', value, 60000); // 1 minute

// Delete specific key
await cacheService.del('key');

// Clear all cache
await cacheService.clear();

// Get cache statistics
const stats = await cacheService.getStats();
```

### GraphQL Configuration

#### Module.forRoot() Options

```typescript
interface GraphQLConfigOptions {
  // Schema file configuration
  autoSchemaFile?: string | boolean;    // Path or true for temp file
  sortSchema?: boolean;                 // Alphabetically sort schema

  // Server options
  playground?: boolean;                 // GraphQL Playground UI
  introspection?: boolean;              // Allow introspection queries
  debug?: boolean;                      // Enable Apollo debug mode

  // Custom context and CORS
  context?: (ctx) => object;
  cors?: CorsOptions | boolean;

  // Error handling
  formatError?: (error) => object;
  errorHandling?: {
    includeStackTrace?: boolean;        // Dev-only stack traces
    errorCodes?: Record<string, string>; // Custom error codes
  };

  // Query complexity limits
  maxQueryComplexity?: number;

  // BSON serialization
  bson?: {
    enabled?: boolean;
    maxPayloadSize?: number;            // Default: 10MB
  };
}
```

### Custom Scalars

#### ObjectId Scalar

For MongoDB ObjectId support:

```typescript
import { ObjectType, Field, ObjectId as GraphQLObjectId } from '@pawells/nestjs-graphql';

@ObjectType()
export class Post {
  @Field(() => ObjectIdScalar)
  _id: ObjectId;

  @Field()
  title: string;
}
```

Query with ObjectId:

```typescript
@Query(() => Post)
async getPost(
  @Args('id', { type: () => ObjectIdScalar }) id: ObjectId
): Promise<Post> {
  return this.postService.findById(id);
}
```

#### DateTime Scalar

ISO 8601 DateTime strings (automatically used by NestJS):

```typescript
import { DateTimeScalar } from '@pawells/nestjs-graphql';

@ObjectType()
export class User {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field(() => DateTimeScalar)
  createdAt: Date;

  @Field(() => DateTimeScalar)
  updatedAt: Date;
}
```

#### JSON Scalar

For arbitrary JSON objects:

```typescript
import { JSONScalar } from '@pawells/nestjs-graphql';

@ObjectType()
export class Post {
  @Field()
  id: string;

  @Field(() => JSONScalar)
  metadata: Record<string, any>;
}
```

### Cursor-Based Pagination

Relay-style cursor-based pagination with PageInfo:

```typescript
import { Connection, Edge, PageInfo, CursorUtils } from '@pawells/nestjs-graphql';

@ObjectType()
export class UserConnection {
  @Field(() => [UserEdge])
  edges: UserEdge[];

  @Field()
  pageInfo: PageInfo;

  @Field()
  totalCount: number;
}

@ObjectType()
export class UserEdge {
  @Field()
  cursor: string;

  @Field(() => User)
  node: User;
}

// Usage in resolver
@Query(() => UserConnection)
async getUsers(
  @Args('first', { type: () => Int, nullable: true }) first?: number,
  @Args('after', { nullable: true }) after?: string,
): Promise<UserConnection> {
  const users = await this.userService.findMany();

  const { edges, pageInfo } = this.graphQLService.paginateItems(
    users,
    first,
    after,
  );

  return {
    edges: edges.map((edge) => ({
      cursor: edge.cursor,
      node: edge.node,
    })),
    pageInfo,
    totalCount: users.length,
  };
}

// Manual cursor operations
const cursor = CursorUtils.encodeCursor('user:123', Date.now());
const decoded = CursorUtils.decodeCursor(cursor); // { id: 'user:123', timestamp: ... }
```

### DataLoaders

Prevent N+1 queries with batch loading:

```typescript
import { Injectable } from '@nestjs/common';
import { DataLoaderRegistry } from '@pawells/nestjs-graphql';

@Injectable()
export class UserLoader {
  constructor(
    private dataloaderRegistry: DataLoaderRegistry,
    private userService: UserService,
  ) {}

  // Use in request scope
  loadUser(userId: string) {
    return this.dataloaderRegistry.getOrCreate(
      'users',
      {
        batchLoadFn: async (userIds: readonly string[]) => {
          const users = await this.userService.findByIds(userIds);
          // Return users in same order as userIds
          return userIds.map(id => users.find(u => u.id === id));
        },
      },
    ).load(userId);
  }
}

// Usage in resolver
@Resolver(() => Post)
export class PostResolver {
  @ResolveField(() => User)
  async author(@Parent() post: Post) {
    return this.userLoader.loadUser(post.authorId);
  }
}
```

### Query Complexity Analysis

Prevent expensive queries that could impact performance:

```typescript
import { QueryComplexityGuard } from '@pawells/nestjs-graphql';

@UseGuards(QueryComplexityGuard)
@Query(() => [Post])
async posts(
  @Args('limit', { type: () => Int, nullable: true }) limit?: number,
): Promise<Post[]> {
  // Query complexity is calculated and validated
  return this.postService.findMany();
}
```

Configure limits in module setup:

```typescript
GraphQLModule.forRoot({
  // ... other options
  maxQueryComplexity: 500, // Complexity score limit
})
```

### WebSocket Subscriptions

Real-time subscriptions with WebSocket support:

#### Basic Setup

```typescript
import { Resolver, Subscription, Mutation, Args } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';

const pubSub = new PubSub();

@Resolver()
export class NotificationResolver {
  @Subscription(() => String)
  notificationAdded() {
    return pubSub.asyncIterator('notification.added');
  }

  @Mutation(() => String)
  async sendNotification(@Args('message') message: string) {
    pubSub.publish('notification.added', { notificationAdded: message });
    return message;
  }
}
```

#### With Redis PubSub (Distributed)

For multi-instance deployments:

```typescript
import { Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisPubSub } from 'graphql-redis-subscriptions';

@Module({
  providers: [
    {
      provide: 'PUB_SUB',
      useFactory: () => {
        return new RedisPubSub({
          connection: {
            host: 'localhost',
            port: 6379,
          },
        });
      },
    },
  ],
  exports: ['PUB_SUB'],
})
export class SubscriptionModule {}
```

#### Authentication with WebSocket

WebSocket connections require JwtService for signature verification (fails closed for security):

```typescript
// Client side - send token in connection params
const client = new WebSocketLink({
  uri: 'ws://localhost:3000/graphql/subscriptions',
  connectionParams: () => ({
    authorization: `Bearer ${token}`,
  }),
});

// Server side - WebSocketAuthService validates token cryptographically
// If JwtService is unavailable, all WebSocket auth fails (fail-closed)
```

#### WebSocket Server Configuration

Configure subscriptions in GraphQL module:

```typescript
import { GraphQLWebSocketServer } from '@pawells/nestjs-graphql';

@Module({
  imports: [
    GraphQLModule.forRoot({
      // ... other options
    }),
  ],
  providers: [GraphQLWebSocketServer],
})
export class AppModule implements OnModuleInit {
  constructor(private wsServer: GraphQLWebSocketServer) {}

  onModuleInit() {
    this.wsServer.configure({
      path: '/graphql/subscriptions',
      maxPayloadSize: 102400,  // 100KB
      keepalive: 30000,        // 30 seconds
      connectionTimeout: 60000, // 60 seconds
      maxConnections: 1000,
    });
  }
}
```

### Error Handling

#### GraphQLErrorFormatter

Structured error responses with standardized codes:

```typescript
import { GraphQLErrorCode, GraphQLErrorFormatter } from '@pawells/nestjs-graphql';

// Errors are automatically formatted by the module
// Clients receive consistent error structures:
{
  "errors": [{
    "message": "User not found",
    "extensions": {
      "code": "NOT_FOUND",
      "timestamp": "2024-03-14T12:00:00.000Z",
      "details": {}
    }
  }]
}
```

#### Standard Error Codes

```typescript
enum GraphQLErrorCode {
  // Authentication & Authorization
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',

  // Input Validation
  BAD_USER_INPUT = 'BAD_USER_INPUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Business Logic
  CONFLICT = 'CONFLICT',
  NOT_FOUND = 'NOT_FOUND',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // System Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}
```

#### Validation Error Handling

Class-validator integration provides structured validation errors:

```typescript
import { IsEmail, IsNotEmpty } from 'class-validator';
import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateUserInput {
  @Field()
  @IsNotEmpty()
  name: string;

  @Field()
  @IsEmail()
  email: string;
}

// Validation errors are formatted as:
{
  "errors": [{
    "message": "Validation failed",
    "extensions": {
      "code": "BAD_USER_INPUT",
      "validationErrors": [
        {
          "field": "email",
          "constraints": { "isEmail": "email must be an email" }
        }
      ]
    }
  }]
}
```

### Guards

#### GraphQLAuthGuard

Requires authentication for resolvers:

```typescript
import { UseGuards } from '@nestjs/common';
import { GraphQLAuthGuard } from '@pawells/nestjs-graphql';

@UseGuards(GraphQLAuthGuard)
@Query(() => String)
async getCurrentUser(): Promise<string> {
  // Only authenticated users can access
  return 'user-data';
}
```

#### GraphQLPublicGuard

Marks resolvers as publicly accessible:

```typescript
import { GraphQLPublic } from '@pawells/nestjs-auth';

@GraphQLPublic()
@Query(() => String)
async health(): Promise<string> {
  return 'OK';
}
```

#### GraphQLRolesGuard

Role-based access control:

```typescript
import { UseGuards } from '@nestjs/common';
import { Roles } from '@pawells/nestjs-auth';
import { GraphQLRolesGuard } from '@pawells/nestjs-graphql';

@UseGuards(GraphQLRolesGuard)
@Roles('admin', 'moderator')
@Query(() => [User])
async allUsers(): Promise<User[]> {
  // Only admin or moderator roles can access
  return this.userService.findMany();
}
```

#### QueryComplexityGuard

Enforces query complexity limits:

```typescript
import { UseGuards } from '@nestjs/common';
import { QueryComplexityGuard } from '@pawells/nestjs-graphql';

@UseGuards(QueryComplexityGuard)
@Query(() => [Post])
async expensiveQuery(): Promise<Post[]> {
  // Query complexity is validated before execution
  return this.postService.findExpensive();
}
```

#### GraphQLRateLimitGuard

Rate limiting per user or IP:

```typescript
import { UseGuards } from '@nestjs/common';
import { GraphQLRateLimitGuard } from '@pawells/nestjs-graphql';

@UseGuards(GraphQLRateLimitGuard)
@Mutation(() => String)
async createPost(@Args() input: CreatePostInput): Promise<string> {
  // Rate limited to default: 100 requests per 15 minutes
  return this.postService.create(input);
}
```

Configure custom limits:

```typescript
import { RateLimitService } from '@pawells/nestjs-graphql';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private rateLimitService: RateLimitService) {}

  onModuleInit() {
    // 50 requests per minute for mutations
    this.rateLimitService.setOperationConfig('mutation', {
      maxRequests: 50,
      windowMs: 60000, // 1 minute
    });
  }
}
```

### Interceptors

#### GraphQLLoggingInterceptor

Automatic GraphQL operation logging:

```typescript
@Injectable()
@UseInterceptors(GraphQLLoggingInterceptor)
export class PostResolver {
  @Query(() => [Post])
  async posts(): Promise<Post[]> {
    // Automatically logged with operation name, arguments, and execution time
    return this.postService.findMany();
  }
}
```

#### GraphQLErrorInterceptor

Consistent error formatting and logging:

```typescript
@UseInterceptors(GraphQLErrorInterceptor)
@Query(() => String)
async riskyOperation(): Promise<string> {
  // Errors are automatically formatted and logged
  return this.service.risky();
}
```

#### GraphQLPerformanceInterceptor

Track and report resolver performance:

```typescript
@UseInterceptors(GraphQLPerformanceInterceptor)
@Query(() => [Post])
async slowQuery(): Promise<Post[]> {
  // Execution time is tracked and logged
  return this.postService.slowQuery();
}
```

### Context Handling

Access GraphQL context with typed decorators:

```typescript
import { GraphQLContextParam, GraphQLCurrentUser } from '@pawells/nestjs-graphql';

@Query(() => User)
async me(
  @GraphQLContextParam() context: any,
  @GraphQLCurrentUser() user: User,
): Promise<User> {
  // context contains req, res, and other GraphQL context
  // user is extracted from context.req.user
  return user;
}
```

### BSON Serialization

Opt-in BSON support for binary serialization:

```typescript
GraphQLModule.forRoot({
  autoSchemaFile: 'schema.gql',
  bson: {
    enabled: true,
    maxPayloadSize: 10485760, // 10MB
  },
})
```

Benefits:
- Binary serialization reduces payload size
- More efficient for large datasets
- Direct MongoDB BSON compatibility

## Performance Monitoring

### Metrics Collection

The module provides built-in metrics for:
- Cache hit/miss rates
- Query complexity scores
- Resolver execution times
- Rate limit statistics
- DataLoader batch sizes

Access metrics programmatically:

```typescript
import { CacheService, RateLimitService } from '@pawells/nestjs-graphql';

@Injectable()
export class MetricsService {
  constructor(
    private cacheService: CacheService,
    private rateLimitService: RateLimitService,
  ) {}

  async getMetrics() {
    const cacheStats = await this.cacheService.getStats();
    const rateLimitStats = this.rateLimitService.getStats();

    return {
      cache: cacheStats,
      rateLimit: rateLimitStats,
    };
  }
}
```

## Security

### Default Behaviors

- **WebSocket Auth**: JwtService required for signature verification — fails closed
- **Query Complexity**: Enforced by default to prevent DoS attacks
- **Token Blacklist**: Tokens treated as blacklisted when cache unavailable
- **CORS**: Strict localhost matching to prevent subdomain bypass
- **Rate Limiting**: Default 100 requests per 15 minutes per client

### Best Practices

1. **Always enable authentication** for production GraphQL endpoints
2. **Use Redis for caching** in distributed deployments
3. **Set realistic query complexity limits** for your schema
4. **Configure BSON** if handling large payloads
5. **Monitor rate limit metrics** for abuse patterns
6. **Enable introspection** in development only

## Configuration Reference

### Environment Variables

```bash
# Redis connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional
REDIS_DB=0

# GraphQL
GRAPHQL_PLAYGROUND=true
GRAPHQL_DEBUG=true
GRAPHQL_INTROSPECTION=true

# Node
NODE_ENV=development
```

### Complete Example

See `examples/` directory for a complete working application.

## Troubleshooting

### Cache not working

- Ensure Redis is running and accessible
- Check `REDIS_HOST` and `REDIS_PORT` environment variables
- Verify cache keys are deterministic

### WebSocket subscriptions not connecting

- Check `/graphql/subscriptions` path is accessible
- Verify JWT token is valid (if auth enabled)
- Check `ws://` protocol in client connection
- Verify `JwtService` is available (required for auth)

### Query complexity errors

- Increase `maxQueryComplexity` if legitimate queries fail
- Check query structure for nested selections
- Use DataLoaders to batch load related data

### Memory issues

- Reduce `maxBatchSize` in DataLoader options
- Implement cache key strategy to avoid unbounded growth
- Monitor cache hit rates and adjust TTLs

## Related Packages

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** - Foundation library with guards, filters, and utilities
- **[@pawells/nestjs-auth](https://www.npmjs.com/package/@pawells/nestjs-auth)** - JWT, sessions, OAuth, Keycloak
- **[@pawells/nestjs-open-telemetry](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)** - Distributed tracing
- **[@pawells/nestjs-prometheus](https://www.npmjs.com/package/@pawells/nestjs-prometheus)** - Prometheus metrics
- **[@pawells/nestjs-pyroscope](https://www.npmjs.com/package/@pawells/nestjs-pyroscope)** - Continuous profiling

## License

MIT
