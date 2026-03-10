## Repository Overview

`@pawells/nestjs-common` is an NX monorepo of NestJS utility libraries published to npm. All packages live under `packages/` and are authored by Aaron Wells (pawells).

- **Package manager**: Yarn 4 (corepack)
- **Build tool**: NX 21 with `@nx/vite` and `@nx/eslint` plugins
- **Test framework**: Vitest
- **Node requirement**: >=24.0.0
- **TypeScript**: ES2022 target, strict mode, `bundler` module resolution

## Commands

Run from the workspace root unless noted.

```bash
# Full pipeline (typecheck → lint → test → build)
yarn pipeline

# Individual steps
yarn typecheck
yarn lint
yarn lint:fix
yarn test
yarn test:coverage
yarn build

# Single package (cd into package first)
cd packages/nestjs-auth
yarn pipeline
yarn test
yarn test:coverage
```

NX caches `build`, `test`, `lint`, and `typecheck` targets. Pass `--skip-nx-cache` to bypass caching.

## Packages

| Package | Purpose |
|---|---|
| `nestjs-shared` | Foundation: filters, guards, interceptors, logging, CSRF, error handling, config, metrics, lazy loading |
| `nestjs-auth` | JWT, sessions, OAuth/OIDC, Keycloak; depends on `nestjs-shared`, `nestjs-open-telemetry`, `nestjs-pyroscope` |
| `nestjs-graphql` | GraphQL module with Redis cache, DataLoaders, subscriptions; depends on `nestjs-shared`, `nestjs-open-telemetry`, `nestjs-pyroscope` |
| `nestjs-open-telemetry` | OTel tracing and metrics integration; depends on `nestjs-shared` |
| `nestjs-prometheus` | Prometheus `/metrics` endpoint; depends on `nestjs-shared` |
| `nestjs-pyroscope` | Pyroscope profiling decorators and interceptors |
| `nestjs-qdrant` | Qdrant vector database module |

`nestjs-shared` is the foundation — all other packages depend on it directly or transitively.

## Architecture Patterns

### Module Design
All modules use `Module.forRoot(options)` dynamic module pattern with typed options interfaces.

### Exports
Each package has a single barrel `index.ts` entry point. `nestjs-shared` additionally exposes conditional exports for `./common` and `./common/utils/lazy-getter.types`.

### Lazy Loading
`LazyGetter` / `OptionalLazyGetter` utilities in `nestjs-shared` defer dependency initialization to avoid circular dependencies. Used when a service needs a dependency that may not always be present.

### Error Handling
`BaseApplicationError` (in `nestjs-shared`) is the base for all custom errors. `ErrorCategorizerService` classifies errors; `ErrorSanitizerService` redacts sensitive data before logging. `GlobalExceptionFilter` maps errors to HTTP responses.

### Auth Decorators
`nestjs-auth` provides `@Auth`, `@Public`, `@Roles`, `@Permissions`, `@CurrentUser`, `@AuthToken` plus GraphQL-specific variants (`@GraphQLAuth`, `@GraphQLRoles`, `@GraphQLCurrentUser`).

### Configuration
All modules use Joi-validated config with service-specific interfaces. Environment variables are the source of truth.

## Code Style

Enforced via ESLint v9 flat config (`eslint.config.mjs`):
- **Indentation**: Tabs
- **Quotes**: Single
- **Semicolons**: Required
- **Trailing commas**: Always (multiline)
- **Access modifiers**: Required on all class members except constructors
- **Return types**: Explicit on all functions
- **Naming**: PascalCase for classes/interfaces/types/enums; camelCase for variables/functions; UPPER_CASE allowed for constants

Test files have relaxed rules (no type annotations required, naming conventions disabled).

## Versioning & Publishing

All packages share a single version defined in the root `package.json`. The `yarn version:sync` command (via `scripts/sync-version.mjs`) propagates it to every package before build. Publishing is triggered by a `v*` tag push and handled by `.github/workflows/publish.yml`.

## Build Output

Each package compiles with `tsc --project tsconfig.build.json` (excludes test files) into a `build/` directory containing `.js`, `.d.ts`, and `.map` files. Test coverage threshold is 80% for lines, functions, branches, and statements.
