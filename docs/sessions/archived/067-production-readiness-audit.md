# Session 067 — Production Readiness Audit & NPM Publish Planning

**Date:** 2026-03-23
**Goal:** Final sweep, fix remaining CI stability issues, plan npm publishing for all @commonpub packages

---

## What Was Done

### Test Stability Fixes
- **Server vitest config**: Added `hookTimeout: 30000` and `testTimeout: 15000` — PGlite's `createTestDB()` + `pushSchema()` was timing out at 10s default under parallel CI load
- **Docs vitest config**: Added `testTimeout: 15000` — shiki syntax highlighting initialization was timing out under load
- **Root .gitignore**: Added `target/` for Rust build artifacts from `create-commonpub` CLI

### NPM Publish Readiness Audit
Comprehensive audit of all 12 @commonpub packages found they are **structurally sound** but **not configured for npm publishing**. Every package is missing:

| Issue | Status | Impact |
|-------|--------|--------|
| `"private": true` on all packages | BLOCKING | npm refuses to publish |
| Missing `publishConfig.access: "public"` | BLOCKING | Scoped packages fail without it |
| Missing `"files"` field | HIGH | Would publish src/, tests, configs to npm |
| Missing `"license"` | HIGH | Required for open-source compliance |
| Missing `"description"` | MEDIUM | npm listing looks empty |
| Missing `"repository"` | MEDIUM | No link back to source |
| Missing `"engines"` | LOW | Consumers don't know Node requirement |
| Missing `"sideEffects"` | LOW | Tree-shaking suboptimal |
| Missing `"prepublishOnly"` | MEDIUM | Risk of publishing stale dist/ |
| `workspace:*` deps need resolution | BLOCKING | npm can't resolve workspace: protocol |
| No peer deps for framework libs | MEDIUM | drizzle-orm, @tiptap/* should be peers |

### Package Dependency Graph (publish order)
```
Tier 0 (no CommonPub deps): config, schema, infra, ui
Tier 1 (Tier 0 deps only):  protocol, auth, editor, docs, test-utils
Tier 2:                      explainer (depends on editor)
Tier 3:                      learning (depends on explainer)
Tier 4 (depends on all):    server
```

---

## Current State

| Check | Result |
|-------|--------|
| `pnpm build` | 14/14 PASS |
| `pnpm typecheck` | 25/25 PASS (0 errors) |
| `pnpm test` | 1,433 pass, 5 skip, 0 fail |
| `pnpm lint` | 0 errors |
| Git | clean, pushed to main |

---

## Decisions Made

1. **Timeout strategy**: Set generous timeouts (30s hooks, 15s tests) for packages with heavy initialization (PGlite, shiki) rather than trying to reduce init time — CI machines have variable performance.

2. **NPM publishing approach**: Will use `pnpm publish` with `--no-git-checks` and workspace version resolution rather than changesets — simpler for initial 0.1.0 release.

3. **Peer dependency strategy**: drizzle-orm, @tiptap/*, and vitest will move to peerDependencies to give consumers version control. zod stays as regular dep (lightweight, stable API).

---

## Open Questions

1. What license? AGPL-3.0 (strong copyleft), MIT (permissive), or Apache-2.0?
2. What initial version — 0.1.0 (pre-release) or 1.0.0?
3. Should `@commonpub/test-utils` be published (dev tool) or stay private?
4. Should we use changesets for version management going forward?

---

## Next Steps (Planned in Session 067 Plan)

1. Update all 12 package.json files for npm readiness
2. Create LICENSE file
3. Set up publish workflow
4. Build the first external federated site using published packages
