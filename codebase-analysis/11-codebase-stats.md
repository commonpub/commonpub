# 11 — Codebase Stats

As of session 154 (2026-05-26). Numbers are approximate — exact counts vary
with test exclusions.

**Session 154 deltas** (admin theme editor):
- API routes: +6 under `/api/admin/themes`
- Layer pages: +1 (`/admin/theme/edit/:id`)
- Layer components: +8 (`AdminTheme*.vue` family + scenes + overrides panel)
- Composables: +1 (`useThemeAdmin`)
- Server modules: theme.ts grew custom-theme CRUD (saveCustomTheme / list / get / delete)
- Tests: +21 UI (`tokens.test.ts`) + 10 server (`custom-themes.integration.test.ts`) = +31

## Headline

| | |
|---|---|
| Published packages | 12 |
| Shared Nuxt layer | 1 |
| Apps | 2 |
| Tools | 2 |
| Tables | 79 (federated_accounts + oauth_codes added in 0004 migration) |
| Enums | 41 |
| Zod validators | 50+ |
| Server modules | 22+ |
| API routes | 276+ (admin storage backfill + federated/mastodon callback chains since session 128; +6 admin themes routes in session 154) |
| Layer pages | 86+ (admin/theme/edit/[id] added session 154) |
| Layer components | 118+ (8 AdminTheme* components added session 154) |
| Composables | 21+ (useThemeAdmin added session 154) |
| Feature flags | 17 top-level (including `contentImport`, `editorial`) + 5 nested `identity.*` sub-flags |
| Themes | 5 built-in (base, dark, generics, agora, agora-dark) + N DB-stored custom + N code-registered (admin-managed via `/admin/theme`, session 154) |
| Migrations | 5 (0000_session128_baseline → 0004_federated_oauth_tokens) |
| ADRs | 24+ |
| Production instances | 3 (commonpub.io, deveco.io, heatsynclabs.io — all auto-deploy from main) |
| Session log files | 80+ (session numbers run 071–154; bundled where related work landed together) |
| Tests | ~3,230 (session 154: protocol 419 + infra 305 + server 977 + layer 85 + ui 238 + scaffolder cargo 27 + other packages) |

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
