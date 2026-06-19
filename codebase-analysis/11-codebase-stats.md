# 11 — Codebase Stats

> **Counts/versions refreshed session 203 (2026-06-18).**
> The session-by-session delta entries that follow are kept as historical record
> (accurate at the time of each session); for live ground truth always prefer the
> Headline table + `docs/STATUS.md` + `npm view`.
> **Re-measured source counts (session 203; +204 deltas):** 92 tables (+`processed_activities`/
> `digest_runs`, 204) · 46 enums · 118 validators (now split into `validators/<domain>.ts`) ·
> 28 migrations (0000–0027) · 92 pages · 144 components · 35 composables (non-test) ·
> 338 `server/api` files (332 handlers + 6 `__tests__`) · 22 `server/routes` · 26 server
> module dirs · ~330 git-tracked `*.test.ts` (204 added ~40 proving/concurrency tests).
> Current (published): **schema 0.45.0, config 0.22.1, protocol 0.13.0, auth 0.8.0,
> server 2.89.0, ui 0.13.1, theme-studio 0.6.1, layer 0.82.0; create-commonpub 0.5.16
> (crates.io); 28 migrations (0000–0027 — 0026/0027 on commonpub.io only, npm unbumped).**
> Sessions 197–201 (since last refresh): contest large-text/HTML hardening (197); field-drop
> sweep + scheduled publishing + uploads infra + hub-icon federation + terms (199–200);
> RBAC activation (seed + `/admin/roles` UI + `useCan` + per-contest editor role) (201).
> Sessions 192–196 (theme studio arc + advanced tokens + search/nav round): new
> `@commonpub/theme-studio` package; chrome+treatment token registry; glass treatment;
> federated-aware `/api/search`; priority "More" nav; registered-theme light/dark identity +
> `config.defaultTheme`; e2e suite green (schema openapi `process.argv` fix). Session 190 (public-API expansion +
> Stoa theme): flexible per-key CORS (`cors.ts`, `originPatternSchema`/`matchOrigin`),
> privacy-respecting analytics metrics (`read:analytics` scope, `/api/public/v1/metrics/*`,
> `metrics.ts`), time-series rollups (`metrics_daily` 0020 + `metrics-rollup` plugin +
> `publicApiMetricsFederation` flag), Stoa as the new default theme + theme-editor fork
> fix. Session 189 (contest phase A): stage lifecycle (`contest_status` += draft/paused,
> 0017), dynamic stages (`stages`/`current_stage_id`, 0018), cohorts/Top-N cull
> (`contest_entries.stage_state`, 0019), per-round judging. Migrations 0014/0015 =
> mirror requests / registry (session 184–186); 0016 = contests.cover_image_url; 0013 =
> self-ref FKs (183); 0012 = keyset feed indexes (179); 0009–0011 = RBAC/contest (175/177).

Numbers are approximate — exact counts vary with test exclusions.

**Session 169 deltas** (layout editor live + PageFrame consolidation + dnd-kit hotfix — recap, see `docs/sessions/162–169-*.md` for per-session detail):
- Layout editor LIVE on commonpub.io (workspace `main`): Phase 3a shell + 3b drag-drop (`@vue-dnd-kit/core`) + 3c column-resize all shipped; the homepage renders via the layout-engine canary using `<LayoutSlot>`. Editor at `/admin/layouts/:id`, gated by `features.layoutEngine` (default OFF; heatsync + deveco stay dormant).
- **PageFrame consolidation (session 168)**: `components/PageFrame.vue` is now the canonical page frame; full-width = full-bleed (ADR 028). Editor canvas previews render through `<PageFrame>` so the editor is WYSIWYG.
- **dnd-kit provider guard hotfix (session 169)**: `LayoutSection`/`LayoutRow` call `@vue-dnd-kit/core`'s `makeDraggable`/`makeDroppable` ONLY when `editable` — those inject `VueDnDKitProvider` and throw on the provider-less public render path (homepage canary + custom pages). Crashed commonpub.io's homepage (500) on first deploy; now guarded.
- **Stage E unification (session 159)**: section registry's 17 `builtin/*.ts` definitions point `component:` at EXISTING `Block*`/`Homepage*`/`*Section` components via `propMap`; the 16 duplicate `Section*.vue` files from session 158 were deleted (only `SectionCta.vue` + `SectionLearning.vue` remain as genuinely-new renderers).
- **Verified counts AS OF SESSION 169 (historical snapshot — current is 144 components / 35 composables / 338 routes; see Headline above)**: 90 pages, 132 components, 33 composables, ~300 API routes. See `04` + `05` for current breakdowns.
- New feedback memories across 162–169: `feedback-match-established-pattern`, `feedback-nested-aria-button-violation`, `feedback-css-scope-component-extraction`, `feedback-aria-selected-needs-role`, `feedback-jsdom-pointerevent-missing`, `feedback-css-cascade-unit-test-blind-spot`.

**Session 161 deltas** (admin sidebar collapse + schema-package refactor + audit polish + migrate-homepage P1 fix):
- Composables: 20 → **22** (`+useAdminSidebar.ts` ~95 LOC, uses `useCookie`; `+useEditorChrome.ts` ~60 LOC, palette + inspector hide-state for the layout editor — both cookie-persisted)
- Schema package: `+ src/sectionConfigs.ts` (~210 LOC) — 17 per-section Zod schemas + `SECTION_CONFIG_SCHEMAS` lookup map + 3 shared URL regex constants. Re-exported from `src/index.ts`.
- Schema tests: 431 → **470** (+39 — sectionConfigs.test.ts covers SECTION_CONFIG_SCHEMAS surface, URL guards, array bounds, enum walls, defaults)
- Layer tests: 264 → **298** (+34 — useAdminSidebar 16 after the useCookie audit-polish drop, validateSectionConfigs +6 per-section enforcement tests, useLayoutEditor +3 for AbortController coverage, useEditorChrome +9 for palette + inspector hide state)
- Server tests: 1125+3skip → **1126**+3skip (+1 — `layout-migrate-homepage > preserves layout_versions across a force=true migration`)
- 17 × `layers/base/sections/builtin/*.ts` refactored — each imports its schema + type from `@commonpub/schema` instead of defining inline. Drops `import { z } from 'zod'`. Comments updated to point at canonical location.
- `layers/base/server/utils/validateSectionConfigs.ts` — registry parameter removed; uses `SECTION_CONFIG_SCHEMAS` from `@commonpub/schema`. Wired into POST + PUT handlers in `layers/base/server/api/admin/layouts/{index.post,[id].put}.ts` with `cpub.audit.layout.config-rejected` audit logging on failure.
- `packages/server/src/layout/migrate-homepage.ts` — R4 P1 fixed: `force=true` no longer calls `deleteLayout` (which cascaded through `layout_versions`); instead passes `existing.id` to `saveLayout` for an in-place update. Publish snapshots are preserved across force migrations.
- CSS tokens: `+ --sidebar-width-collapsed: 3.5rem` in `packages/ui/theme/base.css` (canonical) — `layers/base/theme/base.css` synced via `bundle-theme.mjs` (gitignored copy).
- Nitro build verified locally (`pnpm --filter @commonpub/reference build` succeeds, no `.vue`-into-server-bundle errors that broke the R2 attempt).
- Typecheck: 26/26 fresh (--force, no cache).
- 0 npm publishes (workspace-only; commonpub.io serves from `main`; heatsync + deveco stay on layer 0.24.0 dormant per standing direction).

**Session 160 deltas** (Phase 3a editor shell + 4 audit rounds — recap, see `docs/sessions/160-*.md` for details):
- Layer tests: 196 → 264 (+68 across phase 3a + 4 audit rounds)
- Schema tests: +9 (ogImage scheme refine + array `.max()` bounds)
- Server tests: 1125 (unchanged; R4 `inArray` fix exercised by existing coverage)

**Session 158 deltas** (Phase 1c sections + admin write API + homepage adoption + post-publish fixes):
- Layer sections: registry expanded 1 → 6 (`hero`, `heading`, `paragraph`, `image`, `content-feed` added; `divider` already there). Each is 3 files (Zod + Vue + register call).
- Layer components: +5 `Section{Hero,Heading,Paragraph,Image,ContentFeed}.vue`
- API routes: +9 under `/api/admin/layouts/*` (CRUD + publish + versions + revert + seed-homepage); 0 user-facing changes (all flag-gated)
- Server modules: +1 `layout/seed.ts` (`seedHomepageLayout`)
- Server utils (layer): +1 `server/utils/layoutCache.ts` (lifted from inline by-route.get.ts; shared between public reader + admin invalidators)
- Composable: `useFeatures` gained `layoutEngine` (was missed in session 157's config-side flag addition)
- Tests: +61 layer (5 sections × ~5 + registry expansion + cache util 5 + handlers-contract 17), +7 server (layout-seed integration)
- Docs: +1 LLM ref (`docs/reference/guides/layout-engine.md`)
- Homepage `pages/index.vue`: 3-way v-if/v-else-if/v-else (LayoutSlot zones / configurable / legacy); default behavior unchanged because the flag defaults OFF
- **Post-publish fixes in 0.23.2 + 0.23.3** (user-reported):
  - **0.23.2**: admin feature-flag UI override sticks (dedup loop bug — compared against effective config, deleted matching overrides → flags reverted on re-save). Avatar `<img>` no longer squished — `.cpub-av` class shared between img + div had `display: flex` which silently dropped `object-fit: cover` on the img variant.
  - **0.23.3**: homepage no-blank — pages/index.vue checks `useLayout('/')` is non-null in addition to the flag, falls through to legacy renderer if no DB layout exists. Prevents "operator flips flag → blank page" trap.
- **Published npm**: config 0.15.0, server 2.57.0, layer 0.23.3 (0.23.0 deprecated — missing sections/; 0.23.1 hotfix; 0.23.2 user-fixes; 0.23.3 homepage no-blank).
- **Consumer state**: commonpub.io workspace + main (always latest); heatsynclabs.io npm 0.23.3 (uses npm install, complete schema install); deveco.io npm 0.22.1 ROLLED BACK pending pnpm install bug fix (workaround in flight = bump direct schema pin to ^0.17.0 + regen lockfile).
- **3 new feedback memories**: `feedback-regex-empty-alternation`, `feedback-deploy-health-check-warn-not-fail`, `feedback-display-flex-on-img`, `feedback-pnpm-install-drops-files`.

**Session 154 deltas** (admin theme editor):
- API routes: +6 under `/api/admin/themes`
- Layer pages: +1 (`/admin/theme/edit/:id`)
- Layer components: +8 (`AdminTheme*.vue` family + scenes + overrides panel)
- Composables: +1 (`useThemeAdmin`)
- Server modules: theme.ts grew custom-theme CRUD (saveCustomTheme / list / get / delete)
- Tests: +21 UI (`tokens.test.ts`) + 10 server (`custom-themes.integration.test.ts`) = +31

**Session 155 deltas** (Phase 1 schema foundation):
- New tables: layouts, layout_rows, layout_sections, layout_versions (migration 0005 → count 5→6)
- Schema validators: layoutScopeSchema + layoutSchema + layoutCreateSchema + 6 nested
- `@commonpub/ui` split: theme.ts + tokens.ts; SectionRegistry types
- Tests: +21 schema (layout-validators) + 18 ui (sections) + 14 server (homepage) + 15 server (navigation) + 10 layer (HomepageSectionRenderer expansion) = +78

**Session 156 deltas** (theme editor SHIPPED):
- 5 packages published: schema 0.17.0, config 0.14.0, ui 0.9.0, server 2.56.0, layer 0.22.0
- All 3 consumer sites (commonpub.io, deveco.io, heatsynclabs.io) updated + deployed
- Apps/reference Playwright e2e: +14 (`theme.spec.ts`)

**Session 157 deltas** (theme hotfix 0.22.1 + Phase 1 server/consumer):
- Theme editor hotfix 0.22.1 published + deployed all 3 (light/dark toggle, applyAndSave race, discovery banner gate)
- `@commonpub/server`: +1 module (`layout/layout.ts`, 520 LOC) — full CRUD with `db.transaction()` wrap
- `@commonpub/config`: `features.layoutEngine` flag added (default OFF; not yet bumped to 0.15.0)
- Layer API: +1 endpoint (`/api/layouts/by-route`, flag-gated, 60s cache)
- Layer composable: +1 (`useLayout` — reactive-aware, accepts string|Ref|getter)
- Layer component: +1 (`<LayoutSlot>` — 12-col responsive grid, visibility filters, previewOverride for editor integration)
- Tests: +21 server (layout-server.integration) + 16 layer (AdminThemePreviewPane regression) = +37
- Tooling: `simple-git-hooks` pre-push hook running `pnpm typecheck` (closes the vue-tsc-vs-vitest pattern that bit 3 times)
- 6 audit findings fixed + 3 deferred to Phase 2/1c with documented TODOs

## Headline

| | |
|---|---|
| TS packages | 13 (12 published to npm + `theme-studio`, session 192, not yet published) |
| Shared Nuxt layer | 1 |
| Apps | 2 |
| Tools | 2 |
| Tables | 90 (`grep -c pgTable`; `metrics_daily` in 0020; `mirror_requests` 0014; `registry_instances` 0015; rbac roles/role_permissions/user_roles in 0009; layout* in 0005; federated_accounts + oauth_codes are in baseline 0000, with OAuth token columns added in 0004) |
| Enums | 46 (`grep -c pgEnum`) |
| Zod validators | 118 `*Schema` exports in `validators.ts` (1254 LOC) |
| Server modules | 26 module dirs + 11 top-level utility files |
| API routes | 338 files under `server/api/` (332 handlers + 6 `__tests__/` files) + 22 ActivityPub/site files under `server/routes/` |
| Layer pages | 92 |
| Layer components | 144 |
| Composables | 35 (non-test) + 13 `__tests__/` files |
| Feature flags | 24 boolean top-level (+ `contestStageSubmissions` session 194, `themeStudio`, `publicApi`, `publicApiMetricsFederation`, `actAsRegistry`, `announceToRegistry`, `layoutEngine`, `rbac`) + 5 nested `identity.*` + `auth.*` sub-flags |
| Themes | 7 built-in (base, dark, generics, agora, agora-dark, stoa, stoa-dark — stoa is the default) + N DB-stored custom + N code-registered (admin-managed via `/admin/theme`, session 154) |
| Migrations | 28 (0000_session128_baseline → 0027_audit204_indexes_dedup; 0026/0027 = `remote_like_count` + hot-read indexes + `processed_activities`/`digest_runs` (204, commonpub.io only), 0025 = `contest_stakeholders.role` + RBAC seed, 0024 = scheduled publishing, 0020 = `metrics_daily`, 0017–0019 = contest stages, 0012 = composite feed indexes, 0009 = RBAC) |
| ADRs | 26 (through 028) |
| Production instances | 3 (commonpub.io, deveco.io, heatsynclabs.io — all auto-deploy from main) |
| Tests | **304** git-tracked `*.test.ts` files (`git ls-files '*.test.ts'`). [An earlier "275" double-counted `.stryker-tmp/` sandbox copies via `find`; use `git ls-files`.] |
| Pre-push git hook | `pnpm typecheck` via simple-git-hooks (installed session 157; closes vue-tsc-vs-vitest regression pattern that hit 3 times in 2 sessions) |

## Per-package sizes (rough)

From package versions and file counts:

| Package | Version | Notes |
|---|---|---|
| schema | **0.45.0** | 24 src files incl. `rbac.ts`, `publicApi.ts`, `permissions.ts`, `layout.ts`, `sectionConfigs.ts`, `metrics.ts`, `openapi.ts`; 90 tables / 46 enums / 118 validators (1254 LOC) |
| server | **2.89.0** | 26 module dirs + 11 top-level files; `rbac/` (resolver + admin + seed), `publicApi/` (metrics, cors, rollup), contest stage engine + per-stage artifacts, scheduled-publish, keyset cursor helpers (`query.ts`) |
| config | **0.22.1** | 4 TS (types, schema, config, index); 24 boolean flags + `identity` + `auth` objects + `RegisteredTheme` |
| layer | **0.82.0** | the distribution unit; RBAC `/admin/roles` UI + `useCan`; image cropper; scheduled-publish UI; Theme Studio + advanced/glass tokens; public-API metrics routes; keyset feed; NavRenderer |
| ui | **0.13.1** | 22 Vue components + theme CSS (incl. Stoa) + `tokens.ts` (TOKEN_SPECS chrome/treatment) + `sections.ts` (SectionRegistry, types-only) + `BUILT_IN_THEMES` (7) |
| protocol | 0.13.0 | pure-TS AP; ssrf.ts `safeFetchResponse`/`safeFetchSigned`; registry/discovery types |
| editor | 0.7.12 | 20 block types (18 extension files); `editorKit.ts` engine entry + top-level `vue/` surface (`@commonpub/editor/vue`: EditorShell + 20 block components + `useBlockEditor`) |
| explainer | 0.7.15 | src/ (pure TS) + top-level `vue/` (renderers + 4 theme CSS presets) + `modules/` (interactive module runtime, 10 module types) |
| learning | 0.5.2 | curriculum + progress + quiz + certificate |
| docs | 0.6.3 | remark/rehype pipeline + search adapter |
| auth | 0.8.0 | Better Auth wrapper + `sso.ts` + `permissions.ts` (RBAC) + `identity.ts` |
| infra | 0.8.0 | storage/image/email/security/clientIp/tokenCrypto + `redis/` + `realtime/` |
| test-utils | 0.5.6 | auth/session/federated/oauth factories + `createTestConfig` |

## Database

- **90 tables** across ~17 domains
- **46 enums**
- **130 FK references** (`.references(...)`): 107 `ON DELETE CASCADE`, 23 `SET NULL`, 0 `RESTRICT` (all explicit)
- Counters denormalized on ~15 tables
- 5 soft-delete tables (users, contentItems, hubs, federatedContent, federatedHubPosts)
- All unique constraints and indexes documented in `02-schema-inventory.md`

## Recent session churn

| Sessions | Topics |
|---|---|
| 108–110 | URL restructure, federation seamless, UX fixes |
| 111–115 | Editor decoupling, federation, comment threading |
| 116 | Article ↔ Blog merge |
| 117 | Contest system complete |
| 118 | Password reset, docs polish, admin reports, video social, nav badges |
| 119 | Security hardening, sanitizer, group chat read receipts, signed backfill |
| 120 | Test audit (−71/+49), architecture fixes, a11y, loading states |
| 121 | OAuth federation fix (3 bugs), sign-in fix, validation, deveco Dockerfile |
| 122 | Deep audit + v1.0 completion (16 tasks), hub resources/products, a11y, contest notifications |
| 123 | Destination phase 0+1+4+2 |
| 124 | Destination phase 3/5/6/7 — nav, events, voting, judges |
| 125 | Events UI, contest voting, theme fix |
| 126 | Doc overhaul + scaling plan + typecheck fixes |
| 127 | Public Read API v1 + 8 bug fixes (drafts-leak + stored-XSS) |
| 128 | Docs unblock + drizzle-kit push → committed migrations |
| 135 | Audit-fix: safeFetch/safeFetchBinary added (since server 2.48.0) |
| 136–140 | Cross-instance identity foundation + runtime + Mastodon login UI |
| 141–142 | CLI scaffolder version-drift fix + admin DO deploy + import lazy-loaded images |
| 143 | Mobile-nav pathPrefix regression + extreme audit |
| 144 | Mobile UX fixes |
| 145–148 | Three audit-fix passes + federation-hardening Stage 1+2 (SSRF consolidation) |
| 149 | DO Spaces CDN + safeFetch P0 hotfix + Stage 3 Items 6+7 (raw-body digest + strict sig coverage) |
| 150 | Stage 3 Items 4+8+9 wrap: federation outbound through SSRF-safe path, Better Auth signed-cookie helper, `getClientIp` (rightmost XFF). Plan fully cleared. |

## Schema growth (session 124 adds)

- 7 new tables:
  - `events`, `eventAttendees` (events.ts)
  - `hubPostVotes`, `pollOptions`, `pollVotes`, `contestEntryVotes` (voting.ts)
  - `contestJudges` (contest.ts — replaces legacy `contests.judges` JSONB array, which is still kept for backwards-compat)
- 6 new enums: judgeRoleEnum, judgingVisibilityEnum, voteDirectionEnum, eventStatusEnum, eventTypeEnum, eventAttendeeStatusEnum
- 3 new columns: `voteScore` on hubPosts (denormalized up-down), `communityVotingEnabled` on contests (default false), `judgingVisibility` on contests (default `'judges-only'`)
- `notificationTypeEnum` gained `event`

## Docs coverage

- 8 top-level docs (`README`, `STATUS`, `building-with-commonpub`, `coding-standards`, `deployment`, `federation`, `public-api`, `quickstart`) + `docs/llm/` pack (facts/gotchas/conventions/recipes)
- 6 reference guides (`docs/reference/guides/`: contests, hooks, layout-engine, theme-editor, theming, url-structure) + 14 plans (`docs/plans/`)
- 26 ADRs (through 028)
- 161 session log files (numbered through 190 — some are kickoff/handoff variants)
- See `10-doc-audit.md` for the full freshness map (the old per-module `reference/server/` + `reference/packages/` dirs were removed)

## Test coverage

- **290 git-tracked `*.test.ts` files** (server 91, layer 50, ui 27, protocol 27, editor 24, infra 11, docs 11, explainer 9, apps/reference 9, theme-studio 6, schema 7, auth 7, learning 5, deploy 3, config 1, test-utils 1, tools/worker 1)
- A few PGlite-skipped integration tests (partial-index limitations)
- Stryker mutation testing configured per-package (`pnpm stryker:<pkg>`)
- (Exact assertion counts vary with test exclusions; run `pnpm test` for the live total.)
