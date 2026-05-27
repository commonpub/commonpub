# Session 159 — Phase 1c canary live on commonpub.io

**Date**: 2026-05-27
**Branch**: main
**Status**: 🟢 **Canary green.** commonpub.io homepage now renders via `<LayoutSlot>` — 7 sections (hero full-width + editorial/content-feed/editorial in main zone + contests/hubs/stats in sidebar zone) sourced from the `layouts` table. Legacy renderer unchanged on heatsync + deveco (still serving via `instance_settings.homepage.sections`).

## The arc

What started as "deferred canary, build the 6 missing sections" (per the earlier session 159 audit) turned into a full end-to-end ship that surfaced + fixed 5 layered infrastructure bugs along the way. Final commit sequence:

| # | Hash | Subject |
|---|---|---|
| 1 | `8fca427` | feat(layer): Phase 1c catalog completion — 6 new sections |
| 2 | `dee1a39` | docs: layout-engine guide + session log (1) |
| 3 | `aceeb30` | fix(layer): audit follow-ups (lazy fetch, featureGate, img cover) |
| 4 | `02ec48f` | feat(server,layer): legacy homepage migration |
| 5 | `1cdb0f2` | build(docker): expose @commonpub/{server,schema} to /app/scripts |
| 6 | `f7e249b` | build(docker): unlink dangling @commonpub symlinks before COPY |
| 7 | `ecda631` | build(docker): COPY after npm install (avoid prune) |
| 8 | `c6f2047` | build(server): add ./layout/* subpath export |
| 9 | `58fd31e` | fix(ssr): hydrate Vue feature flags from DB overrides at SSR time |
| 10 | `b755108` | fix(nuxt): declare all FeatureFlags keys in runtimeConfig |
| 11 | `ce3b5b8` | fix(layer): useLayout passes reactive query — was `path=undefined` |
| 12 | (next) | refactor(layer): move feature-flags-prime plugin into layer + session log |

## End-to-end chain that had to work

Every link below had to be intact for SSR-time LayoutSlot rendering. Each broken link gave a different (but plausible-looking) failure that masked the next.

| # | Layer | Required state |
|---|---|---|
| 1 | Migration function | `migrateHomepageSectionsToLayout(db)` reads legacy JSON, writes `layouts` row, idempotent. 16 PGlite tests cover full path. |
| 2 | Script in container | `/app/scripts/migrate-homepage-layout.mjs` present (Dockerfile only copies `/scripts/`, not `apps/reference/scripts/`). |
| 3 | `@commonpub/server` resolvable | `/app/node_modules/@commonpub/server/dist/...` real dir, not the dangling pnpm symlink. |
| 4 | Clean import chain | `import from '@commonpub/server/layout/migrate-homepage'` (subpath export) — bypasses server's index.js which pulls @commonpub/infra/auth/protocol that aren't in runtime. |
| 5 | Migration runs | `node /app/scripts/migrate-homepage-layout.mjs` → "sections converted: 7", layout id created. |
| 6 | `/api/layouts/by-route?path=/` | 200 with full JSON (layoutCache populates on first call). |
| 7 | `useRuntimeConfig().public.features.layoutEngine` at SSR | `true` — needs the key declared in `layers/base/nuxt.config.ts` runtimeConfig so env-var override (`NUXT_PUBLIC_FEATURES_LAYOUT_ENGINE=true` on the container) propagates. |
| 8 | `useState('feature-flags').value.layoutEngine` at SSR | `true` — `getInitialFlags()` reads from runtime config OR from the new Nitro plugin's `event.context.cpubFeatureFlags`. |
| 9 | `useLayout('/').layout.value` at SSR | NOT null — the composable's `useFetch` must build the URL `?path=/`, not `?path=undefined`. Bug: passing a function value in `query` got serialised as undefined. |
| 10 | `pages/index.vue` v-if branch | `layoutEngineActive = flag && layout !== null` — both true → LayoutSlot zones render. |

Once #9 was fixed, #10 just worked. Every prior fix was load-bearing.

## What's shipped (post-canary)

**Phase 1c is complete on commonpub.io** as of commit `ce3b5b8`. The homepage now:

- Renders via `<LayoutSlot>` for 3 zones (full-width / main / sidebar)
- Hero ("Hero Banner") + editorial ("Staff Picks") + content-feed ("Content Feed") + editorial ("New Section") + contests + hubs + stats
- Same 7 sections as the legacy renderer; visually identical at first glance (some inner-render details differ — new sections use the cleaner `cpub-section-*` class scheme + `var(--*)` tokens exclusively)
- Feature-gate visibility wired: contests/hubs/learning sections hide if the corresponding flag flips off (LayoutSlot honours `section.visibility.features`)

**Rollback paths** (in increasing order of disruption):
1. `DELETE FROM layouts WHERE scope_type='route' AND scope_key='/'` — auto-fallback to legacy in <60s via the 0.23.3 safety net
2. Flip `features.layoutEngine: false` (admin UI override) — legacy serves immediately
3. Revert commits + push — full redeploy (~7 min) restores pre-Phase-1c state

## What's NOT yet rolled out

- **heatsync** and **deveco** are still on `@commonpub/layer@0.23.3` with `features.layoutEngine: false`. Their homepages render via the legacy `homepage.sections` path, unchanged.
- The plugin `layers/base/server/plugins/feature-flags-prime.ts` was added in this session — heatsync/deveco will inherit it on their next dependency bump.
- The `useLayout` query fix + `useFeatures` SSR-context read are in the layer; need to be published before heatsync/deveco get them.
- Dockerfile fixes (`@commonpub/*` exposure + COPY ordering) are specific to commonpub.io. heatsync uses `npm install` and has a different runtime layout — the @commonpub/* resolution issue may not apply there. **Verify before any rollout.**

## Migration script for operators

```bash
# Inside the app container (commonpub-app-1 / heatsync-app / deveco-app):
node /app/scripts/migrate-homepage-layout.mjs
# Idempotent — skip if a layout already exists
# Pass --force to delete-and-recreate
```

Or via the admin endpoint (gates on admin + layoutEngine flag):

```bash
curl -X POST \
  -H "Cookie: better-auth.session_token=..." \
  -d '{"force": false}' \
  https://commonpub.io/api/admin/layouts/migrate-homepage
```

Documented at `docs/reference/guides/layout-engine.md` (TODO: update with the migration path; current doc only covers seed-homepage).

## Test counts

| Package | Session 158 end | Session 159 end | Δ |
|---|---|---|---|
| @commonpub/server | 1031 (+3 skipped) | **1047** (+3 skipped) | +16 (migration tests) |
| @commonpub/layer | 178 | **233** | +55 (6 sections × ~7 tests + registry adds + img regression + cache test) |
| Other packages | unchanged | unchanged | — |

**Repo-wide**: 3,516 passed + 7 skipped across all packages. vue-tsc strict clean across 26 typecheck tasks.

## Files

### New in this session

| File | Type | Purpose |
|---|---|---|
| `packages/server/src/layout/migrate-homepage.ts` | new | Migration function |
| `packages/server/src/__tests__/layout-migrate-homepage.integration.test.ts` | new | 16 PGlite tests |
| `layers/base/server/api/admin/layouts/migrate-homepage.post.ts` | new | Admin endpoint |
| `layers/base/server/plugins/feature-flags-prime.ts` | new | Nitro plugin — primes DB-merged flags at SSR |
| `layers/base/sections/builtin/{editorial,stats,hubs,contests,learning,custom-html}.ts` | new (×6) | 6 starter sections |
| `layers/base/components/sections/Section{Editorial,Stats,Hubs,Contests,Learning,CustomHtml}.vue` | new (×6) | 6 renderers |
| `layers/base/components/sections/__tests__/Section{…}.test.ts` | new (×6) | Per-section render tests |
| `scripts/migrate-homepage-layout.mjs` | new | Operator CLI |
| `docs/sessions/159-canary-shipped.md` | this file | |

### Modified

| File | Change |
|---|---|
| `Dockerfile` | Expose @commonpub/{schema,server} to /app/scripts/ — 3 commits of iteration on COPY ordering + symlink handling |
| `packages/server/package.json` | Added `./layout/*` subpath export |
| `packages/server/src/index.ts` | Re-export migrateHomepageSectionsToLayout |
| `layers/base/sections/registry.ts` | Register 6 new sections |
| `layers/base/sections/__tests__/registry.test.ts` | +6 per-section assertions |
| `layers/base/composables/useFeatures.ts` | Read from `event.context.cpubFeatureFlags` on SSR |
| `layers/base/composables/useLayout.ts` | Pass `computed(() => ({path}))` instead of bare function value (path=undefined bug) |
| `layers/base/nuxt.config.ts` | Declare every FeatureFlags key in runtimeConfig.public.features |
| `layers/base/components/sections/SectionLearning.vue` | `<img>` cover instead of background-image div (CSS-injection defence) |
| `layers/base/server/api/admin/layouts/__tests__/handlers-contract.test.ts` | Count bump 9→10 + 6→7 for new endpoint |

### Audit follow-ups (commit aceeb30)

| Change | Why |
|---|---|
| `lazy: true` on SectionHubs/Stats/Contests useFetch | Sidebar widgets shouldn't block SSR |
| `featureGate: 'hubs'/'contests'/'learning'` on section definitions | Admin palette gate (runtime gating is via visibility.features which LayoutSlot honours) |
| `SectionLearning.vue` background-image div → `<img>` + alt + regression-guard test | CSS-injection defence in depth + better a11y |

## End-state on prod

| Site | Layer | Phase 1c rendering | Homepage source | Health |
|---|---|---|---|---|
| commonpub.io | workspace `main` (commits through ce3b5b8) | **YES** — LayoutSlot | `layouts` table (1 row, 7 sections) | ✓ 200 |
| heatsynclabs.io | npm `@commonpub/layer@0.23.3` | No — flag off | legacy `homepage.sections` JSON | ✓ 200 |
| deveco.io | npm `@commonpub/layer@0.23.3` | No — flag off | legacy `homepage.sections` JSON | ✓ 200 |

Migration 0005 status:
- commonpub.io: ✓ applied
- heatsync: not yet applied
- deveco: ✓ applied (during session 158's failed deploy; tables unused with flag off)

Container env on commonpub.io now has `NUXT_PUBLIC_FEATURES_LAYOUT_ENGINE=true`. Removing it would restore the build-time default (`false`), and the page would fall back to legacy (layoutEngineActive = false ∧ no layout activation).

## Standing rule reminders

- **No AI attribution** in any git artifact — confirmed across all commits this session.
- **Schema is the work** — no schema changes this session (still 6 migrations).
- **Feature flag** gates everything: layoutEngine + visibility.features per section.
- **`var(--*)` only** — every new section component uses tokens exclusively.
- **WCAG 2.1 AA** — semantic HTML + aria-labelledby on every section.
- **Sessions logged** — this file + the earlier 159-phase-1c-section-completion.md cover the full session.
- **Pre-push gauntlet** — `pnpm typecheck` ran on every push; closed all CI surprises before they hit deploy.

## Next session priorities

1. **Publish bundle**: bump `@commonpub/layer` (0.23.3 → 0.24.0 for the section additions + migration endpoint) + `@commonpub/server` (2.57.0 → 2.58.0 for migrateHomepageSectionsToLayout + subpath export). `@commonpub/config` doesn't change.
2. **heatsync rollout** — has the npm-install Dockerfile so the runtime container probably already has @commonpub/server resolvable. Verify, bump pin, deploy, run migration. The feature-flags-prime plugin (now in layer) ships with the bump.
3. **deveco rollout** — schema pin caveat from session 158 still applies. Bump `@commonpub/schema` direct pin first, regen lockfile, then bump layer + server.
4. **Update layout-engine.md** with the migration script + admin endpoint documentation.
5. **Phase 6b sections** — gallery, video, embed, spacer, cta, content-card, contest-list, hub-list, event-list, member-list, stats-grid (different from `stats`), contact-form, newsletter, announcement, markdown, iframe — multiple sessions.
6. **Phase 3 — admin UI for layouts** (visual canvas with drag/drop/resize). Big lift.
