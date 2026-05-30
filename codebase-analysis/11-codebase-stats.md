# 11 — Codebase Stats

As of session 169 (2026-05-30 — layout engine Phase 3a/3c live on commonpub.io). Sessions 159 + 160 stats are folded into the session-by-session entries below.
Numbers are approximate — exact counts vary with test exclusions.

**Session 169 deltas** (layout editor live + PageFrame consolidation + dnd-kit hotfix — recap, see `docs/sessions/162–169-*.md` for per-session detail):
- Layout editor LIVE on commonpub.io (workspace `main`): Phase 3a shell + 3b drag-drop (`@vue-dnd-kit/core`) + 3c column-resize all shipped; the homepage renders via the layout-engine canary using `<LayoutSlot>`. Editor at `/admin/layouts/:id`, gated by `features.layoutEngine` (default OFF; heatsync + deveco stay dormant).
- **PageFrame consolidation (session 168)**: `components/PageFrame.vue` is now the canonical page frame; full-width = full-bleed (ADR 028). Editor canvas previews render through `<PageFrame>` so the editor is WYSIWYG.
- **dnd-kit provider guard hotfix (session 169)**: `LayoutSection`/`LayoutRow` call `@vue-dnd-kit/core`'s `makeDraggable`/`makeDroppable` ONLY when `editable` — those inject `VueDnDKitProvider` and throw on the provider-less public render path (homepage canary + custom pages). Crashed commonpub.io's homepage (500) on first deploy; now guarded.
- **Stage E unification (session 159)**: section registry's 17 `builtin/*.ts` definitions point `component:` at EXISTING `Block*`/`Homepage*`/`*Section` components via `propMap`; the 16 duplicate `Section*.vue` files from session 158 were deleted (only `SectionCta.vue` + `SectionLearning.vue` remain as genuinely-new renderers).
- **Verified counts (`git ls-files` tracked source, test files excluded)**: 90 pages, 132 components, 33 composables, ~300 API routes (`/api/admin/layouts/*` = 10 + `/api/layouts/by-route`). See `04` + `05` for breakdowns.
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
| Published packages | 12 |
| Shared Nuxt layer | 1 |
| Apps | 2 |
| Tools | 2 |
| Tables | 83 (federated_accounts + oauth_codes added in 0004; layouts/layout_rows/layout_sections/layout_versions added in 0005, session 155) |
| Enums | 41 |
| Zod validators | 60+ (layout engine added 10 in session 155) |
| Server modules | 23+ (layout/ added session 157; layout/seed.ts added session 158) |
| API routes | 301 (session 169 spot-count; +10 admin layout routes under `/api/admin/layouts/*` + `/api/layouts/by-route` — all flag-gated) |
| Layer pages | 90 (session 169 spot-count; admin/theme/edit/[id] in 154; admin/layouts editor + [...customPath] catch-all in 159–160) |
| Layer components | 132 (session 169 spot-count; 8 AdminTheme* in 154; LayoutSlot/Row/Section + PageFrame; admin/layouts editor family 160–169) |
| Composables | 33 (session 169 spot-count; useThemeAdmin in 154; useLayout/useLayoutEditor/History/Resize/Drag/Hotkeys/Announcer/AutoSave + useEditorChrome + useAdminSidebar + autoFormSchema) |
| Feature flags | 18 top-level (added `layoutEngine` in session 157) + 5 nested `identity.*` sub-flags |
| Themes | 5 built-in (base, dark, generics, agora, agora-dark) + N DB-stored custom + N code-registered (admin-managed via `/admin/theme`, session 154) |
| Migrations | 6 (0000_session128_baseline → 0005_wonderful_blue_marvel — layout engine, session 155+157 — drizzle-kit generated to keep journal in sync) |
| ADRs | 24+ |
| Production instances | 3 (commonpub.io, deveco.io, heatsynclabs.io — all auto-deploy from main) |
| Session log files | 80+ (session numbers run 071–157; bundled where related work landed together) |
| Tests | ~3,400+ (session 158: layer 178 + server 1031 in touched packages; full repo wider) |
| Pre-push git hook | `pnpm typecheck` via simple-git-hooks (installed session 157; closes vue-tsc-vs-vitest regression pattern that hit 3 times in 2 sessions) |

## Per-package sizes (rough)

From package versions and file counts:

| Package | Version | Src files (est.) |
|---|---|---|
| schema | **0.17.0** (session 156) | 18 TS files (added `layout.ts` for layout engine tables) + layout validators bundled in `validators.ts` |
| server | **2.56.0** (session 156) | 90+ TS files; theme.ts now has custom-theme CRUD (`listCustomThemes`/`saveCustomTheme`/etc) + the existing federation/identity surface |
| config | **0.14.0** (session 156) | 4 TS (types, schema, config, index); optional `themes: RegisteredTheme[]` field added 0.14.0 |
| layer | **0.22.0** (session 156) | 248+ files; admin theme editor (8 AdminTheme* components + theme editor pages + useThemeAdmin composable + utils/themeIds.ts + utils/themeDiscovery.ts + utils/themeIO.ts + types/theme.ts) added 0.22.0 |
| ui | **0.9.0** (session 156) | 25 Vue components + theme CSS + `tokens.ts` (split from theme.ts in 0.9.0) + `sections.ts` (SectionRegistry for layout engine, types-only) + zod peerDep added |
| protocol | 0.12.0 | 15 TS files; ssrf.ts adds `safeFetchResponse`+`safeFetchSigned` as of 0.12.0 |
| editor | 0.7.10 | ~35 TS files in src/ (blocks + extensions + serialization + vue wrapper) |
| explainer | 0.7.15 | ~12 TS files in src/ + ~11 in vue/ (Vue renderers + 4 theme CSS presets) |
| learning | 0.5.2 | 6 TS files |
| docs | 0.6.3 | 15+ TS files |
| auth | 0.6.0 | 8 TS files (adds identity types in 0.6.0) |
| infra | 0.8.0 | 7 TS files (adds `clientIp.ts` in 0.8.0; `tokenCrypto.ts` in 0.7.0; `redis/` + `realtime/` since 0.6.0) |
| test-utils | 0.5.6 | 3 TS files |

## Database

- **79 tables** across 15 domains (api_keys + api_key_usage added in session 127)
- **41 enums**
- **112 FKs** (99 on-delete CASCADE, 13 SET NULL, 0 RESTRICT/NO ACTION)
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

- 45 reference files (packages + server + guides)
- 24+ ADRs
- 48 session log files (numbered up to 125 — some sessions bundled)
- 25% estimated stale (see `10-doc-audit.md`)
- ~10 critical missing docs for recently-added features

## Test coverage

- ~2,852 tests across 12 packages (session 121 log on 2026-04-14); 1,939 at v0.2.0 baseline
- 30/30 tests passing in recent session verification
- 865 tests in focused subsets
- 3 PGlite-skipped integration tests
- Stryker mutation: 72% score for sanitizer, per-package targets available
