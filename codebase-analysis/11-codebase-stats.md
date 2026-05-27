# 11 — Codebase Stats

As of session 158 (2026-05-26 — same calendar day as 154/155/156/157).
Numbers are approximate — exact counts vary with test exclusions.

**Session 158 deltas** (Phase 1c sections + admin write API + homepage adoption):
- Layer sections: registry expanded 1 → 6 (`hero`, `heading`, `paragraph`, `image`, `content-feed` added; `divider` already there). Each is 3 files (Zod + Vue + register call).
- Layer components: +5 `Section{Hero,Heading,Paragraph,Image,ContentFeed}.vue`
- API routes: +9 under `/api/admin/layouts/*` (CRUD + publish + versions + revert + seed-homepage); 0 user-facing changes (all flag-gated)
- Server modules: +1 `layout/seed.ts` (`seedHomepageLayout`)
- Server utils (layer): +1 `server/utils/layoutCache.ts` (lifted from inline by-route.get.ts; shared between public reader + admin invalidators)
- Composable: `useFeatures` gained `layoutEngine` (was missed in session 157's config-side flag addition)
- Tests: +61 layer (5 sections × ~5 + registry expansion + cache util 5 + handlers-contract 17), +7 server (layout-seed integration)
- Docs: +1 LLM ref (`docs/reference/guides/layout-engine.md`)
- Homepage `pages/index.vue`: 3-way v-if/v-else-if/v-else (LayoutSlot zones / configurable / legacy); default behavior unchanged because the flag defaults OFF

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
| API routes | 286+ (+9 admin layout routes session 158 under `/api/admin/layouts/*` — all flag-gated; +1 `/api/layouts/by-route` session 157) |
| Layer pages | 86+ (admin/theme/edit/[id] added session 154) |
| Layer components | 124+ (8 AdminTheme* in 154; 1 LayoutSlot in 157; 5 Section* in 158) |
| Composables | 22+ (useThemeAdmin in 154; useLayout in 157) |
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
