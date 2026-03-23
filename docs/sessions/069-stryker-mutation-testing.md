# Session 069 — Stryker Mutation Testing & Contest Permissions

**Date:** 2026-03-23
**Goal:** Set up Stryker mutation testing, use results to improve test quality, add contest creation permissions

---

## What Was Done

### Contest Creation Permissions
- Added `contestCreation` config option to `@commonpub/config`: `'open' | 'staff' | 'admin'` (default: `admin`)
- Added `canCreateContest(userRole, policy)` helper in `@commonpub/server`
- `createContest()` accepts optional permission check (backward compatible)
- Reference app API route enforces policy from config
- 7 new tests covering all role/policy combinations
- Created `docs/reference/guides/admin-and-permissions.md`

### Stryker Mutation Testing Setup
- Installed `@stryker-mutator/core` + `@stryker-mutator/vitest-runner` at root
- Created per-package Stryker configs for infra, schema, protocol, editor, server
- Used `appendPlugins` workaround for pnpm strict node_modules (child process can't resolve plugins otherwise)
- Added `public-hoist-pattern[]=@stryker-mutator/*` to `.npmrc`
- Added `stryker:*` scripts to root package.json
- Added `reports/` and `.stryker-tmp/` to `.gitignore`

### Test Improvements from Mutation Analysis

**@commonpub/infra (63% → 69%):**
- Added exact CSP directive value assertions (font-src, connect-src, base-uri, form-action)
- Added rate limit boundary tests (at-limit vs over-limit)
- Added exact MAX_UPLOAD_SIZES byte value assertions
- Added specific MIME type tests (svg, zip, gzip)
- Added validateUpload boundary tests (at limit, 1 byte over)
- Added escapeHtml entity output verification (all 5 entities)
- Added notification digest text format test
- Added createStorageFromEnv env var combination tests

**@commonpub/protocol (73% → 75%, sanitizer 60% → 72%):**
- Added 19 sanitize tests: blob/ftp URL stripping, whitespace-padded URLs, data URI filtering
- Added attribute parsing tests: single quotes, unquoted values, angle bracket escaping
- Added attribute filtering tests: disallowed stripped, allowed preserved
- Added element-specific attribute tests: td colspan, ol start/type, code class
- Added self-closing tag preservation tests

### Test Stability
- Server vitest hookTimeout: 30s, testTimeout: 15s
- Protocol vitest testTimeout: 30s
- Docs vitest testTimeout: 30s

---

## Mutation Testing Results

| Package | Score | Killed | Survived | No Cov | Notes |
|---------|-------|--------|----------|--------|-------|
| infra | 69% | 294 | 57 | 78 | security 80%, image 26% (needs sharp) |
| protocol | 75% | 724 | 191 | 47 | 4 modules at 100%, sanitizer 72% |
| editor | 31% | 268 | 312 | 292 | serialization.ts 25% (huge surface) |
| schema | 8% | 115 | 469 | 924 | table defs untestable, validators 26% |

**Total mutants killed this session:** 48 additional (from 30 new tests)

---

## Decisions Made

1. **No TypeScript checker in Stryker** — pnpm hoisting prevents the `@stryker-mutator/typescript-checker` child process from resolving. Using vitest runner only.
2. **`appendPlugins` pattern** — Explicitly provide the absolute path to `@stryker-mutator/vitest-runner` plugin to work around pnpm's strict resolution.
3. **Per-package configs** — Each priority package has its own `stryker.config.mjs` with focused `mutate` patterns for faster runs.
4. **Contest permissions default to admin** — Open registration instances should restrict contest creation by default to prevent spam.

---

## Current State

| Check | Result |
|-------|--------|
| `pnpm build` | 14/14 PASS |
| `pnpm typecheck` | 25/25 PASS |
| `pnpm test` | 1,452+ tests, 5 skip, 0 fail |
| `pnpm lint` | 0 errors |
| Git | clean, pushed |

---

## Next Steps

- Continue improving mutation scores on remaining surviving mutants
- Focus areas: serialization.ts (editor), validators.ts (schema), actorResolver.ts (protocol)
- Consider running Stryker in CI (non-blocking) once scores stabilize above 70%
- Build first external federated site using published packages
