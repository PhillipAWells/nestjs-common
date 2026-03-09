# NestJS Common Monorepo Migration

**Status**: Design Complete, Ready for Execution
**Date**: 2026-03-09
**Scope**: Consolidate 7 standalone NestJS packages into NX monorepo

---

## 📋 Documentation Index

### Quick Start (Read These First)

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — 10 min overview
   - Problem/Solution summary
   - Package structure diagram
   - Build/publish workflows
   - Key technologies

2. **[MIGRATION_PLAN_SUMMARY.md](./MIGRATION_PLAN_SUMMARY.md)** — 15 min executive brief
   - Core insight (hybrid architecture)
   - 4 migration phases with effort estimates
   - What changes vs what stays the same
   - Success criteria

### For Developers

3. **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** — Quick reference
   - File structure and examples
   - Build/test/lint workflows
   - Configuration examples (package.json, tsconfig, project.json, nx.json)
   - Publishing workflow
   - Special cases (nestjs-open-telemetry, subpath exports)

### For Architects

4. **[docs/plans/nx-monorepo-migration-plan.md](./docs/plans/nx-monorepo-migration-plan.md)** — 30 min deep dive
   - Complete architecture specification (8 sections)
   - TypeScript configuration strategy
   - Workspace dependencies and publishing
   - NX caching strategy
   - Yarn workspaces interaction
   - Publishing strategy
   - Risk mitigation table

### For Project Managers

5. **[docs/plans/task-breakdown.md](./docs/plans/task-breakdown.md)** — 12 executable tasks
   - Phase 1: Setup + nestjs-shared (3 tasks)
   - Phase 2: Dependent packages (4 tasks)
   - Phase 3: Independent packages (2 tasks)
   - Phase 4: Documentation & cleanup (3 tasks)
   - Each task has role, description, dependencies, complexity, acceptance criteria

---

## 🎯 What's Being Migrated

7 standalone NestJS packages consolidating into `/workspaces/pawells/projects/nestjs-common/packages/`:

| Package | Location | Dependencies | Status |
|---------|----------|--------------|--------|
| **nestjs-shared** | `packages/nestjs-shared/` | None | Base layer, migrate Phase 1 |
| **nestjs-prometheus** | `packages/nestjs-prometheus/` | nestjs-shared | Phase 2 |
| **nestjs-open-telemetry** | `packages/nestjs-open-telemetry/` | nestjs-shared, open-telemetry-client | Phase 2 |
| **nestjs-auth** | `packages/nestjs-auth/` | None | Phase 3 |
| **nestjs-graphql** | `packages/nestjs-graphql/` | None | Phase 3 |
| **nestjs-pyroscope** | `packages/nestjs-pyroscope/` | None | Phase 3 |
| **nestjs-qdrant** | `packages/nestjs-qdrant/` | None | Phase 3 |

---

## 🏗️ Architecture: Hybrid Monorepo

### Core Insight
Combine NX workspace benefits (unified tooling, caching) with per-package npm publishing by:
- Using `workspace:*` protocol for inter-package deps
- Keeping each package independently publishable
- Using TypeScript path mappings for clean imports
- Sharing ESLint/TypeScript configs at workspace root

### Key Components

**Root Workspace Config**
```
package.json         - "workspaces": ["packages/*"], dev deps
nx.json              - @nx/eslint plugin, target defaults, caching
tsconfig.base.json   - Path mappings for 7 packages
eslint.config.mjs    - Shared ESLint config
.yarnrc.yml          - Yarn workspace config
```

**Per-Package Config**
```
package.json         - npm exports, runtime deps, subpath exports
project.json         - NX targets (build, test, lint, typecheck)
src/                 - TypeScript source code
build/               - Compiled output (gitignored)
tsconfig.json        - Extends ../../tsconfig.base.json
tsconfig.build.json  - Production build (excludes tests)
tsconfig.test.json   - Vitest configuration
vitest.config.ts     - Test runner config
```

---

## 📦 Migration Phases

### Phase 1: Setup + nestjs-shared (3 tasks, 3-4 hours)
**Owner**: Developer + DevOps
**Outcome**: Foundation established

1. Scaffold workspace structure and configs
2. Migrate nestjs-shared to `packages/nestjs-shared/`
3. Verify full pipeline (typecheck, lint, test, build)

### Phase 2: Dependent Packages (4 tasks, 2-3 hours)
**Owner**: Developer + DevOps
**Outcome**: Packages with dependencies working

4. Migrate nestjs-prometheus
5. Verify nestjs-prometheus
6. Migrate nestjs-open-telemetry
7. Verify nestjs-open-telemetry

### Phase 3: Independent Packages (2 tasks, 1-2 hours)
**Owner**: Developer + DevOps
**Outcome**: All 7 packages migrated

8. Batch migrate nestjs-auth, nestjs-graphql, nestjs-pyroscope, nestjs-qdrant
9. Full workspace pipeline verification

### Phase 4: Documentation & Cleanup (3 tasks, 2-3 hours)
**Owner**: Writer + DevOps
**Outcome**: Documentation complete, ready for production

10. Create architecture documentation
11. Update CI/CD workflows (GitHub Actions)
12. Remove old standalone directories

**Total Estimate**: 8-12 hours (5-7 days with 2 developers + 1 devops)

---

## ✅ Success Criteria

Migration is complete when all of the following are true:

- [ ] All 7 packages in `/projects/nestjs-common/packages/`
- [ ] Single workspace root with unified dev dependencies
- [ ] Single `yarn.lock` at workspace root (not per-package)
- [ ] `yarn pipeline` (full CI) passes for all 7 packages
- [ ] Each package still publishes independently to npm
- [ ] No `file:` protocol in package.json (except external deps)
- [ ] All tests pass with coverage >= 80% (or 70% for specific packages)
- [ ] No lint errors, all types valid
- [ ] Old standalone directories removed
- [ ] Documentation complete

---

## 🚀 Getting Started

### Step 1: Review Documentation (30 min)
1. Read `ARCHITECTURE.md` (10 min)
2. Read `MIGRATION_PLAN_SUMMARY.md` (15 min)
3. Skim `MIGRATION_GUIDE.md` (5 min)

### Step 2: Delegate Task 1.1
```
Role: Developer
Task: Scaffold NX Workspace and Root Configuration
Acceptance: package.json, tsconfig.base.json, nx.json created and valid
Time: ~1-2 hours
```

### Step 3: Track Progress
- Use `TaskUpdate` tool to mark tasks as in_progress / completed
- Follow phase dependencies (Phase 1 → 2 → 3 → 4)
- Run full pipeline (`yarn pipeline`) after each phase

### Step 4: Validate and Cleanup
After Phase 3, run:
```bash
cd /projects/nestjs-common
yarn install        # Single yarn.lock
yarn pipeline       # Full CI equivalent
```

---

## 📝 Configuration Examples

### Workspace package.json
```json
{
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "nx run-many --target=build",
    "test": "nx run-many --target=test",
    "lint": "nx run-many --target=lint",
    "pipeline": "yarn typecheck && yarn lint && yarn test && yarn build"
  }
}
```

### Per-Package package.json
```json
{
  "name": "@pawells/nestjs-shared",
  "type": "module",
  "main": "./build/index.js",
  "exports": { ".": { "import": "./build/index.js" } },
  "dependencies": {
    "@nestjs/common": "^11.1.13",
    "@nestjs/core": "^11.1.13"
  }
}
```

### Per-Package project.json
```json
{
  "name": "nestjs-shared",
  "sourceRoot": "packages/nestjs-shared/src",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "options": { "tsConfig": "{projectRoot}/tsconfig.build.json" }
    },
    "test": {
      "executor": "nx:run-commands",
      "options": { "command": "vitest run", "cwd": "{projectRoot}" }
    }
  }
}
```

---

## 🔄 Build Workflow

### Development
```bash
cd /projects/nestjs-common

yarn install                # Single yarn.lock, all packages linked
yarn typecheck             # Type check all packages
yarn lint                  # ESLint all packages
yarn test                  # Vitest all packages
yarn build                 # Build all packages (respects dependency order)
yarn pipeline              # Full CI equivalent
```

### Individual Package (Optional)
```bash
cd /projects/nestjs-common/packages/nestjs-shared

yarn build                 # Build just this package
yarn test                  # Test just this package
```

### Using NX Commands
```bash
nx run nestjs-shared:build           # Build single package
nx run-many --target=build           # Build all packages
nx dep-graph                         # Show dependency graph
```

---

## 📦 Publishing

### Per-Package Publishing
```bash
# 1. Bump version
# 2. Build
cd packages/nestjs-shared && yarn build

# 3. Publish
npm publish
```

The `workspace:*` protocol automatically converts to semantic version during publish.

---

## ⚠️ Special Cases

### nestjs-shared Subpath Exports
Complex exports must be preserved and generate `.d.ts` files:
```json
{
  "exports": {
    ".": { "import": "./build/index.js" },
    "./logging": { "import": "./build/logging/index.js" },
    "./security": { "import": "./build/security/index.js" }
  }
}
```

### nestjs-open-telemetry External Dependency
Depends on `open-telemetry-client` which stays in `/projects/`:
```json
{
  "dependencies": {
    "@pawells/nestjs-shared": "workspace:*",
    "@pawells/open-telemetry-client": "file:../../open-telemetry-client"
  }
}
```

---

## 📚 Document Map

| Document | Time | Audience | Purpose |
|----------|------|----------|---------|
| ARCHITECTURE.md | 10 min | Everyone | Overview & orientation |
| MIGRATION_PLAN_SUMMARY.md | 15 min | Manager, Architect | Goals & phases |
| MIGRATION_GUIDE.md | 10 min | Developer | How-to & examples |
| nx-monorepo-migration-plan.md | 30 min | Architect | Technical deep dive |
| task-breakdown.md | 10 min | Manager, Developer | Executable tasks |

---

## 🤔 Questions?

**"What do I do first?"**
→ Read ARCHITECTURE.md, then delegate Task 1.1

**"How do I build/test?"**
→ See MIGRATION_GUIDE.md (Build & Test Workflows section)

**"What about publishing?"**
→ See MIGRATION_GUIDE.md (Publishing Workflow section)

**"What's the dependency tree?"**
→ See MIGRATION_PLAN_SUMMARY.md (Packages table)

**"What's involved in Task X?"**
→ See task-breakdown.md (Find your phase and task)

**"What configuration needs to change?"**
→ See MIGRATION_GUIDE.md (Configuration Examples section) or nx-monorepo-migration-plan.md (Technical Specifications section)

---

## 📋 Checklist for Kickoff

- [ ] Read ARCHITECTURE.md (10 min)
- [ ] Read MIGRATION_PLAN_SUMMARY.md (15 min)
- [ ] Review task-breakdown.md (10 min)
- [ ] Delegate Task 1.1 to developer
- [ ] Set up TaskUpdate tracking
- [ ] Begin Phase 1

---

**Status**: Design Complete ✅
**Ready for Execution**: Yes ✅
**Total Packages**: 7
**Total Tasks**: 12
**Estimated Effort**: 8-12 hours
**Last Updated**: 2026-03-09
