# LLM Facts — CommonPub Architecture

Condensed, high-signal. Load this before touching code.

## Repo identity

- Name: CommonPub — open ActivityPub federation protocol and package suite for self-hosted maker communities.
- License: AGPL-3.0-or-later.
- Language: TypeScript strict. Vue 3 Composition API. Zod. Drizzle. Nuxt 3.
- Repo root: `/Users/obsidian/Projects/ossuary-projects/commonpub/`.

## Topology

```
apps/{reference, shell}  →  layers/base (@commonpub/layer)  →  packages/* (12 npm packages)
tools/create-commonpub   Rust CLI
tools/worker             delivery monitoring utilities
deploy/                  Docker, Caddyfile, DO app-spec
docs/                    human docs, ADRs, session logs
codebase-analysis/       raw inventory (generated — trust over older docs)
```

12 packages on npm as `@commonpub/*`:
schema, server, config, protocol, auth, ui, editor, explainer, learning, docs, infra, test-utils.

## Latest published versions (refreshed session 224, 2026-06-24 — defer to `docs/STATUS.md` for LIVE)

- schema 0.48.0, server 2.92.0, config 0.23.0, layer 0.86.4
- ui 0.13.1, theme-studio 0.6.1, protocol 0.14.0, editor 0.9.0, explainer 0.8.0
- learning 0.5.2, docs 0.6.3, auth 0.8.0, infra 0.9.0, test-utils 0.5.8
- create-commonpub 0.5.18 (crates.io — `cargo install create-commonpub`)
- (Always `npm view @commonpub/<pkg> version` / `cargo search` before trusting this — it drifts.)
- Theme has readable `--*-text` tokens (session 224): each vivid semantic
  (`--green/--yellow/--red/--teal/--purple/--pink/--accent`) color-mixed toward
  `--text` so it reads >=4.5:1 as small text on light AND dark; use these (not the
  raw vivid) for any colored TEXT. Raw vivid stays for fills/borders/dark-overlay badges.

All three instances (commonpub.io / deveco.io / heatsynclabs.io) are LIVE + healthy.
commonpub.io builds from the workspace `main`; deveco.io + heatsynclabs.io pin the npm layer
at `^0.86.4` (rolled in lockstep; verify with `npm view`). deveco registers its brand theme pair
(`deveco`/`deveco-dark`) + `config.defaultTheme: 'deveco'` — no longer riding the stoa
fallback (session 196).
deveco keeps a CUSTOM `layouts/default.vue` + `pages/index.vue` (its nav is now
config-driven via NavRenderer — session 180); heatsync uses the BASE layout.
Federation flag: verify per-instance via `curl /api/features`. All identity sub-flags
(`linkRemoteAccounts`, `signInWithRemote`, `actingAs`, `remoteInteract`,
`remotePublish`) are `false` everywhere; `CPUB_FED_TOKEN_KEY` is unset.
Run `curl /api/features` to verify before any "dormant" claim — memory
of past flag state drifts (see session 149's "live-active state correction").

## Database

- PostgreSQL 16 + Drizzle.
- **92 tables, 46 enums. 28 migrations (0000–0027).** (sessions 203-204, commonpub.io only: +`processed_activities`/`digest_runs` tables, `content_items`/`hub_posts`.`remote_like_count` column; 0026 `remote_like_count`+backfill, 0027 hot-read composite indexes + the 2 dedup/claim tables. npm unchanged → deveco/heatsync still effectively 0025.) Full list: `codebase-analysis/02-schema-inventory.md`. 0014 = `mirror_requests` (consent-based push, session 185), 0015 = `registry_instances` + `registry_instance_status` enum (instance directory, session 186), 0016 = `contests.cover_image_url` (session 188), 0017 = `contest_status` +draft/+paused & `contests.show_prizes` (session 189), 0018 = `contests.stages`/`current_stage_id` (session 189), 0019 = `contest_entries.stage_state` (session 189), 0020 = `metrics_daily` (public-API time-series rollups, session 190), 0021 = `contest_entries.stage_submissions` (session 194), 0022 = `contests.content_format` + `contest_content_format` enum (session 197, now DEPRECATED/inert), 0023 = per-field `description_format`/`rules_format`/`prizes_description_format` (session 197), 0024 = `content_status` +`scheduled` & `content_items.scheduled_at` (scheduled publishing, session 199), 0025 = `contest_stakeholders.role` (`reviewer`|`editor`) + RBAC system-role/permission/user_role seed (session 201). Layout-engine tables (`layouts`, `layout_rows`, `layout_sections`, `layout_versions`) added in migration 0005 — instance-local, never federate. Migration 0012 (session 179) adds two PARTIAL composite indexes `idx_content_items_feed_recency` `(published_at DESC NULLS LAST, id DESC)` + `idx_content_items_feed_popular` `(view_count DESC, id DESC)` over `WHERE status='published' AND deleted_at IS NULL` — they back the keyset feed. NULLS placement is matched syntactically by the planner, so the index spells `id DESC NULLS FIRST`; `pushSchema` (PGlite test harness) SKIPS partial indexes (test creates DDL itself).
- Domains: auth, content, social, messaging, hubs, products, learning, docs, videos, contests, events, voting, federation, admin, files.
- Soft delete on: users, contentItems, hubs, federatedContent, federatedHubPosts.
- Denormalized counters pervasive (voteScore, entryCount, attendeeCount, memberCount, likeCount, etc.).
- `contentTypeEnum`: project, article, blog, explainer. **`article` is legacy — use `blog`** (session 116).

## Recent major additions (sessions 108–190)

- **108** URL restructure → `/u/{username}/{type}/{slug}` canonical
- **116** Article↔Blog merge
- **117** Contest system
- **118** Password reset, admin reports, video social, nav badges
- **119** Security hardening, HTML sanitizer, signed federation backfill
- **121** OAuth federation bugs fixed
- **122** Deep audit, hub resources/products, v1.0 completion
- **123** Destination phases 0+1+4+2 (editorial, runtime flags, homepage)
- **124** Destination phases 3+5+6+7 — **nav system, events, voting, contest judges**
- **125** Events UI polish, contest voting UI, error.vue SSR theme fix
- **126** Doc overhaul + scaling plan + typecheck fixes
- **127** Public Read API v1 + 8 bug fixes including drafts-leak + stored-XSS
- **128** **Docs unblock** + drizzle-kit push → committed migrations + fix silent drift
- **135** Audit-fix: SSRF defense (safeFetch/safeFetchBinary added since 2.48.0)
- **136–140** Cross-instance identity foundation + runtime + Mastodon login UI (all behind `identity.*` flags; off in prod, 5-flag gate)
- **141–142** CLI scaffolder version-drift fix + admin DO deploy + import resolves lazy-loaded images
- **143** Mobile-nav pathPrefix regression + extreme audit
- **144** Mobile UX fixes
- **145–148** Three audit-fix passes + federation-hardening Stage 1+2 (SSRF cluster + protocol/server SSRF consolidation)
- **149** DO Spaces CDN + safeFetch P0 hotfix + Stage 3 Items 6+7 (raw-body digest + strict sig coverage policy)
- **150** Stage 3 Items 4+8+9 wrap: `safeFetchResponse`/`safeFetchSigned` (federation outbound through pinned dispatcher), Better Auth signed-cookie helper (federated SSO callbacks), `getClientIp` (rightmost XFF, multi-proxy hardening). Plan fully cleared.
- **154** Admin theme editor (DB-stored custom themes + capture-from-`:root`)
- **155–159** Layout engine foundation → homepage **canary** live on commonpub.io rendering via `<LayoutSlot>` + **Stage E** renderer unification (sections point at EXISTING Block*/Homepage* components via `propMap`, not parallel renderers)
- **160** Layout **editor** Phase 3a (shell, read-only canvas, inspector, auto-save) — 4 audit rounds
- **161–162** Admin sidebar collapse + editor-chrome
- **163–166** Phase 3b drag-drop (`@vue-dnd-kit/core`) + Phase 3c resize (snap-to-12, neighbour absorption)
- **167** Phase 3e auto-form-from-Zod (section config inspector)
- **168** `<PageFrame>` becomes the canonical page frame (custom-page + editor canvas adopt it); ADR 028 homepage-customization model
- **169** **Deployed sessions 163–168 to commonpub.io.** Caught + fixed a live homepage P0 (dnd-kit `inject('VueDnDKitProvider')` threw on the provider-less public path → guarded behind `editable`); hardened the deploy smoke (in-container, checks `/` not just `/api/health`)
- **175–177** **RBAC phase 0/1** (`roles`/`role_permissions`/`user_roles`, migration 0009; `resolveUserPermissions` + `requirePermission`; flag `rbac` default OFF) + contest UX overhaul
- **178–179** **Keyset feed pagination** (`listContentKeyset` → `GET /api/content/feed`; partial composite indexes, migration 0012)
- **180–181** Crafted-cursor DoS hardening + federated-leak fix + base-layout chrome tokenization
- **183–188** **Federation discovery + hardening** LIVE on all 3: actor/outbox projection, consent-based mirror requests (`mirror_requests`, 0014), instance registry (`registry_instances`, 0015) with commonpub.io as the default registry, self-ref FKs (0013), CLI published to crates.io. **Federation ON in prod.**
- **189** **Contest phase A** — stage lifecycle (`contest_status` +draft/+paused, 0017), dynamic stages (`stages`/`current_stage_id`, 0018), cohorts/Top-N cull (`stage_state`, 0019), per-round judging (`JudgeScoreEntry.roundId`); voting stays advisory
- **190** **Public-API expansion** — flexible per-key CORS (`originPatternSchema`/`matchOrigin`), privacy-respecting metrics (`read:analytics`, `/api/public/v1/metrics/*`), time-series rollups (`metrics_daily`, 0020 + `metrics-rollup` plugin + `publicApiMetricsFederation` flag). **Stoa** is the new default theme (light+dark) + theme-editor fork fix.
- **201** **RBAC activated + per-contest editors** (SHIPPED + ROLLED to all 3, PR #51; `features.rbac` LIVE ON on commonpub.io + deveco.io, OFF on heatsync — `curl /api/features | jq .rbac`). The 175–177 RBAC machinery shipped but Phase 2/3 were never built, so the `roles`/`role_permissions`/`user_roles` tables were empty and flipping `features.rbac` was a no-op (`staff` == `member`). Migration **0025** seeds the 5 system roles + permission sets (admin=`*`, staff=moderator set, no `admin.access`) + backfills `user_roles`; `seedRbac()` mirrors it for fresh installs. Added the admin **roles UI** (`/admin/roles` + per-user custom-role assignment in `/admin/users`, gated on `roles.manage`), `/api/me` permissions, and `useCan()`. `updateUserRole` now syncs `user_roles` + last-admin floor (INV-4). Per-contest **editor** role (`contest_stakeholders.role` `reviewer`|`editor`, 0025): full edit of ONE contest with no system access, via `canManage = owner || isContestEditor || contest.manage` threaded through `updateContest`/`transitionContestStatus`/`advanceContestStage`. **Security:** admin-bypass grants (`*`, `admin.access`, `admin.*` — the wildcard expands to `admin.access`) are stripped from every non-admin role, and promoting a user to the admin system role requires `admin.access` (not just `users.manage`).

## Layer structure

`layers/base/` — the distribution unit.
- 92 pages (Nuxt file-based)
- 144 components
- 35 composables
- 338 API route files in `server/api/` (332 handlers + 6 `__tests__` files)
- 22 AP/site routes in `server/routes/` (inbox, outbox, .well-known)
- 11 server plugins, 11 server (Nitro) middleware, 3 route middleware
- 7 themes registered in `packages/ui/src/theme.ts` `BUILT_IN_THEMES` (base, dark, generics, agora, agora-dark, **stoa, stoa-dark**). Default resolution: DB `theme.default` → `config.defaultTheme` (thin-app brand pin, session 196) → stoa. Registered themes light/dark-flip within their own family (pairId → family+isDark → `<id>`/`<id>-dark` name convention).

## Server package structure

`packages/server/src/` — **25 module dirs**:
admin, auth, content, contest (+judges, +stages), docs, events, federation (16 files), homepage, hub (6 files), **identity** (cross-instance), import, **layout** (CRUD for `layouts`/`layout_rows`/`layout_sections`/`layout_versions`; session 157), learning, messaging, navigation, notification, product, profile, **publicApi** (read API + metrics + CORS), **rbac**, **realtime** (SSE), search, social, video, voting.

Plus 11 file-level utilities: email, hooks, image, index, oauthCodes, query, security, storage, theme, types, utils.

## Feed pagination (sessions 178–179, keyset)

Two pagination paths coexist:
- **Offset** — `listContent(db, filters, opts)` → `{ items, total }`. `GET /api/content`.
  Used by numbered/admin listings, search, and the `popular`/`featured`/`editorial` sorts
  (mutable sort keys can't be keyset-paginated). Per-request `COUNT(*)`.
- **Keyset (cursor)** — `listContentKeyset(db, {...filters, cursor}, opts)` →
  `{ items, nextCursor }`. `GET /api/content/feed`. The scalable infinite-scroll path:
  recency order (`published_at DESC NULLS LAST, id DESC`), O(limit)/page, no COUNT
  (`limit+1` row proves hasMore), backed by migration 0012's partial indexes.
  Federated case = keyset-MERGE: fetch `limit+1` from each source past the cursor in one
  shared total order (`compareFeedOrder`), merge, take `limit`.

Cursor helpers in `packages/server/src/query.ts`: `encodeCursor`/`decodeCursor` (opaque
base64url of `{v,id}`; `decodeCursor` returns null on bad input → falls back to page 1) +
`keysetWhere(sortCol, idCol, cursor)` (NULLS-LAST predicate). **Load-bearing invariant:**
the local SQL, the federated SQL, and the JS comparator must agree byte-for-byte, and
Postgres `uuid DESC` == JS string-desc (cursor is fed back into SQL `id < :id`). Both are
mutation-tested. Client: `useContentFeed` composable (layer) picks keyset-for-recency /
offset-for-popular transparently; `resolveContentQuery` (layer server util) is the shared
auth/status/visibility gate both endpoints route through. See
`docs/plans/pagination-scalability.md` (SHIPPED through step 4).

## Feature flags

Top-level flags default ON: `content`, `social`, `hubs`, `docs`, `video`,
`learning`, `explainers`, `editorial`, `admin`, `contentImport`.
Default OFF (layer `nuxt.config.ts` build-time default): `events`, `contests`,
`federation`, `federateHubs`, `seamlessFederation`, `emailNotifications`,
`publicApi`. **Note:** the build-time default is the lowest-priority tier —
`contests` is turned **ON live** on commonpub.io / deveco.io / heatsynclabs.io
via per-instance config (`apps/reference/commonpub.config.ts` sets
`contests: true`). Always `curl /api/features` for ground truth before calling a
flag "dormant".

`identity` is a nested object with 5 sub-flags, all default OFF:
`linkRemoteAccounts`, `signInWithRemote`, `actingAs`, `remoteInteract`,
`remotePublish`. Enabling any of the token-using ones requires
`CPUB_FED_TOKEN_KEY` (32-byte hex) in env — the identity-startup Nitro
plugin's `assertIdentityConfig` refuses to boot otherwise.

Details: `codebase-analysis/08-feature-flags-inventory.md`.

## Layout engine (sessions 155–169)

DB-driven page layouts behind `features.layoutEngine` (default **OFF**; **ON
live on commonpub.io** via a runtime override — verify with `curl
/api/features`). Instance-local — the `layouts`/`layout_rows`/
`layout_sections`/`layout_versions` tables **never federate**.

## Contest system (session 117, overhauled 171)

> **Elevation (session 211) MERGED to main + LIVE on commonpub.io only** (deveco/heatsync
> pending publish): transactional `createContest`/`withdrawContestEntry`, race-safe
> `addContestJudge`, pgEnum-derived validators, `CpubDateTimeField` (UTC fix), dark-safe Full-HTML
> (`sanitizeRichHtml` neutralizeColors + `.cpub-md-html`), per-stage submissions/proposals, PII
> partition. See `docs/plans/contest-elevation.md`.
>
> **Editor = 3-panel shell (session 218, `contest-editor-shell` branch — UNRELEASED):**
> `ContestEditor.vue` is a `layout:false` full-screen editor matching the project/blog editor —
> left `EditorBlocks` palette · center `ContestBodyCanvas` (Overview/Rules/Prizes tabs over ONE
> shared `BlockCanvas`) · ~340px right `EditorSection` rail (Details/Schedule/Stages+advancement/
> Entries/Prizes/Judging/Access/People/Danger). Banner+cover render inline in the Overview body;
> lifecycle transitions live in a topbar `Status ▾` menu (full menu-button keyboard pattern). The
> three body `useBlockEditor`s are HOISTED into `ContestEditor` so the palette targets the active
> body; write-back marks dirty explicitly and watches `() => editor.blocks.value` (the bare
> readonly-ref watch misses structural inserts). It is **NOT a `<form>`** — embedded palette/
> section buttons default to `type=submit` and would fire stray saves. Bodies are `BlockTuple[]`
> (`descriptionBlocks`/`rulesBlocks`/`prizesBlocks`); legacy markdown converts on first edit.
> Contest blocks: `judgesShowcase` + the new sanitized `html` block (`BlockHtmlView` via
> `sanitizeRichHtml`+neutralizeColors, registered globally in `BlockContentRenderer`). See
> `docs/plans/contest-editor-shell.md` + `docs/sessions/218-contest-editor-shell-build.md`.

Behind `features.contests` (**live on all three instances**). Tables:
`contests`, `contest_entries`, `contest_judges`, `contest_entry_votes`.
Lifecycle FSM: `upcoming → active → judging → completed` (+ `cancelled` from any
non-terminal state); `calculateContestRanks` runs on completion (`RANK()`, scored
entries only). Instance-local — contests never federate.

Invariants (don't regress):
- **Judges live in the `contest_judges` table — the single source of truth.** The
  legacy `contests.judges` jsonb column is fully deprecated: no longer read OR
  written (`createContest` seeds the table from `input.judges`; update never
  touches judges — manage via `/judges` endpoints). Scoring requires an
  *accepted*, non-`guest` judge record.
- **Score privacy:** per-judge scores + written feedback (`includeJudgeScores`)
  are privileged-only (owner / admin / panel judge). Aggregate `score` exposure
  goes through `shouldRevealScores(visibility, status, privileged)` honouring
  `judgingVisibility` (`public` always / `judges-only` after completion /
  `private` never to the public). Pure helper — exhaustively unit-tested.
- `judgingCriteria` (jsonb, migration 0006): when set, judges score **each
  criterion** (0..weight) and the overall is the normalized weighted sum;
  per-criterion breakdown stored in `judgeScores[].criteriaScores`. No criteria →
  single holistic 1–100. `judgeEntrySchema` takes `score` OR `criteriaScores`.
  Prizes support optional `place` **and** optional `category`.
- **`judgeContestEntry` is concurrency-safe** — the judgeScores read-modify-write
  runs in a transaction with `SELECT … FOR UPDATE` on the entry row, so two
  judges scoring the same entry can't lose each other's writes. A judge **cannot
  score their own entry** (conflict-of-interest guard).
- **Access control (migration 0008):** `visibility` (`public`/`unlisted`/`private`,
  orthogonal to `status`) + `visibleToRoles` (role gate) + the `contest_stakeholders`
  table (named view-only reviewers). `canViewContest(db, contest, user)` enforces
  it on every read endpoint (404 on block — no existence leak); the public v1 API
  exposes only `public` contests. Listings show only `public` (+ your own drafts;
  admins see all). Stakeholders ≠ judges (no scoring, not in judge list).
- **Entry customization (migration 0007):** `eligibleContentTypes` (jsonb[]) gates
  which content types may be entered; `maxEntriesPerUser` (int, null=unlimited)
  caps entries per person. Both enforced in `submitContestEntry`.
- **Community voting:** one vote/user/entry while active|judging; **no self-vote**;
  advisory only (not ranked). Results page shows a Community-Choice highlight +
  per-entry vote tally.
- **Winner alerts (server 2.61.1):** on completion, entrants whose rank earns a
  place-prize (or top-3 when no place-prizes defined) get a "🏆 You won!"
  notification naming placement + prize; others get "Results Posted". Fired in
  `transitionContestStatus` after `calculateContestRanks`.

- **Render path**: `<LayoutSlot route zone>` (`layers/base/components/`) →
  `useLayout(route)` fetches `/api/layouts/by-route` → `<LayoutRow>` →
  `<LayoutSection>`. When the flag is OFF or no layout row exists for the
  route, pages fall back to the legacy renderer (3-way `v-if` in
  `pages/index.vue`). Live on commonpub.io: the homepage is a **canary**
  rendering via `<LayoutSlot>`.
- **`<PageFrame>`** (session 168) is the ONE canonical page frame (full-bleed
  full-width zone + capped main/sidebar grid). Adopted by the custom-page
  catch-all (`pages/[...customPath].vue`) + the editor canvas. Homepage
  `index.vue` migration to it is the last consolidation step (Part A, pending).
- **Section registry** (`layers/base/sections/`): 17 section types. Stage E
  unification — each registry entry points `component:` at an **EXISTING**
  `Block*`/`Homepage*` component and adapts props via `propMap`. Do NOT write
  parallel `Section*.vue` renderers (16 such dupes were deleted in Stage E).
- **Editor** at `/admin/layouts` + `/admin/layouts/[id]` (admin-only). Phase
  3a shell + 3b drag-drop (`@vue-dnd-kit/core`) + 3c resize (snap-to-12,
  neighbour absorption) + 3e auto-form-from-Zod config inspector — all live.
  GOTCHA: the dnd composables throw without a `<DnDProvider>` ancestor, so
  they're gated behind `editable` (see `docs/llm/gotchas.md`).
- Plan/status: `docs/plans/layout-engine-rollout.md` + `phase-3-editor.md`
  (checkboxes lag reality — 3b/3c are live though some boxes are unchecked).

## Thin-app pattern

A deployed instance is ~4 files extending the layer:
- `nuxt.config.ts` — `extends: ['@commonpub/layer']`
- `commonpub.config.ts` — feature flags + instance config
- `server/utils/config.ts` — Nitro-side config resolver: merges `commonpub.config.ts` defaults with `FEATURE_*` env vars and DB overrides from `instanceSettings.features.overrides` (cached 60s). Server handlers import from here.
- `components/SiteLogo.vue` — branded logo

Real example: `deveco.io` (~25 branded/config files extending the layer).

## Federation (ActivityPub)

- Pure-TS ActivityPub in `@commonpub/protocol` (no Fedify or external AP framework). `jose` for HTTP signatures.
- Better Auth + AP Actor SSO (Model B) for cross-instance login.
- Content federates with `cpub:type` extension — full fidelity CommonPub-to-CommonPub, falls back to AP Article for Mastodon/Lemmy.
- Hub federation: Group actors (FEP-1b12), session 083+, `federateHubs` flag.
- Instance mirroring: pull or push, per-domain, with filterContentTypes and backfillCursor.
- Circuit breaker per `instanceHealth` domain.
- HTTP Signatures with RSA 2048 via jose.

## Deployment

Three production instances (all auto-deploy from main on push):
- **commonpub.io** — DO, Docker+Caddy, self-hosted Postgres. Builds
  from monorepo source (`@commonpub/layer` workspace dep).
- **deveco.io** — DO, Docker+Caddy, managed DO Postgres. Thin consumer
  of `@commonpub/layer` via npm.
- **heatsynclabs.io** — DO, Docker+Caddy. Thin consumer of
  `@commonpub/layer` via npm. Federation flag OFF.

All 3 use Caddy with `header_up X-Forwarded-For {remote_host}` —
OVERWRITES XFF, so depth=1 (the default for the session-150
`getClientIp` helper) is the correct rate-limit-key choice. Operators
behind multi-proxy topologies (CDN → nginx → app) set
`CPUB_TRUSTED_PROXY_DEPTH=N`.

Deploy runs `scripts/db-migrate.mjs` (session 128+) which applies committed migrations from `packages/schema/migrations/` via `drizzle-orm/node-postgres/migrator.migrate()`. State tracked in `drizzle.__drizzle_migrations`. No prompts, no manual SQL. (Before session 128: deploys used `drizzle-kit push`, which blocked on TTY prompts for populated-table constraint changes and silently dropped DDL.)

## Where to read more

- Full inventory: `codebase-analysis/` (every table, route, component)
- Session logs: `docs/sessions/NNN-*.md` — newest is highest NNN, load most recent ones first for context
- ADRs: `docs/adr/` — architecture decisions
- Human guides: `docs/guides/users.md` + `docs/guides/developers.md`
