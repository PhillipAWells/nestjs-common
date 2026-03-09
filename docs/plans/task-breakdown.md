# NestJS Common Monorepo Migration: Detailed Task Breakdown

## Overview

Consolidate 7 standalone NestJS packages into a single NX monorepo at `/workspaces/pawells/projects/nestjs-common/`. Migration preserves ESM-only format, Vitest testing, individual npm publishability, and adds unified build/test/lint tooling.

**Scope**: nestjs-shared, nestjs-prometheus, nestjs-open-telemetry, nestjs-auth, nestjs-graphql, nestjs-pyroscope, nestjs-qdrant

**Timeline**: 4 phases (Setup, Dependent Packages, Independent Packages, Documentation)

---

## Phase 1: Workspace Setup & nestjs-shared Migration

### Task 1.1: Scaffold NX Workspace and Root Configuration

**Role**: developer
**Description**:
- Verify nestjs-common NX workspace directory exists (currently has `packages/` and config files)
- Prepare root `package.json` with workspaces, dev dependencies, and scripts (build, test, lint, typecheck, pipeline)
- Ensure `tsconfig.base.json` is created with path mappings for all 7 packages
- Create root `.gitignore` to ignore `build/`, `dist/`, `node_modules/`, `.nx/`
- Verify workspace structure: `nx.json` exists, `eslint.config.mjs` is workspace-level config
- Run `corepack enable` and validate Yarn Berry 4.12.0 is active
- Run `yarn install` to create single workspace-level lockfile

**Dependencies**: None

**Complexity**: Low

**Acceptance Criteria**:
- [ ] `package.json` at `/projects/nestjs-common/` defines `"workspaces": ["packages/*"]` with all dev deps
- [ ] `tsconfig.base.json` includes path mappings for @pawells/nestjs-shared, @pawells/nestjs-prometheus, etc.
- [ ] `yarn install` succeeds without errors
- [ ] Single `yarn.lock` exists at workspace root (not per-package)
- [ ] `nx.json` configured with @nx/eslint plugin and target defaults
- [ ] `.gitignore` properly configured

---

### Task 1.2: Migrate nestjs-shared to Workspace

**Role**: developer
**Description**:
- Move `/projects/nestjs-shared/src` to `/projects/nestjs-common/packages/nestjs-shared/src`
- Move `/projects/nestjs-shared` to `/projects/nestjs-common/packages/nestjs-shared` (keeping package.json, tsconfig files, vitest.config.ts, etc.)
- Update `packages/nestjs-shared/package.json`:
  - Remove dependencies with `file:` protocol (none in this case)
  - Ensure `"main"`, `"types"`, `"exports"` point to `./build/`
  - Keep all subpath exports: `./logging`, `./security`, `./validation`, `./metrics`, `./errors`
- Create `packages/nestjs-shared/project.json` with NX targets: build, test, lint, typecheck
- Update `packages/nestjs-shared/tsconfig.json` to extend `../../tsconfig.base.json`
- Update `packages/nestjs-shared/tsconfig.build.json` to extend `tsconfig.json`, exclude tests
- Update `packages/nestjs-shared/tsconfig.test.json` to extend `tsconfig.json`
- Update `packages/nestjs-shared/tsconfig.eslint.json` to extend `tsconfig.json`
- Verify `vitest.config.ts` references correct tsconfig paths

**Dependencies**: Task 1.1

**Complexity**: Medium

**Acceptance Criteria**:
- [ ] Package moved to `packages/nestjs-shared/` with all files intact
- [ ] `package.json` preserves all subpath exports
- [ ] `project.json` created with correct executor targets
- [ ] All tsconfig files created/updated with correct extends paths
- [ ] `yarn install` from workspace root succeeds
- [ ] `yarn build` from workspace root succeeds (via `nx run nestjs-shared:build`)
- [ ] Can run `nx run nestjs-shared:test` and tests pass
- [ ] No import errors or type issues

---

### Task 1.3: Verify nestjs-shared in Workspace (Full Pipeline)

**Role**: devops
**Description**:
- From workspace root, run `yarn typecheck` and verify no errors
- Run `yarn lint` and verify no linting issues
- Run `yarn test` on nestjs-shared specifically: `nx run nestjs-shared:test` and verify all tests pass
- Run `yarn build` and verify `packages/nestjs-shared/build/` created with all output files
- Verify generated `.d.ts` files for subpath exports exist: `build/logging/index.d.ts`, `build/security/index.d.ts`, etc.
- Check coverage thresholds are met (70% for mcp-memory style, 80% baseline)

**Dependencies**: Task 1.2

**Complexity**: Low

**Acceptance Criteria**:
- [ ] `yarn typecheck` passes with no errors
- [ ] `yarn lint` passes with no errors
- [ ] `yarn test` passes with all tests green
- [ ] Coverage report shows >=70% coverage
- [ ] Build artifacts in `build/` match expected output
- [ ] No console warnings or deprecation messages
- [ ] `yarn pipeline` (full sequence) passes end-to-end

---

## Phase 2: Migrate Dependent Packages

### Task 2.1: Migrate nestjs-prometheus to Workspace

**Role**: developer
**Description**:
- Move `/projects/nestjs-prometheus` to `/projects/nestjs-common/packages/nestjs-prometheus`
- Update `package.json`:
  - Change `"@pawells/nestjs-shared": "file:../nestjs-shared"` to `"@pawells/nestjs-shared": "workspace:*"`
  - Preserve all other deps and peer deps
  - Preserve `"exports"` (if any subpath exports exist)
- Create `packages/nestjs-prometheus/project.json` with NX targets
- Update tsconfig files to extend `../../tsconfig.base.json`
- Verify vitest.config.ts paths are correct

**Dependencies**: Task 1.3

**Complexity**: Medium

**Acceptance Criteria**:
- [ ] Package moved to correct location with all files
- [ ] `package.json` uses `workspace:*` for nestjs-shared
- [ ] `project.json` created with build, test, lint targets
- [ ] `yarn install` from workspace root succeeds
- [ ] No circular dependency warnings
- [ ] Can import from `@pawells/nestjs-shared` without path issues

---

### Task 2.2: Verify nestjs-prometheus (Full Pipeline)

**Role**: devops
**Description**:
- Run `nx run nestjs-prometheus:typecheck` and verify no errors
- Run `nx run nestjs-prometheus:lint` and verify no issues
- Run `nx run nestjs-prometheus:test` and verify all tests pass
- Run `nx run nestjs-prometheus:build` and verify build succeeds
- Verify imports from nestjs-shared resolve correctly (no "module not found" errors)
- Test coverage thresholds

**Dependencies**: Task 2.1

**Complexity**: Low

**Acceptance Criteria**:
- [ ] All checks pass (typecheck, lint, test, build)
- [ ] Coverage >=80%
- [ ] Build output complete
- [ ] No import resolution errors

---

### Task 2.3: Migrate nestjs-open-telemetry to Workspace

**Role**: developer
**Description**:
- Move `/projects/nestjs-open-telemetry` to `/projects/nestjs-common/packages/nestjs-open-telemetry`
- Update `package.json`:
  - Change `"@pawells/nestjs-shared": "file:../nestjs-shared"` to `"@pawells/nestjs-shared": "workspace:*"`
  - Keep `"@pawells/open-telemetry-client": "file:../../open-telemetry-client"` (stays in /projects/, not migrated)
- Create `project.json` with NX targets
- Update tsconfig files
- Verify vitest.config.ts

**Dependencies**: Task 2.2

**Complexity**: Medium

**Acceptance Criteria**:
- [ ] Package moved to correct location
- [ ] `package.json` correctly references both dependencies
- [ ] `project.json` created
- [ ] `yarn install` succeeds
- [ ] Path mapping to open-telemetry-client resolves correctly (special case: external to monorepo)

---

### Task 2.4: Verify nestjs-open-telemetry (Full Pipeline)

**Role**: devops
**Description**:
- Run full pipeline on nestjs-open-telemetry: typecheck, lint, test, build
- Verify both nestjs-shared and open-telemetry-client imports work
- Test coverage and build output

**Dependencies**: Task 2.3

**Complexity**: Low

**Acceptance Criteria**:
- [ ] All pipeline checks pass
- [ ] Coverage >=80%
- [ ] Both external and internal dependencies resolve correctly

---

## Phase 3: Migrate Independent Packages

### Task 3.1: Batch Migrate Independent Packages

**Role**: developer
**Description**:
- For each package (nestjs-auth, nestjs-graphql, nestjs-pyroscope, nestjs-qdrant):
  - Move `/projects/{name}` to `/projects/nestjs-common/packages/{name}`
  - Update `package.json` (no workspace:* conversions needed, as none have internal deps)
  - Verify all external dependencies are correct
  - Create `project.json` with NX targets
  - Update tsconfig files to extend `../../tsconfig.base.json`
  - Verify vitest.config.ts paths

**Dependencies**: Task 2.4

**Complexity**: Medium (batching 4 packages)

**Acceptance Criteria**:
- [ ] All 4 packages moved to correct locations
- [ ] Each has proper `package.json`, `project.json`, tsconfig files
- [ ] `yarn install` from workspace root succeeds with no warnings
- [ ] No circular dependencies detected
- [ ] Each package ready for testing

---

### Task 3.2: Verify All Packages (Full Workspace Pipeline)

**Role**: devops
**Description**:
- From workspace root, run complete pipeline: `yarn typecheck && yarn lint && yarn test && yarn build`
- This runs all 7 packages through all checks
- Verify no inter-package import errors
- Verify all builds succeed
- Check test coverage for each package
- Verify lint passes workspace-wide

**Dependencies**: Task 3.1

**Complexity**: Low

**Acceptance Criteria**:
- [ ] `yarn typecheck` passes (all 7 packages)
- [ ] `yarn lint` passes (all 7 packages)
- [ ] `yarn test` passes (all 7 packages, coverage >=80% or 70% for specific packages)
- [ ] `yarn build` completes successfully (all 7 packages)
- [ ] No errors, warnings, or deprecations
- [ ] All build artifacts in correct locations

---

## Phase 4: Documentation, Publishing, and Cleanup

### Task 4.1: Create Architecture & Migration Documentation

**Role**: writer
**Description**:
- Document final monorepo structure in `docs/architecture/monorepo-structure.md`
- Include:
  - Workspace layout diagram (tree structure)
  - Package dependency graph (which packages depend on which)
  - Build, test, lint workflow (NX commands vs npm scripts)
  - Publishing workflow (per-package npm publish)
  - Path mapping strategy
  - Workspace protocols (workspace:*)
- Create `docs/plans/migration-completed.md` with:
  - Summary of all changes
  - Diff of configuration changes (package.json, tsconfig, etc.)
  - Before/after examples for common tasks
  - Troubleshooting guide

**Dependencies**: Task 3.2

**Complexity**: Low

**Acceptance Criteria**:
- [ ] Architecture documentation complete with diagrams
- [ ] Migration summary document created
- [ ] Clear examples of new workflows
- [ ] Troubleshooting guide addresses common issues

---

### Task 4.2: Update CI/CD Workflows (GitHub Actions)

**Role**: devops
**Description**:
- Review current GitHub Actions workflows for each package
- Create unified workflow at `.github/workflows/nestjs-common-pipeline.yml` that:
  - Runs on push to main, PRs to main
  - Executes single `yarn pipeline` command (covers all packages)
  - Uses NX caching for faster runs
  - Publishes on version tag (e.g., `v*-nestjs-shared` or per-package tag)
- Remove/archive individual package workflows if they exist
- Test workflow locally with `act` or by creating a test branch

**Dependencies**: Task 4.1

**Complexity**: Medium

**Acceptance Criteria**:
- [ ] Single unified workflow created
- [ ] Workflow triggers correctly on push/PR
- [ ] Workflow runs `yarn pipeline` successfully
- [ ] NX caching is enabled
- [ ] All checks (typecheck, lint, test, build) run in workflow
- [ ] Publishing mechanism tested

---

### Task 4.3: Clean Up Old Standalone Directories

**Role**: devops
**Description**:
- Remove old standalone package directories:
  - `/projects/nestjs-auth/`
  - `/projects/nestjs-graphql/`
  - `/projects/nestjs-pyroscope/`
  - `/projects/nestjs-qdrant/`
  - `/projects/nestjs-prometheus/`
  - `/projects/nestjs-open-telemetry/`
  - `/projects/nestjs-shared/` (migrated content already in nestjs-common)
- Update any monorepo root references or documentation pointing to old locations
- Verify git history is clean (old commits preserved, but directories removed)
- Update any CI/CD or build scripts referencing old package locations
- Run final validation: `yarn install`, `yarn pipeline`

**Dependencies**: Task 4.2

**Complexity**: Low

**Acceptance Criteria**:
- [ ] Old directories removed from filesystem
- [ ] Git history clean (no dangling references)
- [ ] No broken references in documentation or scripts
- [ ] `yarn install` and `yarn pipeline` pass cleanly
- [ ] Monorepo is self-contained within `/projects/nestjs-common/`

---

## Summary

**Total Tasks**: 12

**Phase Breakdown**:
- **Phase 1** (Setup + nestjs-shared): 3 tasks
- **Phase 2** (Dependent packages): 4 tasks
- **Phase 3** (Independent packages): 2 tasks
- **Phase 4** (Documentation + cleanup): 3 tasks

**Critical Path**:
Task 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3 → 2.4 → 3.1 → 3.2 → 4.1 → 4.2 → 4.3

**Parallelization Opportunities**:
- Tasks 2.1 & 2.3 can run in parallel (both migrate dependent packages)
- Tasks 4.1, 4.2, 4.3 can run in parallel after 3.2

**Estimated Effort**:
- Phase 1: 3-4 hours
- Phase 2: 2-3 hours
- Phase 3: 1-2 hours
- Phase 4: 2-3 hours
- **Total**: 8-12 hours (depending on complexity)
