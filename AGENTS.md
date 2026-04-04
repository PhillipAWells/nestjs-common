## Repository Overview

`@pawells/nestjs-common` is an NX monorepo of NestJS utility libraries published to npm. All packages live under `packages/` and are authored by Aaron Wells (pawells).

- **Package manager**: Yarn 4 (corepack)
- **Build tool**: NX 21 with `@nx/vite` and `@nx/eslint` plugins
- **Test framework**: Vitest
- **Node requirement**: >=22.0.0
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
yarn build

# Single package (cd into package first)
cd packages/nestjs-auth
yarn pipeline
yarn test
yarn test:coverage
```

`yarn test:coverage` is available per-package only, not at the workspace root.

NX caches `build`, `test`, `lint`, and `typecheck` targets. Pass `--skip-nx-cache` to bypass caching.

## Packages

| Package | Purpose |
|---|---|
| `nestjs-shared` | Foundation: filters, guards, interceptors, logging, CSRF, error handling, config, metrics, lazy loading |
| `nestjs-auth` | Keycloak integration library — token validation, admin API, guards, and federated identity; depends on `nestjs-shared` |
| `nestjs-open-telemetry` | OTel tracing and metrics integration; depends on `nestjs-shared` |
| `nestjs-prometheus` | Prometheus `/metrics` endpoint; depends on `nestjs-shared` |
| `nestjs-pyroscope` | Pyroscope profiling decorators and interceptors; depends on `nestjs-shared` |
| `nestjs-qdrant` | Qdrant vector database module; depends on `nestjs-shared` |
| `nestjs-nats` | NATS messaging wrapper (standalone, no cross-package deps) |

`nestjs-shared` is the foundation — most packages depend on it directly or transitively. `nestjs-nats` is standalone.

## Architecture Patterns

### Module Design
All configurable modules use `Module.forRoot(options)` dynamic module pattern with typed options interfaces. Most also provide `forRootAsync` for deferred configuration.

### Exports
Each package has a single barrel `index.ts` entry point. `nestjs-shared` additionally exposes conditional exports for `./common` and `./common/utils/lazy-getter.types`.

### Lazy Loading
`TLazyGetter<T>` / `TOptionalLazyGetter<T>` type aliases and `CreateMemoizedLazyGetter` / `CreateOptionalLazyGetter` factory functions in `nestjs-shared` defer dependency resolution via `ModuleRef` to avoid circular dependencies. Classes implement the `ILazyModuleRefService` interface to use this pattern. In `nestjs-auth`, guards (`JwtAuthGuard`, `RoleGuard`, `PermissionGuard`) use standard NestJS constructor injection; lazy loading is retained only in `KeycloakAdminService`.

### Error Handling
`BaseApplicationError` (in `nestjs-shared`) is the base for all custom errors. `ErrorCategorizerService` classifies errors; `ErrorSanitizerService` redacts sensitive data before logging. `GlobalExceptionFilter` maps errors to HTTP responses.

### Auth Decorators
`nestjs-auth` provides `@Auth`, `@Public`, `@Roles`, `@Permissions`, `@CurrentUser`, `@AuthToken` plus GraphQL-specific variants (`@GraphQLAuth`, `@GraphQLPublic`, `@GraphQLRoles`, `@GraphQLCurrentUser`, `@GraphQLUser`, `@GraphQLAuthToken`, `@GraphQLContextParam`).

### Configuration
Most modules use Joi-validated config with service-specific interfaces. Environment variables are the source of truth. `nestjs-pyroscope` and `nestjs-qdrant` use plain typed interfaces without Joi.

### Security Defaults
- **Token validation** (`nestjs-auth`): Defaults to online introspection via Keycloak's `/token/introspect` endpoint — active session check on every request. Offline JWKS validation is opt-in for services that accept the revocation risk window.
- **CSRF** (`nestjs-shared`): Per-IP token generation is serialized with a 30-second timeout (HTTP 503 on timeout). Maps are cleared on module destroy.
- **CORS** (`nestjs-shared`): Localhost origin matching uses strict regex (`/^http:\/\/localhost(?::\d+)?$/`) to prevent subdomain bypass (e.g., `localhost.evil.com`).
- **HTTP metrics** (`nestjs-shared`): Dynamic path segments (UUIDs, ObjectIDs, numeric IDs) are normalized to `:id` to prevent unbounded metric cardinality.
- **Qdrant API key** (`nestjs-qdrant`): `forRootAsync` uses an internal raw options token so `apiKey` is available for client creation but stripped from the publicly injectable options token.

## Code Style

Enforced via ESLint v9 flat config (`eslint.config.mjs`):
- **Indentation**: Tabs
- **Quotes**: Single
- **Semicolons**: Required
- **Trailing commas**: Always (multiline)
- **Access modifiers**: Required on all class members except constructors
- **Return types**: Explicit on all functions (warn level)
- **Naming**: PascalCase for classes/interfaces/types/enums; camelCase for variables/functions; UPPER_CASE allowed for constants. Class properties and enum members must be PascalCase or UPPER_CASE (camelCase is not allowed).

Test files have relaxed rules (no type annotations required, naming conventions disabled).

## Versioning & Publishing

All packages share a single version defined in the root `package.json`. The `yarn version:sync` inline script propagates it to every package. NX also runs `scripts/sync-version.mjs` as a build dependency per-package to ensure sync before each build. Publishing is triggered by a `v*` tag push and handled by `.github/workflows/publish.yml`.

## Build Output

Each package compiles with `tsc --project tsconfig.build.json` (excludes test files) into a `build/` directory containing `.js`, `.d.ts`, and `.map` files. Test coverage threshold is 80% for lines, functions, branches, and statements.
