# @pawells/nestjs-common

A comprehensive collection of NestJS utility libraries for building enterprise-grade applications. Built and maintained by [Aaron Wells](https://github.com/PhillipAWells).

## Overview

`@pawells/nestjs-common` is an NX monorepo publishing a suite of reusable, battle-tested NestJS packages to npm. Each package is modular, well-tested (80%+ coverage), and designed to work independently or together.

- **Package Manager**: Yarn 4 (corepack)
- **Build Tool**: NX 21
- **Test Framework**: Vitest
- **Node Requirement**: >=22.0.0
- **License**: MIT

## Packages

All packages follow semantic versioning and share a single version in the root `package.json`. Use individual packages as needed for your application.

### Foundation

#### [@pawells/nestjs-shared](packages/nestjs-shared)
Shared NestJS infrastructure: global filters, guards, interceptors, logging, CSRF protection, error handling, configuration, metrics, and lazy-loading utilities.

```bash
yarn add @pawells/nestjs-shared
```

**Key Exports:**
- `GlobalExceptionFilter` — maps errors to HTTP responses
- `BaseApplicationError` — base for custom errors
- `ErrorCategorizerService`, `ErrorSanitizerService` — error classification and logging
- `LazyGetter`, `OptionalLazyGetter` — lazy dependency resolution
- CSRF, CORS, security middlewares
- HTTP metrics normalization

---

### Authentication & Authorization

#### [@pawells/nestjs-auth](packages/nestjs-auth)
JWT, sessions, OAuth/OIDC, and Keycloak authentication with rate limiting and token blacklisting. Provides decorators for role-based and permission-based access control.

**Depends on:** `nestjs-shared`, `nestjs-open-telemetry`, `nestjs-pyroscope`

```bash
yarn add @pawells/nestjs-auth
```

**Key Features:**
- JWT and session strategies (Passport.js integration)
- OAuth/OIDC and Keycloak support
- `@Auth`, `@Public`, `@Roles`, `@Permissions`, `@CurrentUser`, `@AuthToken` decorators
- GraphQL-specific variants: `@GraphQLAuth`, `@GraphQLRoles`, `@GraphQLCurrentUser`, etc.
- Token blacklisting with fail-closed cache semantics
- Rate limiting on logout and refresh endpoints

---

### GraphQL

#### [@pawells/nestjs-graphql](packages/nestjs-graphql)
GraphQL module with Redis-backed subscriptions, DataLoaders, caching, and WebSocket authentication.

**Depends on:** `nestjs-shared`, `nestjs-open-telemetry`, `nestjs-pyroscope`

```bash
yarn add @pawells/nestjs-graphql
```

**Key Features:**
- Apollo Server integration with NestJS
- DataLoaders for N+1 query prevention
- Redis-backed subscriptions
- WebSocket authentication (requires `JwtService`)
- Query complexity analysis
- Integration with `nestjs-auth` decorators

---

### Observability

#### [@pawells/nestjs-open-telemetry](packages/nestjs-open-telemetry)
OpenTelemetry integration with distributed tracing, metrics collection, and logger adapter.

**Depends on:** `nestjs-shared`

```bash
yarn add @pawells/nestjs-open-telemetry
```

**Key Exports:**
- OTel tracing configuration
- Metrics integration
- Logger adapter for structured logging

---

#### [@pawells/nestjs-prometheus](packages/nestjs-prometheus)
Prometheus `/metrics` endpoint controller for scraping application metrics.

**Depends on:** `nestjs-shared`

```bash
yarn add @pawells/nestjs-prometheus
```

**Key Feature:**
- Ready-to-use `/metrics` endpoint for Prometheus scraping
- Works seamlessly with `nestjs-shared` HTTP metrics

---

#### [@pawells/nestjs-pyroscope](packages/nestjs-pyroscope)
Pyroscope profiling decorators and interceptors for continuous profiling.

**Standalone** (no cross-package dependencies)

```bash
yarn add @pawells/nestjs-pyroscope
```

**Key Feature:**
- Application profiling decorators and interceptors

---

### Database & Vector Search

#### [@pawells/nestjs-qdrant](packages/nestjs-qdrant)
Qdrant vector database module for vector storage and similarity search.

**Standalone** (no cross-package dependencies)

```bash
yarn add @pawells/nestjs-qdrant
```

**Key Feature:**
- Qdrant client integration and configuration
- Secure API key handling

---

## Quick Start

### Basic Setup

```typescript
import { Module } from '@nestjs/common';
import { SharedModule } from '@pawells/nestjs-shared';
import { AuthModule } from '@pawells/nestjs-auth';

@Module({
  imports: [
    SharedModule.forRoot({
      corsOrigin: /^http:\/\/localhost(?::\d+)?$/,
      csrf: { enabled: true },
    }),
    AuthModule.forRoot({
      jwt: { secret: process.env.JWT_SECRET },
    }),
  ],
})
export class AppModule {}
```

### With GraphQL

```typescript
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@pawells/nestjs-graphql';

@Module({
  imports: [
    GraphQLModule.forRoot({
      autoSchemaFile: true,
      subscriptions: { redis: 'redis://localhost:6379' },
    }),
  ],
})
export class AppModule {}
```

### Full Observability Stack

```typescript
import { Module } from '@nestjs/common';
import { OpenTelemetryModule } from '@pawells/nestjs-open-telemetry';
import { PrometheusModule } from '@pawells/nestjs-prometheus';

@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      serviceName: 'my-app',
    }),
    PrometheusModule,
  ],
})
export class AppModule {}
```

---

## Development

### Workspace Commands

Run commands from the workspace root:

```bash
# Full pipeline (typecheck → lint → test → build)
yarn pipeline

# Individual steps
yarn typecheck
yarn lint
yarn lint:fix
yarn test
yarn build
```

### Single Package

To work on a single package, navigate to its directory:

```bash
cd packages/nestjs-auth
yarn pipeline
yarn test
yarn test:coverage
```

### NX Caching

NX automatically caches `build`, `test`, `lint`, and `typecheck` targets. To skip the cache:

```bash
yarn test --skip-nx-cache
```

---

## Architecture

### Module Design

All configurable modules use the dynamic module pattern with `Module.forRoot(options)` and most provide `forRootAsync` for deferred configuration.

### Error Handling

Custom errors extend `BaseApplicationError`. The `ErrorCategorizerService` classifies errors and `ErrorSanitizerService` redacts sensitive data before logging. `GlobalExceptionFilter` maps errors to HTTP responses.

### Lazy Loading

Use `LazyGetter<T>` and `OptionalLazyGetter<T>` type aliases with factory functions to defer dependency resolution and avoid circular dependencies.

### Security Defaults

- **Token Blacklist** (`nestjs-auth`): Fails closed — tokens are blacklisted when cache is unavailable
- **WebSocket Auth** (`nestjs-graphql`): Requires `JwtService` for token verification; all authentications fail without it
- **CSRF** (`nestjs-shared`): Per-IP token generation with 30-second timeout (HTTP 503 on timeout)
- **CORS** (`nestjs-shared`): Strict localhost regex to prevent subdomain bypass
- **HTTP Metrics** (`nestjs-shared`): Dynamic path segments normalized to `:id` for bounded cardinality
- **Qdrant API Key** (`nestjs-qdrant`): Stripped from public injectable options; only available during client creation

---

## Versioning & Publishing

All packages share a single version defined in the root `package.json`. Version sync is handled automatically:

```bash
yarn version:sync
```

Publishing is triggered by pushing a `v*` git tag. The CI/CD workflow (`.github/workflows/publish.yml`) automatically publishes all packages to npm.

---

## Code Style

Enforced via ESLint v9 flat config:

- **Indentation**: Tabs
- **Quotes**: Single quotes
- **Semicolons**: Required
- **Trailing Commas**: Always (multiline)
- **Access Modifiers**: Required on all class members except constructors
- **Return Types**: Explicit on all functions
- **Naming**:
  - `PascalCase` for classes, interfaces, types, enums
  - `camelCase` for variables and functions
  - `UPPER_CASE` allowed for constants and enum members

Run `yarn lint:fix` to automatically fix style issues.

---

## Testing

Test framework: Vitest (runs on `yarn test`)

Coverage requirements: 80%+ for lines, functions, branches, and statements.

```bash
# Run all tests
yarn test

# Run with coverage per-package
cd packages/nestjs-auth
yarn test:coverage
```

---

## Resources

- **Repository**: [github.com/PhillipAWells/nestjs-common](https://github.com/PhillipAWells/nestjs-common)
- **NPM Scope**: [@pawells](https://www.npmjs.com/org/pawells)
- **Author**: [Aaron Wells](https://github.com/PhillipAWells)

---

## License

MIT
