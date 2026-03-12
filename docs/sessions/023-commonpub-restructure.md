# Session 023: CommonPub Restructure

**Date**: 2026-03-11

## What was done

### Phase 0: Preparation
- Tagged commit `pre-commonpub-rename`
- Created `docs/restructure/` with tracking files (master-plan, master-checklist, rename-map, delete-list, ui-design-spec, reference-app-architecture)
- Verified build + tests pass (27/27 tasks, all tests green)

### Phase 1: Global Rename (snaplify → commonpub)
- Renamed 481 files across the entire repo
- Patterns: `@snaplify/*` → `@commonpub/*`, `SnaplifyConfig` → `CommonPubConfig`, `defineSnaplifyConfig` → `defineCommonPubConfig`, CSS prefix `snaplify-` → `cpub-`, etc.
- Special case: `@snaplify/snaplify` → `@commonpub/protocol`
- Renamed `tools/create-snaplify/` directory → `tools/create-commonpub/`
- Renamed mockup HTML files in `docs/mockups/`
- Fixed one test that was incorrectly renamed (heading slug test expected `cpub-docs` but actual was `commonpub-docs`)
- Fresh pnpm install, all 27 tasks pass

### Phase 2: Delete & Prepare for Framework Switch
- Extracted server business logic to `docs/restructure/extracted-server/`
- Extracted API route patterns to `docs/restructure/extracted-routes/`
- Saved e2e test patterns to `docs/restructure/extracted-e2e/`
- Deleted `apps/landing/` and `apps/reference/` (SvelteKit apps)
- Deleted Svelte components from `packages/ui/`
- Updated `packages/ui/package.json`: Svelte deps → Vue 3 deps
- Updated `vitest.config.ts`, `tsconfig.json`, added `vite.config.ts` for Vue
- Removed `prettier-plugin-svelte` from root
- Updated `turbo.json` outputs (`.svelte-kit` → `.output`, `.nuxt`)
- All 23 remaining tasks pass (11 build, 12 test)

### Phase 3: Server Logic Library (in progress)
- Creating `packages/server/` with framework-agnostic business logic
- Adapting extracted SvelteKit server files to take explicit (db, config) params

### Phase 4: Design Token System Rebuild
- Rewrote `packages/ui/theme/base.css` with unified-v2 design tokens
- New tokens: `--bg`, `--surface`, `--border`, `--accent`, `--shadow-md` (offset shadows), `--text-label`
- Bumped fonts: 16px base (was 14px), 1.7 line-height (was 1.5)
- Created `packages/ui/theme/dark.css`
- Removed old themes: hackbuild.css, deepwood.css, deveco.css
- Updated `theme.ts` with new token names and 3 themes (base, dark, generics)
- Updated theme tests (22 tests pass)

### Phase 5: UI Components (in progress)
- Building 21 Vue 3 SFC components

### Phase 7 (partial): Documentation
- Created ADR 024 (rename), ADR 025 (Nuxt switch), ADR 026 (design direction)
- Marked ADR 001 as superseded

## Decisions Made
- Old themes removed (hackbuild, deepwood, deveco) — base + dark + generics only
- Token system uses both new direct tokens and backward-compatible aliases
- Server package takes explicit (db, config) params — no framework globals

## Open Questions
- Phase 6 (Nuxt reference app) still to be built
- CLAUDE.md needs full rewrite after all phases complete
- docs/plan.md needs updating

## Next Steps
- Complete Phase 3 (server package)
- Complete Phase 5 (Vue components)
- Phase 6: Scaffold Nuxt 3 reference app
- Phase 7: Final doc cleanup, grep check
