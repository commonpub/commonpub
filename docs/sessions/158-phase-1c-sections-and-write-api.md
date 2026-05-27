# Session 158 — Phase 1c sections + admin write API + homepage adoption

**Date**: 2026-05-26
**Branch**: main
**Status**: Slice landed in main + deployed to commonpub.io (workspace layer mode); nothing published to npm. `features.layoutEngine` still defaults OFF; default behavior unchanged on all 3 prod sites (deveco.io + heatsynclabs.io still on `@commonpub/layer@0.22.1` npm).

## TL;DR

Three of the six Phase 1c priorities from the 158 handoff:

1. **Built 5 starter sections** (hero / heading / paragraph / image / content-feed) following the divider pattern from session 157. 6 sections registered total.
2. **Built the admin layout write API** (9 routes) wired to the existing server CRUD, with a static contract test that every write handler calls `invalidateLayoutsByRouteCache()`.
3. **Adopted `<LayoutSlot>` on the homepage** as a v-if branch behind `features.layoutEngine`, with the existing configurable + legacy renderers as the v-else-if / v-else fallbacks.

Deferred to follow-up sessions: the real legacy `homepage.sections` migration (needs Phase 6b's remaining section types), the publish bundle (config/server/layer bumps), per-instance canary on commonpub.io. Operators who want the engine on today can use the new `POST /api/admin/layouts/seed-homepage` to populate a minimal default (hero + content-feed) before flipping the flag.

## What shipped

### Five starter sections

Following the canonical `divider` pattern (3 files: builtin/{type}.ts + components/sections/Section{Type}.vue + one registry.register call):

| Type slug | Category | Default colSpan | Resizable | Notes |
|---|---|---|---|---|
| `hero` | layout | 12 (min 6) | yes | h1 + eyebrow + subtitle + up to 2 CTAs. Variants: default / compact / centered. Intentionally NOT contest-aware — that's a Phase 6b data section |
| `heading` | content | 12 (min 3) | yes | h1–h4 + optional eyebrow + subline, align left/center |
| `paragraph` | content | 6 (min 3) | yes | Plain prose, blank-line split into `<p>`. Phase 3e bumps to TipTap subset via `.describe('rich')` |
| `image` | content | 12 (min 3) | yes | Lazy `<img>`, optional `<a href>` wrap (a11y-correct: only when href truthy), optional figcaption. Fit + aspect ratio enums |
| `content-feed` | data | 12 (min 6) | yes | Server-backed grid of `<ContentCard>`. The first DATA section. Builds an `/api/content` query from config; renders 1–4 cols responsive |

**Test coverage**: registry test flipped the "NOT YET registered" negative-regression block into positive assertions; added per-section schema spot-checks (level enum, limit clamp, columns enum, length caps). Plus a no-hardcoded-colors grep sweep across every `Section*.vue` style block — closes `feedback_universal_radius_leak` / `feedback_prose_style_leak` style discipline structurally for new sections.

Five per-section render test files (`Section{Type}.test.ts`) cover default + custom configs + variant data attributes + a11y wiring (heading id ↔ section aria-labelledby).

**Pitfall caught**: SectionContentFeed initially used `await useFetch(...)`, copied from `pages/index.vue`. That made the component require Suspense — neither prod nor editor preview is set up for that, and tests required messy multi-tick flushing. Refactored to non-await `useFetch` + template surfacing of pending/empty/loaded states. Now it renders cleanly in any context.

### Admin layout write API (9 routes)

| Verb | Route | Server call | Invalidates |
|---|---|---|---|
| GET | `/api/admin/layouts` | `listLayouts(scopeType?)` | — |
| POST | `/api/admin/layouts` | `saveLayout(create)` | yes |
| GET | `/api/admin/layouts/[id]` | `getLayoutById` | — |
| PUT | `/api/admin/layouts/[id]` | `saveLayout(update)` + scope-immutable guard | yes |
| DELETE | `/api/admin/layouts/[id]` | `deleteLayout` (cascade) | yes |
| POST | `/api/admin/layouts/[id]/publish` | `publishLayout` | yes |
| GET | `/api/admin/layouts/[id]/versions` | `listLayoutVersions` | — |
| POST | `/api/admin/layouts/[id]/versions/[versionId]/revert` | `revertToVersion` | yes |
| POST | `/api/admin/layouts/seed-homepage` | `seedHomepageLayout` | yes (if created) |

Every handler gates on `requireFeature('admin') + requireFeature('layoutEngine') + requireAdmin(event)`. Every write handler calls `invalidateLayoutsByRouteCache()` before returning.

**Refactor**: lifted the layout cache from a private module-level Map in `by-route.get.ts` into a shared `server/utils/layoutCache.ts`. Admin handlers import the invalidator cleanly; `by-route.get.ts` re-exports for backwards compat. Util ships with its own 5-test suite (round-trip / TTL constant / full-wipe / null-as-value / overwrite).

**Contract test**: `handlers-contract.test.ts` walks every `*.{get,post,put,delete,patch}.ts` under `api/admin/layouts/`, asserts each file matches `requireFeature('admin')` + `requireFeature('layoutEngine')` + `requireAdmin(`. Then walks only the write files and asserts each contains `invalidateLayoutsByRouteCache(`. Cheap regex check; catches "forgot to invalidate on a new endpoint" at refactor time without a full nitro test harness.

### Seed homepage helper

`packages/server/src/layout/seed.ts` — `seedHomepageLayout(db, { adminId? })`. Idempotent: returns `{ created: false, layoutId: existing.id }` if the layout already exists at `('route', '/')`. Otherwise creates + immediately publishes a default layout: hero (full-width zone) + content-feed (main zone).

**Why a seed, not a real migration**: the legacy `homepage.sections` JSON dispatches to 9 section types (hero / editorial / content-grid / content-carousel / contests / hubs / learning / stats / custom-html); Phase 1c only has 5 starters. A real migration must wait until Phase 6b adds the remaining sections. Until then, the seed lets operators flip the flag and immediately see a non-empty homepage that exercises the full render path end-to-end.

7 PGlite integration tests cover: idempotent second call, route-scope creation, published+v1-snapshot, two-zone shape, config round-trip, admin attribution on createdBy/updatedBy/publishedBy, optional adminId for CLI/system bootstrap.

### Homepage adoption

`layers/base/pages/index.vue` now has a three-way conditional:

```vue
<template v-if="layoutEngineEnabled">
  <!-- 3 LayoutSlot zones: full-width, main, sidebar -->
</template>
<template v-else-if="hasCustomSections">
  <!-- existing configurable section renderer -->
</template>
<template v-else>
  <!-- legacy hardcoded homepage (hero, tabs, feed, sidebar) -->
</template>
```

Flag default OFF → existing behavior on all 3 prod sites unchanged.

**Side fix**: the layer's local `FeatureFlags` interface (in `composables/useFeatures.ts`) was missing `layoutEngine` — session 157 added it to `@commonpub/config`'s `FeatureFlags` but missed the layer mirror. Caught now (composable destructure failed vue-tsc strict). Fixed: added `layoutEngine: boolean` to the interface + `false` to `DEFAULT_FLAGS` + a `computed(() => flags.value.layoutEngine)` to the destructure. New gotcha noted in `layout-engine.md`'s "common pitfalls".

## Files

| File | Type |
|---|---|
| `layers/base/sections/builtin/hero.ts` | new |
| `layers/base/sections/builtin/heading.ts` | new |
| `layers/base/sections/builtin/paragraph.ts` | new |
| `layers/base/sections/builtin/image.ts` | new |
| `layers/base/sections/builtin/content-feed.ts` | new |
| `layers/base/sections/registry.ts` | flipped to register all 6 |
| `layers/base/sections/__tests__/registry.test.ts` | rewritten — negative block → positive; +schema + +color-sweep |
| `layers/base/components/sections/SectionHero.vue` | new |
| `layers/base/components/sections/SectionHeading.vue` | new |
| `layers/base/components/sections/SectionParagraph.vue` | new |
| `layers/base/components/sections/SectionImage.vue` | new |
| `layers/base/components/sections/SectionContentFeed.vue` | new |
| `layers/base/components/sections/__tests__/Section{Hero,Heading,Paragraph,Image,ContentFeed}.test.ts` | 5 new test files |
| `packages/server/src/layout/seed.ts` | new |
| `packages/server/src/__tests__/layout-seed.integration.test.ts` | new (PGlite, 7 tests) |
| `packages/server/src/index.ts` | re-export `seedHomepageLayout` + `SeedHomepageResult` |
| `layers/base/server/utils/layoutCache.ts` | new (lifted from by-route.get.ts) |
| `layers/base/server/utils/__tests__/layoutCache.test.ts` | new (5 tests) |
| `layers/base/server/api/layouts/by-route.get.ts` | use shared cache util + re-export invalidator |
| `layers/base/server/api/admin/layouts/index.{get,post}.ts` | new |
| `layers/base/server/api/admin/layouts/[id].{get,put,delete}.ts` | new |
| `layers/base/server/api/admin/layouts/[id]/publish.post.ts` | new |
| `layers/base/server/api/admin/layouts/[id]/versions/index.get.ts` | new |
| `layers/base/server/api/admin/layouts/[id]/versions/[versionId]/revert.post.ts` | new |
| `layers/base/server/api/admin/layouts/seed-homepage.post.ts` | new |
| `layers/base/server/api/admin/layouts/__tests__/handlers-contract.test.ts` | new (17 tests) |
| `layers/base/composables/useFeatures.ts` | added `layoutEngine` |
| `layers/base/pages/index.vue` | v-if/v-else-if/v-else 3-way |
| `docs/reference/guides/layout-engine.md` | new — LLM ref (mirrors theme-editor.md format) |
| `docs/sessions/158-phase-1c-sections-and-write-api.md` | this file |

## Commits

| Hash | Subject |
|---|---|
| `c5fa2a1` | feat(layer): Phase 1c starter sections — hero, heading, paragraph, image, content-feed |
| `4890ad2` | feat(server): seedHomepageLayout helper for Phase 1c canary |
| `e3b0c4` | feat(layer): admin layout write API (9 routes) + shared cache util |
| `04608f2` | feat(layer): adopt `<LayoutSlot>` on homepage behind features.layoutEngine |
| (this commit) | docs: layout-engine LLM ref + session 158 log |

(Hashes from `git log --oneline -6`; exact short hashes may shift after the docs commit lands.)

No AI attribution in any commit (per `feedback_no_coauthor`).

## Test counts

| Package | After session 157 | After this session | Delta |
|---|---|---|---|
| `@commonpub/layer` | 117 | **178** | +61 (5 sections × ~5 tests + registry expansion + cache util + handlers-contract) |
| `@commonpub/server` | 1024 | **1031** | +7 (layout-seed integration) |
| Other packages | unchanged | unchanged | — |

Total touched: **1209** (layer + server only). The full repo-wide count is ~3,400+ but those packages weren't touched this session.

vue-tsc strict clean across all 12 packages + apps/reference's `nuxt prepare && vue-tsc --noEmit`. The pre-push hook runs `pnpm typecheck` automatically — second catch this run cycle: literal-narrowing in a test fixture (`as const` + spread) failed vue-tsc strict but passed vitest+esbuild. Pattern locked by `feedback_vue_tsc_strict_vs_vitest`; fixture-level fix here was an explicit `interface ... extends Record<string, unknown>`.

## What's still pending for Phase 1c

From the 158 handoff priority list:

1. ✅ **5 starter sections** — done
2. ⏳ **Real homepage migration script** — deferred. The seed helper bridges the gap so operators can canary today, but converting legacy `homepage.sections` (editorial/contests/hubs/learning/stats/custom-html) needs Phase 6b's section types. Document at `docs/plans/layout-and-pages.md` §4.3.
3. ✅ **`<LayoutSlot>` on homepage** — done, behind v-if (flag default OFF)
4. ⏳ **Publish bundle**: config 0.14.0 → 0.15.0, server 2.56.0 → 2.57.0, layer 0.22.1 → 0.23.0. Deferred until the migration is real, or at least until another session of in-main validation. The Phase 1 + 1c work in main is inert without the flag flip, so no urgency to publish.
5. ⏳ **Per-instance canary**: follows the publish.
6. ✅ **Admin layout write API + cache invalidation** — done (9 routes, contract-tested)

Estimated 2 more sessions to ship Phase 1c fully: one for the real homepage migration (depends on at least `editorial` + `stats` sections being built), one for the publish + canary.

## Audit pass + URL-guard fix (post-merge, same session)

Second-pass review caught one real defect and a few accepted trade-offs:

| Finding | Severity | Disposition |
|---|---|---|
| `hero.cta[].href`, `image.href`, `image.src` accepted ANY string ≤ 2048 chars — no URL scheme validation. Admin-set, all-visitor-rendered → stored XSS via `<a href="javascript:...">` on click | **P0** | **Fixed**. Added Zod regex guards: href allows `http(s)://`, `/relative`, `#hash`, `mailto:`, `tel:`, empty. src allows `http(s)://`, `/relative`, empty. Caught a regex bug along the way (empty alternation `^(?:|alts)` matches anything at position 0); fixed via `^(?:$|alts)` end-anchor in the empty branch. Pinned by 22 new test cases (known-bad scheme corpus + known-good URLs). Memory: [[feedback-regex-empty-alternation]] |
| `seedHomepageLayout` race: two concurrent calls both report `created:true` (only one row exists). Final state correct; return value misleading | P3 | Accepted — admin clicks are rarely concurrent; unique constraint guarantees state correctness |
| Image w/ `aspectRatio=auto` causes CLS on load (no reserved space) | P3 | Accepted — operator can set explicit ratio; future TODO |
| FeatureFlags drift sweep across 5 source-of-truth files (config types + config schema + test-utils mock + identity health test + layer composable) | ✅ clean | No action |

## Production verification (post-deploy)

```
commonpub.io (deployed from main 5b3bfcc):
  /                            : 200 (1.19s)
  /api/health                  : 200
  /api/layouts/by-route?path=/ : 404 (flag off — correct)
  /api/admin/layouts (no auth) : 404 (flag off — correct; admin handlers gate
                                      via requireFeature('layoutEngine') first)
  /api/features                : { admin: true, layoutEngine: false }
  Legacy HTML markers present  : cpub-hero-banner, cpub-content-grid,
                                 cpub-tabs-bar (legacy renderer unchanged)

deveco.io + heatsynclabs.io (still on 0.22.1 npm):
  /                            : 200
  /api/health                  : 200
  /api/layouts/by-route?path=/ : 404 (flag off — correct; endpoint shipped
                                      0.22.0 session 157)
```

All 3 prod sites healthy. Phase 1c code live on commonpub.io but inert.

## Full repo test verification

Per-package test counts (run directly, bypassing turbo build chain):

| Package | Tests |
|---|---|
| schema | 413 |
| config | 23 |
| ui | 256 |
| **server** | **1031** (+7 from 1024 — layout-seed integration) |
| test-utils | 13 |
| auth | 72 |
| infra | 305 (+ 4 skipped) |
| editor | 230 |
| explainer | 191 |
| learning | 101 |
| protocol | 419 |
| docs | 131 |
| **layer** | **180** (+63 from 117 — sections × ~5 + registry expansion + URL guards + cache util + handlers-contract) |

**Total: 3,365 passed + 7 skipped** across 13 packages. All green.

(Local `pnpm test` via turbo failed on apps/{reference,shell} build due to sharp wasm32 fallback on arm64 Mac — environmental, not a regression. CI builds Linux x64 with native sharp and passes.)

## Publish + consumer bumps (same session, post-audit)

After the audit closed clean, decided to publish the bundle and bump
all 3 consumer sites — work is shippable, flag default OFF means zero
consumer behavior change, and carrying the unshipped state forward
adds cognitive cost.

| Package | Old | New | Notes |
|---|---|---|---|
| `@commonpub/config` | 0.14.0 | **0.15.0** | `features.layoutEngine` flag (added session 157, never published) |
| `@commonpub/server` | 2.56.0 | **2.57.0** | Phase 1 layout CRUD (session 157) + `seedHomepageLayout` (session 158) |
| `@commonpub/layer` | 0.22.1 | **0.23.1** | Phase 1c full slice. 0.23.0 was a botched first publish — see below. |

Skipped bumps: `@commonpub/test-utils` had a 1-line change (mock got `layoutEngine: false`) but no consumer outside the workspace depends on it from npm.

**Layer 0.23.0 → 0.23.1 hotfix** mid-publish: 0.23.0's tarball was missing the `sections/` directory because `layers/base/package.json`'s `files` whitelist didn't include it. `LayoutSlot.vue` imports `../sections/registry` — vue-tsc on consumer install failed `TS2307: Cannot find module`. Caught immediately by `deveco-io`'s post-install vue-tsc check; never reached production. Fix: add `"sections"` to the whitelist, republish 0.23.1, `npm deprecate @commonpub/layer@0.23.0`. Tarball verified to contain `sections/registry.ts` + `sections/builtin/*.ts`.

**Consumer pin bumps** (caret semver on 0.x.y doesn't cross minor — per `feedback_caret_semver_0x_minor_bump`, hand-edit package.json):

| Site | Layer pin |
|---|---|
| `commonpub.io` | workspace mode — no pin (auto-deploys from main) |
| `deveco-io` | `^0.22.1` → `^0.23.1` + same for config 0.13.0 → 0.15.0, server 2.55.0 → 2.57.0 |
| `heatsynclabs-io` | `^0.22.1` → `^0.23.1` + same for config + server |

`heatsynclabs-io` has uncommitted operator WIP (`commonpub.config.ts`, `ONBOARDING.md`) — staged only `package.json + pnpm-lock.yaml`; WIP preserved across the bump per memory `feedback_deployment_architecture`.

Vue-tsc on consumer sites: deveco clean. Heatsync has ~10 pre-existing `Element` vs `HTMLElement` DOM-type errors (also present on the pre-bump 0.22.1 install — verified by `git stash` + re-checking) — not regressions; the existing CI workflow tolerates them.

## Post-deploy: deveco.io incident + rollback

Both deveco-io + heatsynclabs-io pushed at the same time. Heatsync deployed cleanly, came up healthy (200, all endpoints behaving correctly with flag off — verified by curl on `/api/health` + `/api/layouts/by-route` + `/api/admin/layouts`).

Deveco's container failed to start. The deploy script (`gh -R devEcoConsultingLLC/deveco-io view`) reported `Deploy Production / success` because the post-deploy health check is `curl -sf http://localhost:3000/ || echo "::warning::..."` — `||` + echo means the curl failure doesn't propagate to exit code, so the SSH action returned 0 and the GH run looked green. Only the workflow's annotations panel showed the warning.

Smoke-checked deveco's URL: `502 Bad Gateway` from the front-end proxy → upstream container is down. Triggered a fresh empty-commit deploy → same outcome. Heatsync on the EXACT same versions (config 0.15.0 / server 2.57.0 / layer 0.23.1) was serving 200 throughout — proved the published code is correct; the failure is deveco-host-specific.

Without SSH access to deveco's host, I can't see container stderr. The deploy workflow's SSH action only captures script stdout. Per `feedback_deploy_health_check_warn_not_fail`, the deploy workflow itself should be fixed: `|| { echo "::error"; exit 1; }` so a crashed container fails the run.

**Rolled back deveco** to pre-Phase-1c pins (config 0.13.0 / server 2.55.0 / layer 0.22.1). Deploy succeeded, health returned to 200. End state for deveco:
- pins: 0.22.1 baseline (matches session 157 + before)
- DB: migration 0005 was already applied during the failed deploy (it ran before the container start failure). The `layout_*` tables exist but go unused with the 0.22.1 layer + `features.layoutEngine: false`. No corruption.

**End-of-session site map**:

| Site | Layer pin | Phase 1c code? | Healthy? |
|---|---|---|---|
| commonpub.io | workspace (main `2b9cab7`) | yes, inert (flag off) | ✓ 200 |
| heatsynclabs.io | `0.23.1` npm | yes, inert (flag off) | ✓ 200 |
| deveco.io | `0.22.1` npm (rolled back) | no | ✓ 200 |

**Diagnostic queue for the operator** (resolve before re-attempting deveco bump):
1. `ssh root@<deveco-host>` + `cd /opt/deveco` + `docker compose logs app --tail=200` — find the actual crash stack trace
2. Compare deveco's `docker-compose.yml` env vars to heatsync's — anything obvious diverging
3. Compare deveco's `/opt/deveco/.env` / secrets to heatsync's
4. Disk space + memory pressure on deveco's host
5. Fix the deploy workflow to fail-on-bad-health (see memory)

After diagnosis: re-bump deveco's pins to `^0.23.1` and redeploy.

## Standing rule reminders

- Schema is the work. Migration count: 6 (unchanged this session).
- No feature without a flag. `features.layoutEngine` gates everything new this session.
- `var(--*)` only. New CSS uses var(--*) exclusively; the registry test now greps for any leak.
- WCAG 2.1 AA min. Each section uses semantic HTML + aria-labelledby; sweep tests assert.
- Sessions logged at `docs/sessions/NNN-*.md`.
- **No Claude attribution** in any git artifact — confirmed.
- Pre-push gauntlet active via simple-git-hooks (session 157). Closed structurally.
