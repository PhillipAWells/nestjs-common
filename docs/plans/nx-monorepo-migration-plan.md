# NestJS Common Packages: NX Monorepo Migration Plan

## Overview

Consolidate 7 standalone NestJS packages into a single NX monorepo at `/workspaces/pawells/projects/nestjs-common/`. This migration preserves ESM-only module format, Vitest testing infrastructure, and individual npm publishability while centralizing build, test, lint, and dependency management.

**Goal**: Enable faster development cycles, shared tooling, unified dependency management, and simplified CI/CD while maintaining backward compatibility for npm consumers.

**Migration Scope**:
- `nestjs-shared` (base layer — migrate first)
- `nestjs-prometheus` (depends on nestjs-shared)
- `nestjs-open-telemetry` (depends on nestjs-shared and open-telemetry-client)
- `nestjs-auth` (no internal deps)
- `nestjs-graphql` (no internal deps)
- `nestjs-pyroscope` (no internal deps)
- `nestjs-qdrant` (no internal deps)

---

## Architecture Design

### Package Layout

```
projects/nestjs-common/
├── nx.json                          # NX configuration
├── package.json                     # Root workspace package (private)
├── tsconfig.base.json               # Base TypeScript configuration
├── tsconfig.eslint.json             # ESLint TypeScript config
├── eslint.config.mjs                # Shared ESLint config (flat)
├── .yarnrc.yml                      # Yarn Berry configuration
├── .gitignore                       # Workspace gitignore
│
├── packages/
│   ├── nestjs-shared/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── logging/
│   │   │   ├── security/
│   │   │   ├── validation/
│   │   │   ├── metrics/
│   │   │   └── errors/
│   │   ├── build/                   # Compiled output (gitignored)
│   │   ├── package.json             # Individual npm package config
│   │   ├── project.json             # NX project config
│   │   ├── tsconfig.json            # Dev/editor config
│   │   ├── tsconfig.build.json      # Production build config
│   │   ├── tsconfig.test.json       # Vitest config
│   │   ├── tsconfig.eslint.json     # ESLint config
│   │   ├── vitest.config.ts         # Vitest configuration
│   │   ├── README.md
│   │   ├── LICENSE
│   │   └── .env.example
│   │
│   ├── nestjs-prometheus/
│   │   ├── src/
│   │   ├── build/
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── tsconfig.*.json
│   │   ├── vitest.config.ts
│   │   └── ...
│   │
│   ├── nestjs-open-telemetry/
│   │   └── ... (same structure)
│   │
│   ├── nestjs-auth/
│   │   └── ... (same structure)
│   │
│   ├── nestjs-graphql/
│   │   └── ... (same structure)
│   │
│   ├── nestjs-pyroscope/
│   │   └── ... (same structure)
│   │
│   └── nestjs-qdrant/
│       └── ... (same structure)
│
└── docs/
    ├── plans/
    └── architecture/
```

### Key Design Decisions

1. **Each package maintains its own config** (`package.json`, `tsconfig.*.json`, `vitest.config.ts`)
   - Preserves clear package boundaries
   - Enables independent npm publishing
   - Supports per-package build/test/lint targets
   - Allows individual package versioning

2. **Workspace-level shared config**
   - `tsconfig.base.json` — Extended by all packages for consistency
   - `eslint.config.mjs` — Shared linting rules (per-package can override)
   - `nx.json` — Central NX configuration with plugins and target defaults
   - Root `package.json` — Dev dependencies only (eslint, typescript, nx, etc.)

3. **Yarn workspace semantics**
   - Single `node_modules/` at workspace root
   - `.yarnrc.yml` uses `nodeLinker: node-modules`
   - Workspaces declared in root `package.json`
   - Explicit dependency resolution (no wildcards)

4. **Build output location**
   - Each package builds to its own `packages/{name}/build/`
   - Output is gitignored workspace-wide
   - Publish uses `"files"` field in package.json to include only `build/`, `README.md`, `LICENSE`, `.env.example`

---

## Technical Specifications

### 1. Root `package.json` (workspace)

```json
{
  "name": "@pawells/nestjs-common-workspace",
  "version": "0.0.1",
  "private": true,
  "description": "NX monorepo for NestJS-specific packages",
  "author": "Aaron Wells <...>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/PhillipAWells/nestjs-common.git"
  },
  "packageManager": "yarn@4.12.0",
  "engines": {
    "node": ">= 24.0.0"
  },
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "typecheck": "nx run-many --target=typecheck",
    "lint": "nx run-many --target=lint",
    "lint:fix": "nx run-many --target=lint --fix",
    "test": "nx run-many --target=test",
    "build": "nx run-many --target=build",
    "pipeline": "yarn typecheck && yarn lint && yarn test && yarn build",
    "prepare": "husky"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.0",
    "@nx/eslint": "~21.0.0",
    "@nx/js": "~21.0.0",
    "@nx/nest": "~21.0.0",
    "@nx/node": "~21.0.0",
    "@nx/vite": "~21.0.0",
    "@stylistic/eslint-plugin": "^5.0.0",
    "@types/node": "^25.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@vitest/coverage-v8": "^4.0.0",
    "@vitest/ui": "^4.0.0",
    "eslint": "^10.0.0",
    "eslint-import-resolver-typescript": "^4.0.0",
    "eslint-plugin-import": "^2.31.0",
    "eslint-plugin-unused-imports": "^4.0.0",
    "globals": "^17.0.0",
    "husky": "^9.1.7",
    "nx": "~21.0.0",
    "typescript": "^5.3.3",
    "vitest": "^4.0.0"
  }
}
```

**Key points**:
- `"private": true` — Never publish workspace root
- `"workspaces": ["packages/*"]` — Yarn recognizes all packages
- All dev tooling at root level
- Runtime dependencies (nestjs, rxjs, etc.) in individual packages

### 2. Per-Package `package.json`

Example: `packages/nestjs-shared/package.json`

```json
{
  "name": "@pawells/nestjs-shared",
  "displayName": "NestJS Shared",
  "version": "1.1.6",
  "description": "Shared NestJS infrastructure library",
  "type": "module",
  "main": "./build/index.js",
  "types": "./build/index.d.ts",
  "exports": {
    ".": {
      "types": "./build/index.d.ts",
      "import": "./build/index.js"
    },
    "./logging": {
      "types": "./build/logging/index.d.ts",
      "import": "./build/logging/index.js"
    },
    "./security": {
      "types": "./build/security/index.d.ts",
      "import": "./build/security/index.js"
    },
    "./validation": {
      "types": "./build/validation/index.d.ts",
      "import": "./build/validation/index.js"
    },
    "./metrics": {
      "types": "./build/metrics/index.d.ts",
      "import": "./build/metrics/index.js"
    },
    "./errors": {
      "types": "./build/errors/index.d.ts",
      "import": "./build/errors/index.js"
    }
  },
  "files": [
    "build/",
    "README.md",
    "LICENSE",
    ".env.example"
  ],
  "scripts": {
    "build": "tsc --project tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "test": "vitest run",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "watch": "tsc --watch",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@nestjs/common": "^11.1.13",
    "@nestjs/core": "^11.1.13",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2"
  },
  "peerDependencies": {
    "@nestjs/common": ">=10.0.0",
    "@nestjs/core": ">=10.0.0",
    "reflect-metadata": ">=0.1.13",
    "rxjs": ">=7.0.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "engines": {
    "node": ">=24.0.0"
  },
  "packageManager": "yarn@4.12.0"
}
```

**Key points**:
- `"main"` / `"exports"` — Points to compiled `build/` directory
- `"files"` — Controls what npm includes (excludes src/, tests, node_modules)
- `"dependencies"` — Runtime deps. Packages with internal deps use workspace protocol:
  ```json
  "@pawells/nestjs-shared": "workspace:*"
  ```
- `"prepublishOnly"` — Ensures build before publish
- `"scripts"` — Identical across packages (npm scripts, not NX)

### 3. Per-Package `project.json` (NX Configuration)

Example: `packages/nestjs-shared/project.json`

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
        "tsConfig": "{projectRoot}/tsconfig.build.json",
        "packageJson": "{projectRoot}/package.json"
      },
      "configurations": {
        "production": {
          "tsConfig": "{projectRoot}/tsconfig.build.json"
        }
      }
    },
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "command": "vitest run",
        "cwd": "{projectRoot}"
      }
    },
    "test:watch": {
      "executor": "nx:run-commands",
      "options": {
        "command": "vitest",
        "cwd": "{projectRoot}"
      }
    },
    "test:coverage": {
      "executor": "nx:run-commands",
      "options": {
        "command": "vitest run --coverage",
        "cwd": "{projectRoot}"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
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
  },
  "tags": ["scope:nestjs-shared", "type:library"]
}
```

**Key decisions**:
- `"executor": "@nx/js:tsc"` — Use NX's TypeScript executor for build (faster incremental builds)
- `"executor": "nx:run-commands"` — Wrap Vitest (NX doesn't have native Vitest executor in v21)
- All targets reference workspace task caching via `nx.json` settings
- TypeScript is invoked via `tsc` directly (not via build tool)

### 4. TypeScript Configuration Strategy

**`tsconfig.base.json`** (workspace root):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "lib": ["ES2022"],
    "paths": {
      "@pawells/nestjs-shared": ["packages/nestjs-shared/src/index.ts"],
      "@pawells/nestjs-shared/*": ["packages/nestjs-shared/src/*"],
      "@pawells/nestjs-prometheus": ["packages/nestjs-prometheus/src/index.ts"],
      "@pawells/nestjs-open-telemetry": ["packages/nestjs-open-telemetry/src/index.ts"],
      "@pawells/open-telemetry-client": ["packages/open-telemetry-client/src/index.ts"]
    }
  }
}
```

**Per-package `tsconfig.json`**:
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

**Per-package `tsconfig.build.json`** (excludes tests):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "build", "src/**/*.spec.ts", "src/**/*.test.ts"]
}
```

**Per-package `tsconfig.test.json`** (for Vitest):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts"]
}
```

**Per-package `tsconfig.eslint.json`** (for linting):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  }
}
```

### 5. Workspace `nx.json` Configuration

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
      "options": {
        "targetName": "lint"
      }
    }
  ],
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"]
    },
    "test": {
      "cache": true
    },
    "lint": {
      "cache": true
    },
    "typecheck": {
      "cache": true
    }
  },
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.test.ts",
      "!{projectRoot}/coverage/**/*"
    ],
    "sharedGlobals": [
      "{workspaceRoot}/tsconfig.base.json",
      "{workspaceRoot}/eslint.config.mjs"
    ]
  }
}
```

### 6. Vitest Configuration (Per-Package)

**`packages/{name}/vitest.config.ts`**:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'build'],
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'build/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
        '**/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
```

### 7. ESLint Configuration

**Workspace root `eslint.config.mjs`**: Uses flat config, extends across all packages

**Minimal per-package override** (if needed): Create `packages/{name}/eslint.config.mjs` that extends workspace config

### 8. Workspace Dependencies (yarn workspaces + NX)

**Packages with inter-dependencies use workspace protocol**:

Example: `packages/nestjs-prometheus/package.json`
```json
{
  "dependencies": {
    "@nestjs/common": "^11.1.13",
    "@nestjs/core": "^11.1.13",
    "@pawells/nestjs-shared": "workspace:*",
    "prom-client": "^15.1.3",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2"
  }
}
```

When published to npm, `workspace:*` resolves to `^1.1.6` (version from nestjs-shared package.json).

---

## Publishing Workflow

### Per-Package Publishing

Each package maintains individual npm credentials and publishes independently:

1. **Bump version** in `packages/{name}/package.json`
2. **Build** locally or via CI:
   ```bash
   cd packages/{name}
   yarn build
   ```
3. **Publish** to npm:
   ```bash
   cd packages/{name}
   npm publish
   ```
   - NX build output in `build/` directory
   - `"files"` field limits npm package contents
   - `"prepublishOnly"` ensures build before publish

### CI/CD Publishing (GitHub Actions)

Single workflow triggered on version tags (`v*`):

```bash
# On tag push (e.g., v1.2.3):
1. Detect which package was versioned
2. Checkout that package version from git tag
3. Run: yarn build && npm publish
4. Create GitHub Release
```

Or monorepo-aware approach (Changesets, Nx Release):
- Track which packages changed
- Auto-bump versions
- Coordinate multi-package releases

**Recommendation**: Use `nx release` (NX 19+) or simple per-package GitHub Actions workflow.

---

## Migration Order (Dependency-Aware)

Migrate in this order to respect dependencies:

1. **Phase 1**: `nestjs-shared` (no internal deps)
2. **Phase 2**: `nestjs-prometheus`, `nestjs-open-telemetry` (depend on nestjs-shared)
3. **Phase 3**: `nestjs-auth`, `nestjs-graphql`, `nestjs-pyroscope`, `nestjs-qdrant` (no internal deps)

**Critical**: Complete Phase 1 & 2 before Phase 3 to ensure internal path mappings work.

---

## What Changes vs What Stays the Same

### Per-Package (What Changes)

| Aspect | Before | After |
|--------|--------|-------|
| **Location** | `/projects/{name}/` | `/projects/nestjs-common/packages/{name}/` |
| **project.json** | None | Added (NX project config) |
| **Build** | `yarn build` (from package dir) | `nx run nestjs-shared:build` (from workspace) or `yarn build` (from package dir) |
| **Lint** | `yarn lint` (from package dir) | `nx run nestjs-shared:lint` (from workspace) or `yarn lint` (from package dir) |
| **Test** | `yarn test` (from package dir) | `nx run nestjs-shared:test` (from workspace) or `yarn test` (from package dir) |
| **Dependencies** | `"@pawells/nestjs-shared": "file:../nestjs-shared"` | `"@pawells/nestjs-shared": "workspace:*"` |
| **Root package.json** | Per-package only | Workspace root + per-package |
| **yarn.lock** | Individual per package | Single workspace-level lock |

### Per-Package (What Stays the Same)

| Aspect | Details |
|--------|---------|
| **package.json** | Still exists, still defines npm exports, scripts, dependencies |
| **src/** | Unchanged |
| **build/** | Still compiled to local `build/` directory, still gitignored |
| **tsconfig.json** | Still exists, now extends `tsconfig.base.json` |
| **vitest.config.ts** | Unchanged |
| **ESM-only** | Remains `"type": "module"` |
| **npm publishing** | Still individual package publishing via `npm publish` |
| **Subpath exports** | `"./logging"`, `"./security"`, etc. still work (defined in package.json exports) |

### Workspace-Level (New)

| Component | Details |
|-----------|---------|
| **nx.json** | New workspace configuration |
| **Root package.json** | New with workspaces, dev dependencies, shared scripts |
| **tsconfig.base.json** | New base TypeScript config with path mappings |
| **Single yarn.lock** | Consolidated from 7 individual locks |
| **Shared ESLint config** | Workspace-level `eslint.config.mjs` |
| **CI/CD simplification** | Single `pipeline` script instead of per-package |

---

## Task Breakdown

### Phase 1: Setup & nestjs-shared Migration

#### Task 1.1: Scaffold NX Workspace Structure
- Role: developer
- Prepare workspace directories and gitignore updates
- Create initial root `package.json` with workspaces and scripts
- Migrate `tsconfig.base.json` and path mappings
- Acceptance: Workspace root structure ready, can run `yarn install` cleanly

#### Task 1.2: Migrate nestjs-shared to Workspace
- Role: developer
- Move `/projects/nestjs-shared` to `/projects/nestjs-common/packages/nestjs-shared`
- Update per-package `package.json` (convert file: deps to workspace:*)
- Create `project.json` for NX
- Update all `tsconfig.*.json` to extend `tsconfig.base.json`
- Verify: `yarn install`, `yarn build`, `yarn test`, `yarn lint` from workspace root

#### Task 1.3: Verify nestjs-shared Builds & Tests Pass
- Role: devops
- Run full pipeline on nestjs-shared
- Verify no import/export breakage
- Acceptance: All tests pass, no lint errors, build succeeds

### Phase 2: Migrate Dependent Packages

#### Task 2.1: Migrate nestjs-prometheus to Workspace
- Role: developer
- Move package to `/projects/nestjs-common/packages/nestjs-prometheus`
- Update `package.json` to use `workspace:*` for nestjs-shared
- Create `project.json`
- Update tsconfig files
- Acceptance: Migration complete, ready for testing

#### Task 2.2: Verify nestjs-prometheus
- Role: devops
- Full pipeline: build, test, lint, typecheck
- Verify internal imports from nestjs-shared work
- Acceptance: All checks pass

#### Task 2.3: Migrate nestjs-open-telemetry to Workspace
- Role: developer
- Move package to `/projects/nestjs-common/packages/nestjs-open-telemetry`
- Update `package.json` (workspace:* for nestjs-shared and open-telemetry-client)
- Create `project.json`
- Update tsconfig files
- Acceptance: Ready for testing

#### Task 2.4: Verify nestjs-open-telemetry
- Role: devops
- Full pipeline on nestjs-open-telemetry
- Verify dependencies resolve correctly
- Acceptance: All checks pass

### Phase 3: Migrate Remaining Packages

#### Task 3.1: Batch Migrate Independent Packages
- Role: developer
- Migrate: nestjs-auth, nestjs-graphql, nestjs-pyroscope, nestjs-qdrant
- For each:
  - Move to `/projects/nestjs-common/packages/{name}`
  - Update `package.json`, create `project.json`
  - Update tsconfig files
- Acceptance: All 4 packages moved and configured

#### Task 3.2: Verify All Packages
- Role: devops
- Run full pipeline: `yarn typecheck && yarn lint && yarn test && yarn build`
- Verify no inter-package import errors
- Acceptance: All 7 packages pass full pipeline

### Phase 4: Documentation & Cleanup

#### Task 4.1: Document Migration in Architecture Guide
- Role: writer
- Create `docs/architecture/monorepo-structure.md`
- Document new build, test, lint workflows
- Include package dependency diagram
- Acceptance: Comprehensive guide available

#### Task 4.2: Update CI/CD Workflows
- Role: devops
- Update GitHub Actions to use `nx run-many` for matrix runs
- Simplify test/lint/build workflows
- Acceptance: CI passes, workflows streamlined

#### Task 4.3: Cleanup Old Standalone Package Directories
- Role: devops
- Remove original `/projects/nestjs-auth`, `/projects/nestjs-graphql`, etc.
- Verify git history preserved
- Update monorepo references
- Acceptance: Old directories removed, git clean

---

## Summary

- **Total Tasks**: 12 (+ testing/documentation)
- **Phases**: 4 (Setup, Phase 2 Deps, Phase 3 Independent, Documentation)
- **Critical Path**: Task 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3 → 2.4 → 3.1 → 3.2
- **Parallel Opportunities**: Tasks 2.1 & 2.3 can run in parallel; all Phase 3 migrations can batch; Task 4.1-4.3 can run in parallel with final testing

---

## Implementation Notes

### NX Caching Strategy

- Each target (build, test, lint, typecheck) is cached per package
- `dependsOn: ["^build"]` ensures dependencies build first
- Incremental builds use NX's sophisticated cache invalidation

### Yarn Workspaces Interaction

- Root `package.json` defines `"workspaces": ["packages/*"]`
- Yarn creates single `node_modules` at root
- Each package resolves its dependencies from workspace
- `workspace:*` protocol ensures local packages are linked, not published versions

### Inter-Package Imports

**Before** (standalone):
```typescript
// In nestjs-prometheus/src/index.ts
import { InstrumentationRegistry } from '../../../nestjs-shared/src/metrics';
```

**After** (workspace):
```typescript
// In nestjs-prometheus/src/index.ts
import { InstrumentationRegistry } from '@pawells/nestjs-shared/metrics';
// Uses tsconfig.base.json path mapping
```

### Publishing Strategy

1. **Local development**: Use `workspace:*` protocol
2. **Publishing to npm**:
   - Bump version in package.json
   - Run `yarn build`
   - Run `npm publish` from package directory
   - `workspace:*` is automatically converted to version number during publish
3. **Consumers get**: Standard `@pawells/nestjs-shared@1.1.6` (not workspace reference)

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking changes during migration | Test each phase in isolation, use feature branches |
| Dependency resolution issues | Validate with `yarn install --check-cache` before commit |
| npm publishing breakage | Test publish flow locally first with `npm pack` |
| CI/CD workflow failures | Run locally before pushing changes |
| Path mapping conflicts | Test imports before and after migration |
| Missing exports | Validate all subpath exports still work (nestjs-shared ./logging, etc.) |

---

## Success Criteria

- [ ] All 7 packages migrated to `/projects/nestjs-common/packages/`
- [ ] Single workspace root with unified tooling
- [ ] `yarn install` succeeds at workspace root
- [ ] `yarn pipeline` (full CI equivalent) passes
- [ ] Each package still publishes independently to npm
- [ ] Internal path mappings work (no `file:` protocol in package.json)
- [ ] All tests pass with ≥80% coverage
- [ ] No lint errors, all types valid
- [ ] Documentation complete
- [ ] Old standalone directories removed
