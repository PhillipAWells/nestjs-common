# NestJS Common Monorepo: Architecture & Design

This document provides the complete architecture design for the NX monorepo migration.

## Quick Navigation

**Executive Summary**: Read `MIGRATION_PLAN_SUMMARY.md` first (5 min read)
- Overview of migration goals, architecture approach, phases
- Key technical decisions and why they matter
- Success criteria and timeline

**Migration Guide**: Read `MIGRATION_GUIDE.md` (10 min read)
- Quick reference for developers
- Configuration examples
- Publishing workflow
- Before/after comparisons

**Detailed Design**: Read `docs/plans/nx-monorepo-migration-plan.md` (30 min read)
- Complete architecture specification
- TypeScript configuration strategy
- Workspace dependencies and publishing
- Risk mitigation

**Task Breakdown**: Read `docs/plans/task-breakdown.md` (10 min read)
- 12 executable tasks with acceptance criteria
- Phase dependencies and parallelization
- Estimated effort per phase

---

## Architecture at a Glance

### Problem
7 standalone NestJS packages need:
- Unified build/test/lint tooling
- Shared dependency management
- Faster development cycles
- Simplified CI/CD

...while preserving:
- ESM-only module format
- Vitest testing framework
- Individual npm publishability
- Clear package boundaries

### Solution: Hybrid Monorepo

**Combine**:
- NX workspace (unified tooling, caching, task orchestration)
- Per-package configs (npm publishing, clear boundaries)
- Yarn workspace semantics (dependency deduplication)
- TypeScript path mappings (clean imports)

**Result**: Monorepo benefits + npm publishing capability

---

## Package Structure

```
nestjs-common/
├── package.json              # Workspace root (private, dev deps only)
├── nx.json                   # NX configuration
├── tsconfig.base.json        # Base TS config + path mappings
├── eslint.config.mjs         # Shared ESLint config
├── .yarnrc.yml               # Yarn workspace config
│
├── packages/
│   ├── nestjs-shared/
│   │   ├── src/              # TypeScript source
│   │   ├── build/            # Compiled output (gitignored)
│   │   ├── package.json      # npm config
│   │   ├── project.json      # NX config
│   │   ├── tsconfig.json, tsconfig.build.json, tsconfig.test.json
│   │   └── vitest.config.ts
│   │
│   ├── nestjs-prometheus/    # Same structure as above
│   ├── nestjs-open-telemetry/
│   ├── nestjs-auth/
│   ├── nestjs-graphql/
│   ├── nestjs-pyroscope/
│   └── nestjs-qdrant/
│
└── docs/
    ├── plans/
    │   ├── nx-monorepo-migration-plan.md
    │   └── task-breakdown.md
    └── architecture/
        └── monorepo-structure.md (post-migration)
```

---

## Build Flow

### Development Workflow

```
yarn install                   # Single yarn.lock for all packages
 ↓
yarn typecheck                 # tsc --noEmit (all packages)
 ↓
yarn lint                      # eslint (all packages)
 ↓
yarn test                      # vitest (all packages)
 ↓
yarn build                     # tsc (respects dependency order via NX)
```

### Publishing Workflow

```
Per-Package:
  1. Bump version in package.json
  2. yarn build
  3. npm publish
```

Yarn workspace protocol `workspace:*` automatically converts to semantic version during publish.

---

## Key Technologies

| Component | Choice | Why |
|-----------|--------|-----|
| **Monorepo Tool** | NX v21 | Caching, task orchestration, plugins |
| **Package Manager** | Yarn Berry 4.12 | Workspaces, deduplication, node-modules linker |
| **Language** | TypeScript 5.3 | Type safety, ES2022 target |
| **Testing** | Vitest | ESM native, fast, familiar from existing setup |
| **Linting** | ESLint (flat config) | Workspace-level configuration |
| **Module Format** | ESM | `"type": "module"`, no CJS |
| **Build Tool** | tsc (direct) | No build tool, just TypeScript compilation |

---

## Dependency Management

### Workspace Protocol

Packages with internal dependencies use `workspace:*`:

```json
{
  "dependencies": {
    "@pawells/nestjs-shared": "workspace:*"
  }
}
```

**Effect**:
- During development: Links to local package
- During publish: Converts to `^1.1.6` (semantic version)
- Consumers get: Standard npm versions (no workspace protocol)

### Path Mappings

`tsconfig.base.json` enables clean imports:

```json
{
  "paths": {
    "@pawells/nestjs-shared": ["packages/nestjs-shared/src/index.ts"],
    "@pawells/nestjs-shared/*": ["packages/nestjs-shared/src/*"]
  }
}
```

Result: `import { Logger } from '@pawells/nestjs-shared/logging'` (no relative paths)

---

## Configuration Strategy

### Root-Level Configs

**package.json**
- `"workspaces": ["packages/*"]` — Yarn workspace declaration
- Dev dependencies only (eslint, typescript, nx, vitest, etc.)
- Scripts for workspace commands (build, test, lint, typecheck, pipeline)

**nx.json**
- `@nx/eslint` plugin for automatic lint target detection
- `targetDefaults` with caching enabled
- `dependsOn: ["^build"]` ensures dependencies build first

**tsconfig.base.json**
- Base compiler options (ES2022 target, bundler moduleResolution, strict mode)
- Path mappings for all 7 packages

**eslint.config.mjs**
- Flat config, shared across all packages
- Per-package can override if needed

### Per-Package Configs

Each package maintains:
- **package.json** — npm config, exports, dependencies
- **project.json** — NX targets (build, test, lint, typecheck)
- **tsconfig.json** — Extends `../../tsconfig.base.json`
- **tsconfig.build.json** — Excludes test files
- **tsconfig.test.json** — For Vitest
- **tsconfig.eslint.json** — For linting
- **vitest.config.ts** — Test configuration

---

## Migration Phases

### Phase 1: Setup + nestjs-shared (3 tasks)
1. Scaffold workspace structure and root configs
2. Migrate nestjs-shared to `packages/nestjs-shared/`
3. Verify full pipeline for nestjs-shared

**Duration**: 3-4 hours
**Owner**: Developer + DevOps
**Outcome**: Foundation established, nestjs-shared working in monorepo

### Phase 2: Dependent Packages (4 tasks)
4. Migrate nestjs-prometheus
5. Verify nestjs-prometheus
6. Migrate nestjs-open-telemetry
7. Verify nestjs-open-telemetry

**Duration**: 2-3 hours
**Owner**: Developer + DevOps
**Outcome**: Both dependent packages working with path mappings

### Phase 3: Independent Packages (2 tasks)
8. Batch migrate nestjs-auth, nestjs-graphql, nestjs-pyroscope, nestjs-qdrant
9. Full workspace pipeline verification (all 7 packages)

**Duration**: 1-2 hours
**Owner**: Developer + DevOps
**Outcome**: All 7 packages migrated and passing full pipeline

### Phase 4: Documentation & Cleanup (3 tasks)
10. Create architecture documentation
11. Update CI/CD workflows
12. Remove old standalone directories

**Duration**: 2-3 hours
**Owner**: Writer + DevOps
**Outcome**: Documentation complete, old directories cleaned up

---

## What Changes vs What Stays the Same

### Changes
- **Location**: `/projects/{name}/` → `/projects/nestjs-common/packages/{name}/`
- **Dependencies**: `file:` protocol → `workspace:*` protocol (except external deps)
- **Build commands**: Per-package → Unified `yarn build` from workspace root
- **package.json**: Single root workspace config + per-package configs
- **yarn.lock**: Per-package → Single workspace-level
- **Project structure**: Added `project.json` per package

### Same
- **ESM-only**: `"type": "module"` unchanged
- **Testing**: Vitest configuration and structure unchanged
- **TypeScript**: ES2022, bundler, strict mode unchanged
- **Source code**: No refactoring needed
- **npm publishing**: Still independent per-package
- **Exports**: Subpath exports (./logging, ./security) unchanged
- **Coverage**: Test thresholds (80% or 70%) unchanged

---

## Special Cases

### nestjs-shared Subpath Exports

Defines complex exports that must be preserved:
```json
{
  "exports": {
    ".": { "import": "./build/index.js" },
    "./logging": { "import": "./build/logging/index.js" },
    "./security": { "import": "./build/security/index.js" },
    "./validation": { "import": "./build/validation/index.js" },
    "./metrics": { "import": "./build/metrics/index.js" },
    "./errors": { "import": "./build/errors/index.js" }
  }
}
```

Build must generate `.d.ts` files for each subpath.

### nestjs-open-telemetry External Dependency

Depends on `open-telemetry-client` (NOT part of migration):
```json
{
  "dependencies": {
    "@pawells/nestjs-shared": "workspace:*",
    "@pawells/open-telemetry-client": "file:../../open-telemetry-client"
  }
}
```

Remains as `file:` protocol since it stays in `/projects/`.

---

## Success Criteria

Migration is complete when:

1. ✅ All 7 packages in `/projects/nestjs-common/packages/`
2. ✅ Single workspace root with all dev dependencies
3. ✅ Single `yarn.lock` at workspace root
4. ✅ `yarn pipeline` passes for all 7 packages
5. ✅ Each package still publishes independently to npm
6. ✅ No `file:` protocol in package.json (except external deps)
7. ✅ All tests pass with coverage >= 80% (or 70% for specific packages)
8. ✅ No lint errors, all types valid
9. ✅ Old standalone directories removed
10. ✅ Documentation complete

---

## Next Steps

1. **Review** summary: `MIGRATION_PLAN_SUMMARY.md` (5 min)
2. **Read** detailed design: `docs/plans/nx-monorepo-migration-plan.md` (30 min)
3. **Review** task breakdown: `docs/plans/task-breakdown.md` (10 min)
4. **Delegate** Task 1.1 to developer
5. **Track** progress via TaskUpdate
6. **Execute** phases in order

---

## Questions?

- **"How do I build/test/lint?"** → See MIGRATION_GUIDE.md
- **"What about publishing?"** → See MIGRATION_GUIDE.md (Publishing Workflow section)
- **"Which packages depend on which?"** → See MIGRATION_PLAN_SUMMARY.md (Packages table)
- **"What are the technical details?"** → See nx-monorepo-migration-plan.md (Architecture Design section)
- **"What's involved in Task X?"** → See task-breakdown.md

---

**Last Updated**: 2026-03-09
**Status**: Design Complete, Ready for Execution
**Scope**: 7 packages, 12 tasks, 8-12 hours estimated
