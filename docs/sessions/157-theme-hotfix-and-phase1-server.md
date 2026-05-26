# Session 157 — Theme editor 0.22.1 hotfix + Phase 1 layout engine server-side

**Date**: 2026-05-26
**Branch**: main
**Status**: hotfix LIVE on all 3 sites; Phase 1 server CRUD + LayoutSlot pushed to main (commonpub.io deploys workspace layer); npm packages NOT yet bumped for Phase 1 work

## TL;DR

User reported the dark/light toggle in the theme editor preview pane did nothing. Audit found 2 more bugs in the same shape (state-update-but-no-render) plus discovery-banner UX trap. All 3 fixed + polish. Published as `@commonpub/layer@0.22.1`, deployed to all 3 sites. Same session: Phase 1 layout engine server-side landed — full CRUD module (21 PGlite tests), `features.layoutEngine` flag (default OFF), `/api/layouts/by-route` endpoint, `<LayoutSlot>` Vue component, `useLayout` composable. All behind-flag — zero behavior change until consumers wire it in (Phase 1c next session).

## Theme editor hotfix 0.22.1 — LIVE

| Bug | Severity | Root cause |
|---|---|---|
| **Light/Dark toggle in preview pane dead** | User-reported | `:data-theme="parentTheme"` was hardcoded; toggle updated `previewMode` ref but never re-rendered |
| **`applyAndSave` race in create mode** | Latent | `save()` called `router.replace` BEFORE the PUT to `theme.default`, possibly unmounting mid-PUT |
| **Discovery banner forever offers to capture already-captured custom theme** | UX trap | `detectAppliedOverrides` reads `:root` computed styles; a saved+applied custom theme registers there, so the banner perpetually offered to re-capture itself |

**Fixes (in `AdminThemePreviewPane.vue` + `pages/admin/theme/edit/[id].vue` + `pages/admin/theme/index.vue`)**:

1. **Light/Dark**: new `effectiveDataTheme` computed maps `parentTheme + previewMode` to its family's variant slug via inline `FAMILY_VARIANT_OF` map. Returns `undefined` for the base/light case (matches the `applyThemeToElement` convention elsewhere — no `data-theme` attr = `:root` rules apply natively).
2. **Apply race**: refactored `save()` to take `{ apply: boolean }`. Apply now runs BEFORE navigation. Uses the SERVER-returned `savedId` (in case server canonicalized the slug).
3. **Discovery banner gate**: new `showDiscoveryBanner` computed — hides when `instanceDefault` starts with `cpub-custom-` OR instance-wide token overrides are set.

**Polish (same files)**:
- Save / Save & apply buttons show spinner + "Saving…/Applying…" copy when in-flight
- Back button shows a subtle pulsing accent dot when draft is dirty (respects `prefers-reduced-motion`)
- Name input now `font-weight-semibold` for hierarchy
- Save button uses `() => save()` lambda so the @click typing doesn't try to pass a `PointerEvent` to the `{apply}`-shaped save fn

**Live verification** (23:02 UTC):

| Site | layer | /api/health | / | /admin/theme | /api/admin/themes |
|---|---|---|---|---|---|
| commonpub.io | **0.22.1** | 200 / 406ms | 200 / 1010ms | 302 | 401 |
| deveco.io | **0.22.1** | 200 / 361ms | 200 / 718ms | 302 | 401 |
| heatsynclabs.io | **0.22.1** | 200 / 344ms | 200 / 2743ms | 404 (pre-existing) | 401 |

## Phase 1 layout engine — server-side complete

The schema + types shipped in session 155. This session built the consumer-facing pieces:

### Server CRUD (`packages/server/src/layout/layout.ts`, 520 lines)

8 exports: `listLayouts`, `getLayoutByScope`, `getLayoutById`, `saveLayout`, `deleteLayout`, `publishLayout`, `listLayoutVersions`, `revertToVersion`.

**`saveLayout` semantics**: atomic "replace whole layout" — accepts the full nested `zones → rows → sections` payload, renormalizes positions to `{0..n}`, rewrites children in a single transaction. Preserves user-supplied `id` fields so rows + sections survive reorders cleanly.

**Versioning**: `publishLayout` snapshots into `layout_versions` (immutable), sets `layouts.published_version_id`, transitions `state → 'published'`. `revertToVersion` copies a snapshot back to current — the version row itself is never touched (immutable history).

**Tests**: 21 new PGlite integration tests covering CRUD round-trip, position normalization, cascade deletion, defaults, all 3 scope variants, version immutability, revert, forward-compat with unknown section types. Server total: **1003 → 1024 passed**.

### Feature flag (`packages/config/`)

`FeatureFlags.layoutEngine: boolean` added (default OFF). Layer's by-route endpoint + `<LayoutSlot>` consult this — when OFF, the endpoint 404s and `<LayoutSlot>` renders nothing. **Required-before-consumer** per CLAUDE.md rule #2.

### Public API endpoint (`layers/base/server/api/layouts/by-route.get.ts`)

`GET /api/layouts/by-route?path=/some-path` — gated by `features.layoutEngine`. Module-level 60s cache keyed by path. Returns slim shape `{ zones, pageMeta, state }` for SSR consumption. Exports `invalidateLayoutsByRouteCache()` for write-time invalidation (used by future admin layout APIs).

### Vue consumer (`layers/base/components/LayoutSlot.vue`)

`<LayoutSlot route="/" zone="main" />` renders one zone of a route's active layout. 12-column CSS Grid per row with `--cpub-section-cols-{sm|md|lg}` custom properties driving responsive `grid-column` spans via media queries (mobile default 12 = stack). Visibility filters at render time: `enabled`, `role`, `feature`, `hideAt`. `previewOverride` prop lets the editor's preview pane render an in-progress draft (single source of truth for editor + production rendering).

Section renderer is a placeholder until **Phase 1c** (next session: section registry + 5 starter sections). Current behavior shows the section type inside a dashed placeholder — testable structurally without the registry.

### `useLayout` composable (`layers/base/composables/useLayout.ts`)

SSR-safe wrapper around `useFetch`. 404-as-null so consumers fall through gracefully when the flag is off.

## Mid-session CI catch

**First push**: Phase 1 commits failed CI — `vue-tsc --noEmit` caught that the new `FeatureFlags.layoutEngine` field broke two literal-typed `FeatureFlags` objects: `packages/test-utils/src/mockConfig.ts` and `packages/server/src/identity/__tests__/health.test.ts`. Pre-push, `pnpm test` (vitest+esbuild loose) had not caught it. **Same shape as session 156's vue-tsc-vs-vitest catch.**

**Fix commit** (`42e00d2`): added `layoutEngine: false` to both literals. Re-ran the full pre-push gauntlet across all 12 packages — all clean. Memory `feedback_vue_tsc_strict_vs_vitest.md` updated with the canonical pre-push gauntlet command:

```bash
for pkg in schema config ui server test-utils auth infra editor explainer learning protocol docs; do
  printf "%-30s " "@commonpub/$pkg:"
  out=$(pnpm --filter "@commonpub/$pkg" typecheck 2>&1 | grep -E "^src/.*\.ts\(|error TS" | head -1)
  if [ -z "$out" ]; then echo "OK"; else echo "❌ $out"; fi
done
cd apps/reference && pnpm exec nuxt prepare && pnpm exec vue-tsc --noEmit
```

~30s runtime. **Caught twice now** — this should become a git pre-push hook.

## Commits

| Repo | Hash | Subject |
|---|---|---|
| commonpub | `d23f4f2` | fix(layer): theme editor 3 bugs + UX polish (0.22.1) |
| deveco-io | `0db7d25` | chore: bump @commonpub/layer 0.22.0 → 0.22.1 |
| heatsynclabs-io | `8b5526c` | chore: bump @commonpub/layer 0.22.0 → 0.22.1 (preserved WIP) |
| commonpub | `56fc6d2` | feat(server,config): Phase 1 layout engine — server CRUD + features.layoutEngine flag |
| commonpub | `4fa2a10` | feat(layer): Phase 1 layout engine consumer — LayoutSlot, useLayout, by-route API |
| commonpub | `42e00d2` | fix(test-utils,server): add layoutEngine to FeatureFlags mock literals |

No AI attribution in any commit (per memory `feedback_no_coauthor`).

## Versions live + on npm

| Package | npm | Live on |
|---|---|---|
| `@commonpub/schema` 0.17.0 | ✅ | (no change since session 156) |
| `@commonpub/config` 0.14.0 | ✅ | — (0.15.0 deferred; flag landed in main only) |
| `@commonpub/ui` 0.9.0 | ✅ | (no change since session 156) |
| `@commonpub/server` 2.56.0 | ✅ | — (2.57.0 deferred until Phase 1c so consumers get a meaningful release) |
| `@commonpub/layer` **0.22.1** | ✅ | commonpub.io, deveco.io, heatsynclabs.io |

Phase 1 server CRUD + LayoutSlot are in commonpub.io's deployed code (workspace layer) but inert until `layoutEngine` flag flips ON. No behavior change.

## Test counts

| Package | After session 156 | After this session | Delta |
|---|---|---|---|
| `@commonpub/schema` | 413 | 413 | — |
| `@commonpub/config` | 23 | 23 | — |
| `@commonpub/ui` | 256 | 256 | — |
| `@commonpub/server` | 1003 | **1024** | +21 (layout CRUD integration) |
| `@commonpub/layer` | 95 | 95 | — |

**Total: 1811 passed.**

## What's next session (Phase 1c)

1. **Section registry plugin** (`layers/base/plugins/sections.{client,server}.ts`) — startup-time registration of the 5 starter section types
2. **5 starter sections** (Vue components + Zod schemas + tests): `hero`, `heading`, `paragraph`, `image`, `contentFeed`
3. **`<LayoutSlot>` renderer integration** — wire the registry into the placeholder
4. **Homepage migration script** — converts existing `homepage.sections` setting → a `layouts` row + rows + sections
5. **Adopt `<LayoutSlot>` in `pages/index.vue`** behind `v-if="layoutEngine"` with legacy `HomepageSectionRenderer` as fallback
6. **drizzle-kit meta snapshot for migration 0005** — `pnpm drizzle-kit generate` then reconcile with the hand-written SQL
7. **Bump + publish**: config 0.14.0→0.15.0, server 2.56.0→2.57.0, layer 0.22.1→0.23.0
8. **Per-instance**: run migration + enable `features.layoutEngine` selectively (commonpub.io first as canary)

## Standing rule reminders

- Schema is the work. Migration count: 6 (unchanged).
- No feature without a flag. `features.layoutEngine` ✓ added before the consumer code.
- `var(--*)` only. New CSS uses var(--*) exclusively.
- WCAG 2.1 AA min.
- Sessions logged at `docs/sessions/NNN-*.md`.
- **No Claude attribution** in any git artifact — confirmed.
- **Pre-push gauntlet** documented in `feedback_vue_tsc_strict_vs_vitest.md` — run before EVERY push that touches type-shared interfaces.
