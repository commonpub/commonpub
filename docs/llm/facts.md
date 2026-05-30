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

## Latest published versions (session 160, 2026-05-28)

- schema 0.17.0, server 2.58.0, config 0.15.0, layer 0.24.0
- ui 0.9.0, protocol 0.12.0, editor 0.7.11, explainer 0.7.15
- learning 0.5.2, docs 0.6.3, auth 0.6.0, infra 0.8.0, test-utils 0.5.6

**The `@commonpub/layer` workspace on `main` is UNPUBLISHED ahead of
0.24.0** (sessions 161–169: admin sidebar collapse, Phase 3c drag/resize
editor, PageFrame consolidation, dnd-kit provider-guard hotfix).
commonpub.io builds from workspace source (so it runs that unpublished
code); deveco.io + heatsynclabs.io run npm `0.24.0` (dormant — layoutEngine
off, legacy homepage renderer). Federation flag: verify per-instance via
`curl /api/features` (the old "true on commonpub+deveco" note drifts). All identity sub-flags
(`linkRemoteAccounts`, `signInWithRemote`, `actingAs`, `remoteInteract`,
`remotePublish`) are `false` everywhere; `CPUB_FED_TOKEN_KEY` is unset.
Run `curl /api/features` to verify before any "dormant" claim — memory
of past flag state drifts (see session 149's "live-active state
correction").

## Database

- PostgreSQL 16 + Drizzle.
- **80+ tables, 41 enums.** Full list: `codebase-analysis/02-schema-inventory.md`. Layout-engine tables (`layouts`, `layout_rows`, `layout_sections`, `layout_versions`) added in migration 0005 — instance-local, never federate.
- Domains: auth, content, social, messaging, hubs, products, learning, docs, videos, contests, events, voting, federation, admin, files.
- Soft delete on: users, contentItems, hubs, federatedContent, federatedHubPosts.
- Denormalized counters pervasive (voteScore, entryCount, attendeeCount, memberCount, likeCount, etc.).
- `contentTypeEnum`: project, article, blog, explainer. **`article` is legacy — use `blog`** (session 116).

## Recent major additions (sessions 108–150)

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

## Layer structure

`layers/base/` — the distribution unit.
- 90 pages (Nuxt file-based)
- 132 components
- 33 composables
- ~300 API routes in `server/api/`
- AP routes in `server/routes/` (inbox, outbox, .well-known)
- 6 server plugins, 7 request middlewares
- 5 themes registered in `packages/ui/src/theme.ts` `BUILT_IN_THEMES` (base, dark, generics, agora, agora-dark)

## Server package structure

`packages/server/src/` modules:
admin, auth (identity), content, contest (+judges), docs, events, federation (10 files), homepage, hub (5 files), import, **layout** (CRUD for `layouts`/`layout_rows`/`layout_sections`/`layout_versions`; session 157), learning, messaging, navigation, notification, product, profile, search, social, video, voting.

Plus file-level utilities: email, hooks, image, oauthCodes, query, security, storage, theme, utils.

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
- `judgingCriteria` (jsonb, migration 0006) is a display/guidance rubric; judges
  still submit one 1–100 score. Prizes support optional `place` **and** optional
  `category` (Hackster-style themed awards).
- **Entry customization (migration 0007):** `eligibleContentTypes` (jsonb[]) gates
  which content types may be entered; `maxEntriesPerUser` (int, null=unlimited)
  caps entries per person. Both enforced in `submitContestEntry`.
- **Community voting:** one vote/user/entry while active|judging; **no self-vote**;
  advisory only (not ranked). Results page shows a Community-Choice highlight +
  per-entry vote tally.

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
