# Contributing to @pawells/nestjs-common

## Prerequisites

- **Node.js** >= 22.0.0
- **Corepack** enabled (ships with Node.js — run `corepack enable` once to activate Yarn 4)

## Getting Started

```bash
git clone https://github.com/PhillipAWells/nestjs-common.git
cd nestjs-common
yarn install
```

## Development Workflow

### Workspace Commands

Run all commands from the workspace root unless noted otherwise.

```bash
# Full pipeline: typecheck → lint → test → build
yarn pipeline

# Individual steps
yarn typecheck
yarn lint
yarn lint:fix
yarn test
yarn build
```

### Per-Package Commands

To work on a single package, navigate into its directory first.

```bash
cd packages/nestjs-auth
yarn pipeline
yarn test
yarn test:coverage   # per-package only; not available at the workspace root
```

### NX Cache

NX caches the `build`, `test`, `lint`, and `typecheck` targets. If you need a clean run, bypass the cache:

```bash
yarn pipeline --skip-nx-cache
yarn test --skip-nx-cache
```

## Code Style

Style is enforced by ESLint v9 flat config (`eslint.config.mjs`). The authoritative rules are in that file; the summary below is for quick reference.

- **Indentation**: Tabs
- **Quotes**: Single
- **Semicolons**: Required
- **Trailing commas**: Always (multiline)
- **Access modifiers**: Required on all class members except constructors
- **Return types**: Explicit on all functions
- **Naming**: `PascalCase` for classes, interfaces, types, and enums; `camelCase` for variables and functions; `UPPER_CASE` for constants

Test files have relaxed rules: type annotations and naming conventions are not enforced.

Run `yarn lint:fix` to apply auto-fixable corrections.

## Testing

Tests run with Vitest. Every package must maintain **80% coverage** for lines, functions, branches, and statements.

```bash
# Run all tests from the workspace root
yarn test

# Run with coverage report (per-package only)
cd packages/nestjs-shared
yarn test:coverage
```

Tests that drop below the 80% threshold will fail the pipeline.

## Pre-commit Hooks

The `.husky/pre-commit` hook runs automatically on every commit and performs two checks:

1. **Dependency version guard** — rejects commits that introduce non-semver dependency versions (`file:`, `workspace:`, `git+`, etc.).
2. **Typecheck and lint** — runs `yarn typecheck && yarn lint` across the workspace.

Fix any reported issues before committing again. Do not bypass the hooks.

## Release Process

All packages share a single version managed by NX release (`projectsRelationship: "fixed"` in `nx.json`). There is no `version` field in the workspace root `package.json`; versions live in each package's own `package.json` under `packages/`.

### Production Release

Triggered by pushing a `v*` tag to GitHub. Publishes all non-private packages to npm under the `latest` tag and creates a GitHub Release with auto-generated notes.

**Steps:**

```bash
# 1. On your development branch — bump the version
nx release version patch   # or minor / major
# (This commits the version change; no tag is created yet.)

# 2. Open a PR and merge to main.

# 3. On main after the merge — create and push the tag
git tag v$(node -p "require('./packages/nestjs-shared/package.json').version")
git push --tags
```

The publish workflow (`.github/workflows/publish.yml`) picks up the tag and handles the rest.

### Dev Snapshot

Triggered automatically on every push to any `development/**` branch. No manual steps are required.

Publishes under the `@dev` npm tag with a version in the form `{base}-dev.{sha}` (for example, `1.0.2-dev.abc1234`). Use dev snapshots to test unreleased changes in downstream projects:

```bash
yarn add @pawells/nestjs-shared@dev
```

### Pre-release

Triggered manually via **GitHub Actions → Publish workflow → Run workflow**. Select a preid when prompted: `dev`, `alpha`, `beta`, or `rc`.

The workflow bumps the version (for example, `1.0.3-beta.0`), creates a git tag, and publishes under the matching npm tag (e.g., `@beta`).

## Adding a New Package

New packages belong under `packages/`. At minimum, each package directory needs:

- `package.json`
- `tsconfig.json`, `tsconfig.build.json`, `tsconfig.eslint.json`
- `vitest.config.ts`
- `project.json` (NX project configuration)

Follow the patterns used in existing packages. For standalone packages with no cross-package dependencies, `nestjs-qdrant` and `nestjs-nats` are good references.

Additional notes:

- Add the new package's peer dependencies to the workspace root `package.json` under `devDependencies`.
- Set `"private": true` in the package's `package.json` if it should not be published to npm.
- The package will be included in `yarn pipeline` and the CI run automatically once `project.json` is present.

## CI

The CI pipeline runs on every push to `main` and every pull request targeting `main`. It executes `yarn pipeline` — typecheck, lint, test, and build — across all packages.

All pipeline steps must pass before a pull request can be merged.
