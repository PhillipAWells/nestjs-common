# NestJS Common Packages: NX Monorepo Migration Guide

## Quick Reference

This guide documents the migration of 7 standalone NestJS packages into a single NX monorepo.

**Location**: `/workspaces/pawells/projects/nestjs-common/`

**Packages Being Migrated**:
- `nestjs-shared` (base layer)
- `nestjs-prometheus` (depends on nestjs-shared)
- `nestjs-open-telemetry` (depends on nestjs-shared, open-telemetry-client)
- `nestjs-auth` (no internal deps)
- `nestjs-graphql` (no internal deps)
- `nestjs-pyroscope` (no internal deps)
- `nestjs-qdrant` (no internal deps)

---

## Key Design Decisions

### 1. **Preserve Per-Package Configuration**
Each package maintains its own:
- `package.json` (for npm publishing)
- `project.json` (for NX targets)
- `src/` (source code)
- `vitest.config.ts` (testing)
- `tsconfig.json`, `tsconfig.build.json`, `tsconfig.test.json`, `tsconfig.eslint.json`

This ensures:
- Clear package boundaries
- Independent npm publishing
- Per-package build/test/lint targets
- Individual version management

### 2. **Unified Workspace Configuration**
The workspace root provides:
- Single `package.json` with dev dependencies and shared scripts
- `tsconfig.base.json` with path mappings
- `nx.json` with NX configuration and plugins
- `eslint.config.mjs` for workspace-wide linting
- Single `yarn.lock` (Yarn workspace semantics)

### 3. **ESM-Only, Vitest-Only**
- All packages remain `"type": "module"`
- Build target: ES2022
- Module resolution: bundler
- Testing: Vitest (not Jest)
- No build tool (tsc directly)

### 4. **Workspace Protocol for Dependencies**
Packages with inter-dependencies use `workspace:*` protocol:

```json
{
  "dependencies": {
    "@pawells/nestjs-shared": "workspace:*"
  }
}
```

This resolves to the local package during development and converts to semantic versioning when published.

### 5. **NX Caching & Task Orchestration**
- `nx.json` defines build, test, lint, typecheck targets with caching enabled
- `dependsOn: ["^build"]` ensures dependencies build first
- Single `yarn pipeline` script runs all checks for all packages

---

## File Structure

```
projects/nestjs-common/
├── package.json                      # Workspace root (private)
├── nx.json                           # NX configuration
├── tsconfig.base.json                # Base TS config with path mappings
├── tsconfig.eslint.json              # ESLint TS config
├── eslint.config.mjs                 # Shared ESLint config
├── .yarnrc.yml                       # Yarn Berry config
├── .gitignore                        # Workspace gitignore
│
├── packages/
│   ├── nestjs-shared/
│   │   ├── src/                      # TypeScript source
│   │   │   ├── index.ts              # Main entry
│   │   │   ├── logging/              # Subpath export
│   │   │   ├── security/             # Subpath export
│   │   │   ├── validation/           # Subpath export
│   │   │   ├── metrics/              # Subpath export
│   │   │   └── errors/               # Subpath export
│   │   ├── build/                    # Compiled output (gitignored)
│   │   ├── package.json              # npm config
│   │   ├── project.json              # NX config
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── tsconfig.test.json
│   │   ├── tsconfig.eslint.json
│   │   ├── vitest.config.ts
│   │   ├── README.md
│   │   └── LICENSE
│   │
│   ├── nestjs-prometheus/            # Same structure
│   ├── nestjs-open-telemetry/        # Same structure
│   ├── nestjs-auth/                  # Same structure
│   ├── nestjs-graphql/               # Same structure
│   ├── nestjs-pyroscope/             # Same structure
│   └── nestjs-qdrant/                # Same structure
│
└── docs/
    ├── plans/
    │   ├── nx-monorepo-migration-plan.md    # Detailed design
    │   └── task-breakdown.md                 # Execution tasks
    └── architecture/
        └── monorepo-structure.md             # (Post-migration)
```

---

## Configuration Examples

### Workspace Root `package.json`

```json
{
  "name": "@pawells/nestjs-common-workspace",
  "version": "0.0.1",
  "private": true,
  "packageManager": "yarn@4.12.0",
  "engines": { "node": ">= 24.0.0" },
  "workspaces": ["packages/*"],
  "scripts": {
    "typecheck": "nx run-many --target=typecheck",
    "lint": "nx run-many --target=lint",
    "lint:fix": "nx run-many --target=lint --fix",
    "test": "nx run-many --target=test",
    "build": "nx run-many --target=build",
    "pipeline": "yarn typecheck && yarn lint && yarn test && yarn build"
  },
  "devDependencies": {
    "@nx/eslint": "~21.0.0",
    "@nx/js": "~21.0.0",
    "@nx/vite": "~21.0.0",
    "typescript": "^5.3.3",
    "vitest": "^4.0.0"
  }
}
```

### Per-Package `package.json` (Example: nestjs-prometheus)

```json
{
  "name": "@pawells/nestjs-prometheus",
  "version": "1.0.0",
  "type": "module",
  "main": "./build/index.js",
  "types": "./build/index.d.ts",
  "exports": {
    ".": {
      "types": "./build/index.d.ts",
      "import": "./build/index.js"
    }
  },
  "files": ["build/", "README.md", "LICENSE", ".env.example"],
  "scripts": {
    "build": "tsc --project tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "vitest run"
  },
  "dependencies": {
    "@nestjs/common": "^11.1.13",
    "@pawells/nestjs-shared": "workspace:*",
    "prom-client": "^15.1.3"
  },
  "engines": { "node": ">=24.0.0" }
}
```

Key change: `"@pawells/nestjs-shared": "workspace:*"` (was `"file:../nestjs-shared"`)

### Per-Package `project.json` (Example)

```json
{
  "name": "nestjs-shared",
  "sourceRoot": "packages/nestjs-shared/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{projectRoot}/build"],
      "options": {
        "outputPath": "{projectRoot}/build",
        "tsConfig": "{projectRoot}/tsconfig.build.json"
      }
    },
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "command": "vitest run",
        "cwd": "{projectRoot}"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "options": {
        "lintFilePatterns": ["{projectRoot}/src/**/*.ts"]
      }
    },
    "typecheck": {
      "executor": "nx:run-commands",
      "options": {
        "command": "tsc --noEmit",
        "cwd": "{projectRoot}"
      }
    }
  }
}
```

### Per-Package `tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./build",
    "rootDir": "./src"
  },
  "include": ["src/"],
  "exclude": ["node_modules", "build"]
}
```

### Workspace `nx.json`

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "defaultBase": "main",
  "workspaceLayout": {
    "appsDir": "packages",
    "libsDir": "packages"
  },
  "plugins": [
    {
      "plugin": "@nx/eslint/plugin",
      "options": { "targetName": "lint" }
    }
  ],
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"]
    },
    "test": { "cache": true },
    "lint": { "cache": true },
    "typecheck": { "cache": true }
  }
}
```

---

## Build & Test Workflows

### From Workspace Root

```bash
# Install dependencies (creates single yarn.lock)
yarn install

# Type check all packages
yarn typecheck

# Lint all packages
yarn lint

# Run tests for all packages
yarn test

# Build all packages (respects dependency order)
yarn build

# Full pipeline (CI equivalent)
yarn pipeline
```

### From Package Directory (Optional)

```bash
# Inside packages/nestjs-shared/
yarn build           # Compiles to ./build/
yarn test            # Runs Vitest
yarn lint            # Runs ESLint
yarn typecheck       # Type checks without emitting
```

### Using NX Commands

```bash
# Build specific package
nx run nestjs-shared:build

# Test specific package
nx run nestjs-prometheus:test

# Run target on all packages
nx run-many --target=build

# Show dependency graph
nx dep-graph
```

---

## Publishing Workflow

### Per-Package Publishing

```bash
# 1. Bump version in package.json
# 2. Build locally
cd packages/nestjs-shared
yarn build

# 3. Publish to npm
npm publish
```

The `workspace:*` protocol is automatically converted to the version number during publish.

### CI/CD Publishing (GitHub Actions)

Unified workflow runs on:
- **Push to main**: Full pipeline (typecheck → lint → test → build)
- **Version tags** (e.g., `v1.2.3-nestjs-shared`): Publish specific package to npm

---

## Key Implementation Notes

### TypeScript Path Mappings

`tsconfig.base.json` includes path mappings for workspace dependencies:

```json
{
  "paths": {
    "@pawells/nestjs-shared": ["packages/nestjs-shared/src/index.ts"],
    "@pawells/nestjs-shared/*": ["packages/nestjs-shared/src/*"],
    "@pawells/nestjs-prometheus": ["packages/nestjs-prometheus/src/index.ts"]
  }
}
```

This enables clean imports:
```typescript
// Before (standalone)
import { Logger } from '../../../nestjs-shared/src/logging';

// After (monorepo)
import { Logger } from '@pawells/nestjs-shared/logging';
```

### Yarn Workspace Semantics

- Root `package.json` declares `"workspaces": ["packages/*"]`
- Yarn creates single `node_modules/` at workspace root
- All packages share dependencies (deduplicated)
- `workspace:*` protocol links local packages during dev
- Published versions use semantic versioning (not workspace protocol)

### NX Caching

- Each target is cached per package
- `dependsOn: ["^build"]` ensures dependencies build first
- Incremental builds skip unchanged packages
- `.nx/` directory is gitignored

---

## Migration Order

Follow this sequence to respect package dependencies:

1. **Phase 1**: Setup workspace + migrate `nestjs-shared`
2. **Phase 2**: Migrate `nestjs-prometheus` and `nestjs-open-telemetry` (depend on nestjs-shared)
3. **Phase 3**: Migrate independent packages (nestjs-auth, nestjs-graphql, nestjs-pyroscope, nestjs-qdrant)
4. **Phase 4**: Documentation, CI/CD updates, cleanup old directories

---

## What Changes

| Aspect | Before | After |
|--------|--------|-------|
| Location | `/projects/nestjs-{name}/` | `/projects/nestjs-common/packages/{name}/` |
| project.json | None | Required |
| Dependencies | `file:../` protocol | `workspace:*` protocol |
| Root package.json | None | Shared workspace config |
| yarn.lock | Per-package | Single workspace-level |
| Build commands | `yarn build` from package | `nx run nestjs-shared:build` or `yarn build` from workspace |
| Publishing | Direct from package | Build then publish from package (build output in local `build/`) |

---

## What Stays the Same

| Aspect | Details |
|--------|---------|
| **ESM-only** | All packages remain `"type": "module"` |
| **Vitest** | Testing stays on Vitest, no migration to Jest |
| **TypeScript** | Strict mode, ES2022 target, bundler moduleResolution |
| **Build output** | Each package builds to its own `build/` directory |
| **npm exports** | Subpath exports (./logging, ./security, etc.) unchanged |
| **npm publishing** | Still individual package publishing |
| **Tests** | Test structure and coverage thresholds unchanged |
| **source code** | No refactoring of source code |

---

## Special Cases

### nestjs-open-telemetry

This package depends on `open-telemetry-client`, which is NOT part of the monorepo migration.

```json
{
  "dependencies": {
    "@pawells/nestjs-shared": "workspace:*",
    "@pawells/open-telemetry-client": "file:../../open-telemetry-client"
  }
}
```

The `open-telemetry-client` package stays in `/projects/open-telemetry-client/` and is referenced via `file:` protocol (standard cross-project reference).

### nestjs-shared Subpath Exports

`nestjs-shared` has complex subpath exports that must be preserved:

```json
{
  "exports": {
    ".": { "import": "./build/index.js", "types": "./build/index.d.ts" },
    "./logging": { "import": "./build/logging/index.js", "types": "./build/logging/index.d.ts" },
    "./security": { "import": "./build/security/index.js", "types": "./build/security/index.d.ts" },
    "./validation": { "import": "./build/validation/index.js", "types": "./build/validation/index.d.ts" },
    "./metrics": { "import": "./build/metrics/index.js", "types": "./build/metrics/index.d.ts" },
    "./errors": { "import": "./build/errors/index.js", "types": "./build/errors/index.d.ts" }
  }
}
```

These continue to work unchanged in the monorepo. Consumers can still use:
```typescript
import { Logger } from '@pawells/nestjs-shared/logging';
```

---

## Documentation References

- **Detailed Design**: See `docs/plans/nx-monorepo-migration-plan.md`
- **Task Breakdown**: See `docs/plans/task-breakdown.md`
- **Architecture** (post-migration): See `docs/architecture/monorepo-structure.md`

---

## Next Steps

1. Review the migration plan: `docs/plans/nx-monorepo-migration-plan.md`
2. Follow the task breakdown: `docs/plans/task-breakdown.md`
3. Execute phases in order (Phase 1 → Phase 2 → Phase 3 → Phase 4)
4. Update documentation upon completion

For questions or issues, refer to the troubleshooting section in the migration plan.
