# CommonPub — Status & Operator Runbook

> **Living doc — your "come back later" reference.** Snapshot updated 2026-06-19 (sessions 203-204).
> Verify any version/flag claim before trusting it: `npm view @commonpub/<pkg> version`,
> `curl https://<instance>/api/features`, `cargo search create-commonpub`.
> Companion docs: the rolling handoff `docs/sessions/205-kickoff-next.md`, the audit
> `docs/sessions/203-full-codebase-audit.md` + `docs/sessions/204-deep-audit-round2.md`,
> RBAC plan `docs/plans/rbac-activation-and-contest-editors.md`, contest guide
> `docs/reference/guides/contests.md`.

---

## TL;DR — where things stand

**Session 216 (2026-06-23) — `contests` branch MERGED to main + LIVE on commonpub.io ONLY**
(merge commit `00139353`, deploy run `28019122283` ✅). Ships 108 commits = the **monolith-splits backlog**
(sessions 205-210) + the **contest elevation** initiative (211-216). Migrations **0028-0031** applied;
new flags `contestProposals`/`contestPii` present + **OFF**; health + all key surfaces 200. **deveco.io +
heatsynclabs.io NOT updated** (no npm publish this roll — they lag main until the publish chain runs).
Pre-deploy deep audit (3 agents): migrations GO, security all-PASS (133 tests), flags safe-OFF. See the
`contests` branch section below for detail.

**Sessions 203-204 — full codebase audit + remediation MERGED to main, LIVE on commonpub.io ONLY
(merge commit `d32e773f`, 2026-06-19).** Deploy ✅ (run 27812795608, 6m39s); commonpub.io verified
healthy (health/homepage/content/keyset feed 200, flags intact, CSRF live + not over-blocking).
Migrations **0026** (`remote_like_count` + backfill) and **0027** (`processed_activities` +
`digest_runs` tables, hot-read composite indexes) applied. **42 commits**, full suite 33/33 green,
mutation-proven tests incl. a real-Postgres concurrency harness.

⚠️ **NOT rolled to deveco.io / heatsynclabs.io.** Those pin *published* npm packages, and **nothing
was published this cycle** — so the changed packages (schema/server/layer/protocol/editor/infra)
have source changes on `main` (driving commonpub.io's workspace build) but the npm registry is still
at schema 0.45.0 / server 2.89.0 / layer 0.82.0. To roll the security fixes to deveco/heatsync:
bump + publish in dependency order, then bump their pins + CLI (`docs/sessions/205-kickoff-next.md`
has the plan). Branch `audit-203-fixes` preserved on origin.

What shipped (commonpub.io): **Security** — closed a private-content AP leak (P0), unauthenticated
inbox + Mastodon-host + megalodon SSRF, stored XSS (custom-HTML/editor/federation-output sanitizers),
added a CSRF origin-check middleware, inbox replay dedup, constant-time admin-secret, products-IDOR /
hub-vote-ban / private-hub-redaction / version-history + docs/event draft-leak / uuid-param + NaN-limit
DoS guards. **Data integrity** — `remote_like_count` (reconcile no longer wipes fediverse likes),
transactional `createContentVersion`/`fork`/`enroll`/`deletePost`/`advanceContestStage`, delivery N+1
batched. **Perf** — composite indexes, page-1 COUNT gating, pagination tiebreakers. **Architecture** —
field-cascade DRY (create/update share `CONTENT_PASSTHROUGH_FIELDS`), `validators.ts` split into
`validators/<domain>`, inbox-parsing + `ContentAvatar` extraction. **Ops** — multi-replica worker
claims, deploy `pipefail` (a failing migration now fails the deploy). Detail: `docs/sessions/203` + `204`.

**Deferred (each its own follow-up — see 205-kickoff-next):** roll to deveco/heatsync (publish + pins);
homepage 3-path consolidation (2-phase deploy: seed default layouts first); user-block feature;
`pg_trgm` search index (PGlite-contrib not portable to layer vitest); megalodon SSRF TOCTOU residual.

---

**Session 201 — SHIPPED + ROLLED to all 3 (PR #51, 2026-06-17).** npm: **schema 0.45.0 /
server 2.89.0 / layer 0.82.0**. Migration **0025** applied on all 3 (`db:migrate` ✅ each). CLI
**create-commonpub 0.5.16** (pins ^0.45/^2.89/^0.82). Discovered RBAC Phase 2/3 were never built
(seed/admin-UI), so enabling `features.rbac` was a no-op and `staff` == `member`. Shipped: migration
0025 (seeds 5 system roles + permission sets + `user_roles` backfill; also adds
`contest_stakeholders.role`), `updateUserRole` atomic sync + last-admin floor (`FOR UPDATE`), admin
**roles UI** (`/admin/roles` with an Enable/Disable RBAC toggle + per-user assignment in
`/admin/users`, `roles.manage`), `/api/me` permissions + `useCan()`, and a per-contest **editor** role
(full edit of one contest, no system access). Three adversarial audit rounds fixed a **P0** (admin
bypass via the `admin.*` wildcard) + atomicity/TOCTOU hardening.

⚠️ **`features.rbac` is now LIVE-effective wherever the override is ON** (the seed makes the flag do
something): **commonpub.io = ON** (enabled via the new toggle), **deveco.io = ON** (a *pre-existing*
override that was dormant until 0025 seeded — so deveco's `staff` users are now moderators; confirm
intended or Disable on `/admin/roles`), **heatsynclabs.io = OFF** (inert). When ON: admin = full,
staff = moderator set (no `admin.access`), member/pro/verified = nothing, custom roles resolve.
Kill-switch: Disable on `/admin/roles` (or clear the `rbac` override in `/admin/features`) — no
redeploy. Detail: `docs/plans/rbac-activation-and-contest-editors.md` + `docs/sessions/201-*.md`.

**Sessions 199–200 — SHIPPED + ROLLED to all 3 (commonpub.io, deveco.io, heatsynclabs.io).**
npm: **schema 0.44.0 / server 2.88.0 / layer 0.81.0** (config 0.22.1). Migrations through **0024**.
All health 200, terms templating + image cropper verified per-instance.

5. **Image cropper** (layer 0.81.0): reusable `ImageCropperModal` (vue-advanced-cropper) for
   avatar (1:1 PNG) / banner (4:1) / cover (16:9 JPEG) uploads — fixed aspect frame, drag + zoom,
   WYSIWYG; wired into the shared `ImageUpload`. Render verified headlessly. `useFocusTrap` now
   restores focus on close (all modals). NOT yet wired into profile/content-editor uploads, and
   banner display containers aren't aspect-aligned yet (follow-ups).

1. **Field-drop sweep + scheduled publishing** (PR #35): fixed a "silent field-drop" bug class —
   **hub** icon/banner/privacy/website (the original report), **video** `categoryId`, content custom
   **slug**, learning `coverImageUrl`, lesson `durationMinutes`. Scheduled publishing added
   (`content_status` += `'scheduled'`, `scheduled_at`, atomic-claim worker + 60s plugin +
   `POST /api/content/[id]/schedule` + editor Schedule button). Migration **0024** (additive).
2. **Image uploads** (PR #36/#37, commonpub.io): were fully broken — `sharp`/`@aws-sdk/client-s3`/
   `ioredis` are optional-peer deps Nitro externalises and the Dockerfile runtime `npm install`
   pruned (→ "Cannot find module" 500); and DO Spaces was never configured (silent local-fs
   fallback, unwritable + unserved). Fixed: install those three in the Dockerfile runtime stage +
   `deploy.yml` writes `S3_*` to the droplet `.env` from masked secrets. **NOTE: deveco/heatsync
   have their OWN Dockerfiles** — apply the same if they enable uploads.
3. **Federation** (PR #39): inbound `Update(Group)` ingests a remote hub's icon/banner/name (was
   ignored → hub avatar/banner never federated); manual hub-mirror no longer drops `bannerUrl`;
   **registry peer discovery** (`GET /api/admin/registry/directory` + Registry tab for
   `announceToRegistry` instances, read-only) so pinging instances see all peers.
4. **Terms + hardening** (PR #41): templated Community Terms + Code of Conduct (instance name/domain
   substitution, canonical-CommonPub collapse). Audit hardening of PR #39: bound hub `name`, http(s)
   icon/banner only, `bannerBgStyle()` quotes the federated-hub banner CSS sink.

⚠️ **Open:** rotate the DO Spaces secret key (shared in plaintext); then `gh secret set
S3_SECRET_KEY` (no redeploy). Detail: `docs/sessions/200-kickoff-next.md`.

---

## TL;DR — earlier

**Contest large-text + HTML render** is the newest work (session 197, **SHIPPED + ROLLED to all 3**):
a large pasted HTML blob exposed an ingest/render DoS + a logout cascade, now fixed (`parseBody`
10MB body guard, shared markdown processors, 50k field caps, transient-`/api/me` no longer logs
out). Contest long-text fields gained a **per-field Markdown/HTML toggle** (`descriptionFormat` /
`rulesFormat` / `prizesDescriptionFormat`) — HTML mode renders raw layout/CSS/SVG through the new
permissive-but-script-free `sanitizeRichHtml`. Released **schema 0.43.0 / server 2.86.0 /
editor 0.7.12 / layer 0.76.0**, migrations **0022** + **0023** (additive). Full detail:
`docs/sessions/197-contest-largetext-hardening.md` + `docs/sessions/198-kickoff-next.md`.

---

**Earlier: Search + nav + theme-identity round** (session 196, SHIPPED + ROLLED to all 3):
(1) `/api/search`'s All tab is MIRROR-AWARE — delegates to `listContent`'s merged
local+federated stream (commonpub.io returned 0 for every query its own homepage answers);
(2) **priority nav** — links that don't fit collapse into a "More" dropdown
(`utils/navOverflow.ts`, hidden measure row; scroll-the-nav was tried and REVERTED — it clips
dropdown panels), killing the off-screen Log in at 769–1100px on all 3 and deveco's
thin-right-margin page overflow; (3) the topbar search is a REAL input (submit → `/search?q=`,
Cmd+K focuses, single focus ring); (4) search-page pills scroll in their own region (sort
dropdown no longer clips), empty Trending hides; (5) **theme identity** — `config.defaultTheme`
(config 0.22.x) + registered themes light/dark-flip within their OWN family
(pairId → family+isDark → the `<id>`/`<id>-dark` NAME CONVENTION, isDark inferred), riding the
existing themePair client flip; deveco registers `deveco`/`deveco-dark` and no longer rides the
stoa fallback. Released **config 0.22.1 / layer 0.73.0 / CLI 0.5.15**; earlier same arc:
deveco dark-mode + double-focus-ring fixes, e2e suite GREEN (schema 0.40.1 openapi
`process.argv?.[1]` fix — months of red e2e were one optional chain), glass sweep + bg-image
sink guard (ui 0.13.1 / theme-studio 0.6.1 / layer 0.72.x). Log:
`docs/sessions/196-search-nav-theme-round.md`; plan `docs/plans/search-overhaul.md` (all 3
phases done).

**Theme advanced tokens** is the newest work (session 195, **SHIPPED + ROLLED to all 3**):
(1) the 24 `--cpub-topbar/nav-link/footer-*` chrome tokens (in base.css since session 180) are now
REGISTERED in `TOKEN_SPECS` — custom themes/Studio can finally style the nav bar + footer (new
"Site chrome" editor group), plus `cpub-card-min/gap` + `sidebar-width-collapsed`; (2) treatment
tokens `--surface-backdrop`/`--bg-image` (true no-op defaults — `none`, never `blur(0)`) with a
schema **gradient-only guard** on `bg-image` (url()/escape smuggles rejected, known-bad tested);
(3) **Glass**: `recipe.treatment {glass, bgGradient}` → translucent surfaces + backdrop blur +
frosted top bar + accent-tinted page gradient, AA enforced against the FLATTENED composite; new
Glass archetype; wizard Feel-step controls; (4) capture-flood fix (`resolveVarRefs` — var()-defaulted
specs phantom-diffed on stock sites); (5) wedge-gap resets (ContentCard/VideoCard thumbs, HubHero
banner). Released **schema 0.40.0 / ui 0.13.0 / theme-studio 0.6.0 / layer 0.72.0** (additive, no
migration), CLI **0.5.14** (pins ^0.72/^0.40/^2.84.1). deveco + heatsync bumped + deployed,
curl-verified. Both consumers `nuxt typecheck` EXIT 0 (the transient "21 errors" were
npm-tarball-test debris in node_modules — see the 195 log post-mortem; plus one real heatsync
HeroSection-override prop fix). **Patch round (ui 0.13.1 / theme-studio 0.6.1 / layer 0.72.1,
rolled to all 3):** Phase E glass sweep (backdrop hook on `.cpub-card`, ContentCard, 6 modal
panels, nav/user/mobile dropdowns) + audit fixes — sink-side `bg-image` guard in
`instanceTheme.sanitizeRenderTokens` (the generic settings route bypassed the schema guard) and
a glass AA floor vs the modal scrim (margin hardening; all curated palettes already passed).
STILL deferred: `border-style` token, full radius migration.
**Continuation round: e2e GREEN + glass smoke + dev un-broken (schema 0.40.1 / layer 0.72.2,
PR #29).** The months-red e2e suite had ONE root cause: schema's openapi CLI guard read
`process.argv[1]` at module top level — Vite's dev shim has `process` without `argv`, so every
dev/e2e page client-crashed to the 500 screen (prod immune: `sideEffects:false` tree-shakes it).
Fix `process.argv?.[1]` + family-aware dark-cookie theme assert + scoped login locators + docs
vitest forks pool (worker birpc flake). **CI fully green incl. e2e for the first time in months;
local `pnpm dev` works again.** Glass browser smoke done locally via Playwright (pair created
through the real admin API, both modes screenshot-verified, gradient + glass + pair flip OK).
MEMORY.md index trimmed 43.8→21.8KB (was over the load limit; long lines snapshotted into topic
files first).
Plan: `docs/plans/theme-studio-advanced-tokens.md`; log `docs/sessions/195-theme-advanced-tokens.md`.

**Contest per-stage submissions** (session 194): multi-phase contests can now
collect a different artifact per `submission` stage — a *proposal* template (summary/focus), then a
*prototype* template (repo/demo URLs) — filled by entrants on the contest page, shown to judges for
the round being judged, and browsable on a new entry-detail page
(`/contests/:slug/entries/:entryId`, artifact timeline; entry cards link there). New flag
`features.contestStageSubmissions` (default ON, inert until a stage defines a template). Server:
`submitStageArtifact` (owner + active + current-stage + cohort gates, template-validated, upsert
while the stage is open), `getContestEntry`, artifact plumbing in `listContestEntries`. Released
schema 0.39.0 / config 0.21.0 / server 2.84.**1** / layer 0.71.**2**, **migration 0021** (additive
`contest_entries.stage_submissions`). The .1 patches are the same-session audit round: stageState
per-round snapshot scores now honour `revealScores` (pre-existing leak since 189 — judges-only
contests mid-judging exposed round scores through the snapshots) + the judge page's artifact box is
flag-gated. Layer 0.71.**2** fixes a pack leak: npm's ignore globs treat `[slug]`/`[entryId]` route
dirs as character classes, so a test under a bracketed pages path shipped in the 0.71.1 tarball and
red-flagged consumer typechecks — never put `__tests__` under `pages/[param]/` in the layer.
**All 3 instances rolled** same day: deveco + heatsync bumped from the ^0.62-era pins straight to
schema ^0.39 / config ^0.21 / server ^2.84.1 / layer ^0.71.2 (picks up the whole Theme Studio arc
too), migration 0021 applied via deploy, curl-verified (health + `contestStageSubmissions` flag +
entries endpoint on heatsync's live contest). deveco's stale `pnpm-lock.yaml` (CI-only; Dockerfile
uses npm) regenerated — its CI had been red since the 0.60-era pins.
Plan: `docs/plans/contest-per-stage-submissions.md`; guide section in
`docs/reference/guides/contests.md`.

**Theme Studio overhaul** is the newest work (session 193, **LIVE**): (1) fixed the universal
`border-radius` rule that rounded line breaks/dividers/icons on rounded themes (Stoa) — surfaces keep
their radius, structural/media/pseudo elements reset to 0 (ui 0.12.1 / layer 0.68.2); (2) **independent
neutrals** — `buildPalette` `neutralHue`/`neutralSat` decouple surfaces from the accent (warm/cool/pure
via a wizard control); (3) **design-ethos archetypes** (Brutalist/Editorial/Soft/Terminal/Neumorphic) —
coherent presets that change shape+shadow+border+type+density together, plus a `neumorphic` shadow.
schema 0.38 / theme-studio 0.4 / layer 0.69 (additive, no migration). DEFERRED: color-UX redesign
(palette-option cards + HSL picker), full per-component radius migration, glass/treatment tokens.

**Theme Studio v2** (session 192, **LIVE**): on top of the guided
generator + light/dark pairs, it adds a real **`--secondary`** accent + `.cpub-btn-secondary`, a
**harmony "color family"** that drives the category accents (`--purple/--teal/--pink`), **film-grain
texture** (opt-in `--grain` overlay), a **rationalized "New theme" chooser** (unique family per theme
— multiple custom themes no longer collapse), and extras (in-wizard WCAG chip, name+save&apply finish,
AI-brief/token export, image-color extract). Released schema 0.37 / ui 0.12 / theme-studio 0.3 /
layer 0.67 (config/server unchanged, no migration). `density` also now affects spacing+leading.

Earlier this session — **Theme Studio v1** (on `main`, released): a guided
"easy mode" theme generator wired into the admin theme builder beside the granular token editor.
New package **`@commonpub/theme-studio`** (pure-TS, zero Vue) derives a full WCAG-checked theme from
a small `ThemeRecipe` via `recipeToTokens()`; the layer adds a `AdminThemeStudio` wizard + dice +
a "Spec sheet" preview scene, a Studio/Advanced toggle, and Google-Font `<link>` injection for
custom themes. `recipe`/`fonts` persist on the theme record (JSON in `instance_settings.theme.custom`
— **no migration**). New flag `features.themeStudio` (default ON). Touched: schema (`recipe`/`fonts`
on `customThemeSchema`), config (flag), server (`CustomThemeRecord`), ui (`tokensToCss` hardened to
strip `;{}`), layer. All suites green; **release pending** (see runbook — publish theme-studio before
the layer, bump consumer pins + CLI). Plan/log: `docs/sessions/192-theme-studio.md`,
`docs/reference/guides/theme-editor.md` (Studio section).

Earlier: the **public API expansion** (session 190): flexible CORS + a DevRel/analytics
metrics surface, in three released phases. **Phase 1 (CORS)** — per-key `allowedOrigins` now accept
wildcard patterns (`*`, `localhost`, `http://localhost:*`, `https://*.example.com`, scheme wildcards)
via a new `originPatternSchema` + a pure `matchOrigin()` matcher; `isWellFormedOrigin` gates origin
reflection against CRLF/header injection on both the request and the unauthenticated preflight echo;
admin UI gained CORS presets. **Phase 2 (metrics)** — new `read:analytics` scope + opt-in
`publicApiMetricsFederation` flag; aggregate, privacy-respecting endpoints under
`/api/public/v1/metrics` (overview, content/top, tags/trending, contributors/top, engagement,
federation), counting only public/published/non-deleted entities, no new PII, counter SUMs `::float8`
(int4-overflow safe). **Phases 1+2 are LIVE on all 3** (schema 0.34 / config 0.19 / server 2.81 /
layer 0.61, no migration; verified via the new flag in `/api/features`). **Phase 3 (time-series)** —
`metrics_daily` rollup table (**migration 0020**) + `metrics-rollup` worker (backfill-if-empty + 6h
refresh) + `GET /metrics/timeseries` (day/week/month buckets, deltas); released schema 0.35 / server
2.82 / layer 0.62. Plan: `docs/plans/public-api-cors-and-metrics.md`. Phase 4 (event-tracking table)
deferred.

Earlier: the **contest stages engine** (session 189) is **feature-complete and shipped to all 3** —
schema 0.33.0 / server 2.80.0 / layer 0.60.0, migrations 0017–0019.
It covers: a dynamic multi-stage timeline (submission / review / sprint / results / event), draft +
paused lifecycle with bidirectional transitions, cohorts + Top-N **or** manual advancement
(`advanceCount` per round), per-stage judging rubrics, cohort-gated + per-round-isolated judging,
editable slug, prizes off-switch, and a two-column editor with dirty-state Save. A full end-to-end
multi-round integration test is mutation-verified. **Nothing remains on the contest plan.** Em dashes
were swept from all rendered layer copy.

Earlier: **federation discovery & hardening (Phases 0–4)** is live on all 3, and commonpub.io is the
default discovery registry. All npm packages published (zero source-vs-published drift);
`create-commonpub` is on crates.io. `main` is clean. The main flow still un-exercised end-to-end is
the **P3 mirror-request approve round-trip** (needs an admin login on two instances).

---

## ✅ Verified live (2026-06-03)

- **P0 outbox correctness:** instance `/actor/outbox` projects published+public content via
  `contentToCreateActivity` (deterministic `<objid>#create` ids). heatsync `totalItems` 2→8,
  deveco 23. (Was the headline bug: outbox projected the delivery queue → backfill got nothing.)
- **Federation topology:** commonpub.io ↔ deveco.io mutual-follow (seamless); deveco → heatsync
  mirror (heatsync content present in deveco's feed). actor↔signer inbox binding is safe for all
  CommonPub peers (delivery signs `keyId = ${activity.actorUri}#main-key`, so signer-host ==
  actor-host by construction).
- **Registry (P4) round-trip:** commonpub.io `/api/registry/instances` → 200 and lists deveco.io
  (40 users) + heatsynclabs.io (5 users, 8 posts, online) with **NodeInfo-pulled** stats. Boot
  heartbeats → signed ping → verify → NodeInfo pull → directory. commonpub.io self-skips its own ping.
- All 3 instances: `/api/health` 200, homepage 200.

---

## 🔴 What remains

### Needs you (can't be done headlessly)
1. **Add the `CARGO_REGISTRY_TOKEN` repo secret** (commonpub/commonpub → Settings → Secrets →
   Actions). Until then, CLI releases must be done locally (`cargo publish`); with it, pushing a
   `create-commonpub-v*` tag publishes automatically (`.github/workflows/cli-release.yml`).
2. **P3 mirror-request Offer→Accept round-trip** — the one federation flow not yet live-verified.
   Log into `/admin/federation` on instance A → "Request they mirror you" → B. On B → "Requests to
   mirror you" → **approve** with a history depth → expect: a pull mirror of A appears on B, A
   backfills, B enters A's `/actor/followers`, A's outgoing request flips **approved**. Reject path
   should flip it **rejected**.
3. **Browser-smoke `/admin/federation`** (Mirrors + Registry tabs) — needs an admin session.
4. **`reconcile-counters --check`** on each droplet → expect 0 drift:
   `docker compose -f docker-compose.prod.yml exec -T app node scripts/reconcile-counters.mjs --check`

### Deferred federation backlog (non-blocking — from sessions 185–188)
- **Streaming backfill progress** + **filter dry-run preview** in the admin UI (need polling /
  a remote-outbox probe). Currently in-flight state + a result toast only.
- **`approveMirrorRequest` is not transactional** → a duplicate `Accept(Offer)` is possible on
  partial-failure retry. Harmless today (receiver's `onAccept` matches `status='pending'`), but
  worth wrapping in a transaction.
- **`onMirrorRequest` admin-notify queries `users.role=='admin'`** — custom RBAC roles with
  `federation.manage` get no notification (the admin badge still surfaces the request).
- **Registry maturity:** no public-facing directory *page* (UI is admin-only); stats only refresh on
  ping (no independent poller); no registry→registry gossip; no auto-mirror; no NodeInfo
  "is-this-CommonPub" pre-check before sending an Offer.
- **No HTTP/signature layer in unit tests** — the wire path (signing + `verifyInboxRequest` + the
  actor↔signer binding) is only exercised by a real 2-instance run, never in CI.

### Known issues (cosmetic / pre-existing — not regressions)
- **deveco `/actor/following` omits heatsync** though heatsync lists deveco as a follower. Projection
  asymmetry; the mirror works (heatsync delivers off *its* followers list). Cosmetic.
- **deveco NodeInfo `localPosts: 81` vs feed/outbox `23`** — NodeInfo counts all statuses; that 81 is
  what the registry displays. Confirm it's the intended public number.
- **CI gating jobs (`check` + `rust`) stabilized (session 188):** the `@commonpub/infra` Redis
  integration flake was a real fixed-window boundary race (count-sensitive checks could straddle a
  wall-clock window edge) — fixed with a `waitForWindowHeadroom` guard. The `@commonpub/docs` flake
  (deterministic locally, transient under turbo's all-packages-parallel CI run) now has CI-only
  `retry:2`. `check` went green first-try after. **`e2e` root-caused (draft PR #7, NOT merged):** the
  Playwright webServer ran `nuxt dev`, so the FIRST homepage test paid nuxt-dev's cold Vite compile
  (>15s) and timed out (`workers:1` in CI → first test always pays it). PR #7 serves the production
  build (`nuxt preview`) in CI instead — this **fixed** the 2 homepage tests, but prod mode then
  surfaced **7 console-error failures on auth/`/create`/admin-theme pages** (e2e-prod-env config gaps
  — login works on the live sites, so not real bugs). To finish: download the run's Playwright trace
  artifact (or local prod repro) to pin the auth-page console error + add the missing e2e prod config,
  then merge PR #7. main's e2e is unchanged meanwhile (still the 2 known non-gating homepage flakes).
  Real prod gate remains commonpub.io's `scripts/smoke.mjs`.
- **GitHub Actions Node-20 deprecation** (warning on every run): auto-switches those actions to
  Node 24 on 2026-06-16 — non-breaking, self-resolving; bump action majors when convenient.
- **`@commonpub/test-utils` 0.5.6**: source has a `mockConfig` flag addition that the published 0.5.6
  predates. Immaterial (devDep-only, no runtime consumer); can't republish the same version.

### Future / nice-to-have
- **`npm create commonpub` wrapper** — a thin npm package that downloads a prebuilt binary, so JS
  devs scaffold without a Rust toolchain. Larger effort (cross-compile matrix + release workflow).
- Public registry directory page; the broader 10-phase federation roadmap (hub Groups behind
  `federateHubs`, BOM federation) — see `docs/plans/`.

---

## 📓 Runbook

### Release an npm package (the chain)
1. **Bump** the `version` in each changed `packages/<pkg>/package.json` (+ `layers/base/package.json`).
   `ui` etc. unchanged → don't bump. Verify what changed: `git diff --stat main...HEAD -- packages/`.
2. **Verify green:** `pnpm typecheck` (expect 27/27 — `theme-studio` added session 192) + the suites (`pnpm --filter @commonpub/<pkg> test`).
3. **Publish in dependency order**, polling `npm view @commonpub/<pkg> version` between each:
   `schema → config → protocol → auth → server → ui → theme-studio → layer`.
   (**theme-studio** is new/unpublished as of session 192; it has no runtime deps, but the layer
   depends on it, so publish it before the layer. First publish needs `npm publish` access for the
   new package name.)
   - Packages: `pnpm --filter @commonpub/<pkg> publish --no-git-checks --access public`.
   - **Layer ONLY via `pnpm run publish:layer`** (never `npm publish` from a layer — it leaves
     `workspace:*` literals in the tarball).
   - Internal `workspace:*` deps are rewritten to **exact** versions at publish (so a config bump
     leaves server pinning the old config internally — harmless; the app's *direct* config dep drives
     `defineCommonPubConfig` defaults).
4. **Update consumer pins** (deveco/heatsync/CLI), which use literal carets: **hand-edit across 0.x
   minor boundaries** — `^0.17.0` does NOT auto-cross to `0.18.0`.

### Deploy the 3 instances
- **commonpub.io** = the reference app in *this* repo. Deploys on **push to `main`** (`deploy.yml`):
  Docker build → droplet → `db-migrate.mjs` (committed migrations, hard-fail) → `smoke.mjs`
  (fails on non-2xx critical routes). Concurrency cancels in-progress runs. Use PR + squash-merge.
- **deveco.io** = `devEcoConsultingLLC/deveco-io`, deploys `main` via `deploy-prod.yml`. Pins
  `@commonpub/{config,layer,schema,server}` as carets; uses `npm install` (NOT pnpm frozen). Bump
  pins → push `main`.
- **heatsynclabs.io** = `heatsynclabs/heatsynclabs-io` (droplet `167.99.13.109`), deploys `main` via
  `deploy.yml`. Tracked `package-lock.json` (regen with `npm install`). Bump pins → push.
- ⚠️ **deveco + heatsync deploy workflows are WARN-ONLY on health** — `gh run` "success" ≠ healthy.
  **Always curl-verify** `/api/health` + a real route after each. (commonpub.io's `smoke.mjs` is hard-fail.)
- All 3 apply schema via `db-migrate.mjs` (committed migrations) — **never** hand-edit the DB over SSH.

### Publish the CLI (`create-commonpub`)
- Channel = **crates.io** (`cargo install create-commonpub`). Not on npm.
- After bumping `template.rs` pins + `tests/cli.rs` assertions: bump `Cargo.toml` version, `cargo test`,
  `cargo check` (sync `Cargo.lock`), commit, then:
  - Local: `cd tools/create-commonpub && cargo publish --locked` (uses `~/.cargo/credentials.toml`), **or**
  - CI: push tag `create-commonpub-v<version>` → `cli-release.yml` publishes (needs `CARGO_REGISTRY_TOKEN`).
- **The pins go stale silently** — bump them after every config/layer/schema/server publish.

### Verify federation live (curl checklist)
```
for h in commonpub.io deveco.io heatsynclabs.io; do curl -s "https://$h/api/health"; done
curl -s -H 'Accept: application/activity+json' "https://heatsynclabs.io/actor/outbox" | jq .totalItems
curl -s "https://commonpub.io/api/registry/instances" | jq '.instances[].domain'   # actAsRegistry on commonpub.io
curl -s "https://<instance>/api/features" | jq '{federation,seamlessFederation,actAsRegistry,announceToRegistry}'
```
Definitive live-delivery test: publish a public post on heatsync → it should appear on deveco within
a minute (`curl deveco.io/api/content?limit=5`, today's timestamp).

---

## 📌 Reference

### Published versions (verified 2026-06-25 — session 227 email Phase 1 outbox release)
| Package | Version | | Package | Version |
|---|---|---|---|---|
| @commonpub/schema | **0.51.0** | | @commonpub/infra | **0.10.0** |
| @commonpub/config | **0.24.0** | | @commonpub/editor | **0.9.0** |
| @commonpub/protocol | **0.14.0** | | @commonpub/explainer | **0.8.0** |
| @commonpub/auth | 0.8.0 | | @commonpub/docs | 0.6.3 |
| @commonpub/server | **2.97.0** | | @commonpub/learning | 0.5.2 |
| @commonpub/ui | 0.13.1 | | @commonpub/test-utils | **0.5.8** |
| @commonpub/layer | **0.86.10** | | @commonpub/theme-studio | 0.6.1 |
| create-commonpub (crates.io) | **0.5.19** (pins ^0.49/^2.94/^0.86.7/config ^0.23 — STALE: re-pin to schema ^0.51 / config ^0.24 / server ^2.97 / infra ^0.10 / layer ^0.86.10 on next CLI bump) | | | |

**Session 227 email Phase 1 + 1b (2026-06-25) — SHIPPED + ROLLED to all 3.** Foundational
durable email pipeline + unsubscribe. **schema 0.51.0 / infra 0.10.0 / server 2.97.0 /
layer 0.86.10, migration 0036** (additive `email_outbox`). Replaces the broken
fire-one-fetch-per-recipient send path with an outbox + a throttled/batched/retrying
worker (`drainEmailOutbox`, FOR UPDATE SKIP LOCKED, backoff, dead-letter) gated by
`emailNotifications`; instant + digest now ENQUEUE; auth mail still sends directly. Adds
RFC 8058 unsubscribe (HMAC token, `unsubscribedAll` pref, `List-Unsubscribe` header +
footer link + `pages/unsubscribe.vue` + `POST /api/unsubscribe`). **No flags changed;
email stays OFF in prod** so the worker is inert until enabled. Server suite 1511 / layer
1417 / typecheck 28/28; live-verified end-to-end (follow→enqueue→worker-sent→unsubscribe
→suppression). Detail: `docs/sessions/227-email-phase1-outbox.md`. Plan:
`docs/plans/email-comms-overhaul.md` (Phase 2 templates + Phase 3 broadcast remain).

**Session 227 GDPR consent Phase 1 (2026-06-25) — SHIPPED + ROLLED to all 3.** Records
site-wide terms/CoC acceptance + completes the data export. **schema 0.50.0 / config
0.24.0 / server 2.96.0 / layer 0.86.9, migration 0035** (additive: `user_consents` table
+ `users.accepted_terms_at/version`). `recordConsent` writes an audit row on signup (via
the `onUserCreated` hook); the register page gained a required acceptance checkbox;
`exportUserData` now includes consents/votes/hub-memberships/enrollments/events/RSVPs/
contest-entries/contest-PII/agreements (GDPR Art. 20 completeness) + fixes a latent
ambiguous-`id` bug in the content export subquery. `instance.termsVersion` (default '1')
config added. Server suite 1501 / layer 1412 / typecheck 28/28; live-verified. Plans
authored: `docs/plans/gdpr-consent-hardening.md` (Phase 2 = re-acceptance + cookie record,
not built), `docs/plans/email-comms-overhaul.md` (not built), analysis
`docs/reference/email-gdpr-scaling-analysis.md`. Detail: `docs/sessions/227-gdpr-consent-phase1.md`.

**Session 227 entry-detail draft gate (2026-06-25) — SHIPPED + ROLLED to all 3.** Earlier
same session: `server 2.95.0 / layer 0.86.8` (no schema bump). `GET /api/contests/:slug/
entries/:entryId` 404s a draft-placeholder entry for non-entrant/non-privileged viewers;
detail page hides the dead "View the project" link. PR #57. Detail:
`docs/sessions/227-entry-detail-draft-gate.md`.

**Session 227 (2026-06-25) — SHIPPED + ROLLED to all 3.** Entry-detail draft gate
(residual from 226's A2), **server 2.95.0 / layer 0.86.8** (no schema bump, no
migration; latest stays 0034). `GET /api/contests/:slug/entries/:entryId` now 404s a
draft-placeholder entry for a non-entrant/non-privileged viewer (the listing already
hid it; the direct-URL path was ungated). `getContestEntry` returns the backing
`contentStatus`; the detail page hides the "View the project" link for a draft viewed
by a non-entrant (public content page is author-only for drafts). Server suite 1498 /
layer 1410 / typecheck 28/28; live-verified (draft → anon/third-party 404,
entrant/admin 200; published → all 200). PR #57. Detail:
`docs/sessions/227-entry-detail-draft-gate.md`.

**Session 226 (2026-06-25) — SHIPPED + ROLLED to all 3.** Contest P2 fixes + UX polish,
**server 2.94.0 / layer 0.86.7** (no schema bump, no migration; latest stays 0034).
Task A: race-safe contest votes (`onConflictDoNothing` — was an unhandled 500 on concurrent
votes); `listContestEntries` hides draft proposal placeholders from non-privileged callers
(viewer still sees their own → `myEntries` intact; count mirrors the filter); `email` fields
default to PII (explicit `pii:false` opts out), `address` stays always-PII. Task B: contest
subheading 5-line clamp, tab-band `focusTab` guard + `scrollIntoView`, submit-dialog
`aria-labelledby`, ContestBannerAdjust `:focus-visible` + zero-rect drag guard. Server suite
1497 / layer 1405 / typecheck 28/28; verified locally vs real Postgres + live route. CLI
**create-commonpub 0.5.19** (crates.io). PR #55 (main), PR #56 (CLI bump). Detail:
`docs/sessions/226-contest-p2-and-ux-polish.md`.

**Session 225 (2026-06-25) — SHIPPED + ROLLED to all 3** (commonpub.io, deveco.io, heatsynclabs.io;
all health 200, heatsync entries route 200 = migration 0034 live). Contest entry-flow fixes:
(1) the hero "Submit Entry" CTA now routes proposal / per-stage-form stages to the Entries tab + scrolls
to the form (was always opening the attach-a-project dialog), and the attach option is now available in
proposal mode too; (2) **proposal-withdraw orphan fix** — withdrawing a proposal entry archives its draft
placeholder project instead of orphaning it, via a new `contest_entries.placeholder` marker (**migration
0034**, additive) archived on withdraw only when the placeholder is still a draft. Plus Task C contest-field
tests. **schema 0.49.0 / server 2.93.0 / layer 0.86.6.** Detail: `docs/sessions/225-contest-entry-flow-audit.md`.

**Session 224 (2026-06-24):** theme-wide contrast a11y pass — readable `--*-text` tokens (each vivid
semantic `color-mix`ed toward `--text`, >=4.5:1 small text on light AND dark, browser-verified
5.07-12.82:1). Swept `color: var(--vivid)` → `--vivid-text` across ~110 components/pages (fills/borders
+ dark-overlay badges keep raw vivid; accent stays brand/link except named status cases). Shipped
**layer 0.86.4**, then a deep audit found the same bug in surfaces the sweep skipped → **layer 0.86.5**
extends it to the **bundled theme CSS** (`.cpub-tag-*`/`.cpub-badge-*`/form-error/prose-checkpoint in
components/layouts/forms/prose/editor-panels.css), `layouts/default.vue` avatar, the dormant
`@commonpub/ui` Badge/Input (source-ahead, rides next ui publish), and the **deveco/heatsync forked
homepage badges**. All 3 rolled to `^0.86.5`. Log: `docs/sessions/224-theme-contrast-a11y.md`.

**Session 223 (2026-06-24):** more live-feedback polish on top of 222, all visually verified + rolled to 3.
**layer 0.86.1** = video/embed 16:9 via `aspect-ratio` (prose `:deep(iframe){height:auto}` was collapsing
the iframe). **0.86.2/0.86.3** = readable inline `<code>`: new `--code-inline` token (theme `--teal`
`color-mix`ed 50% toward `--text`, `@supports` + `var(--text)` fallback) — verified 6.46:1, was ~2.4:1.
**Landmine:** `layers/base/theme/*.css` is GITIGNORED (bundle-theme copies from `packages/ui/theme/` at
publish; the layer nuxt.config falls back to `packages/ui/theme` when the bundle is absent, e.g.
commonpub.io). Edit theme CSS in **`packages/ui/theme/`**, NOT `layers/base/theme/` (0.86.2 edited the
bundle, got reverted on publish → 0.86.3 fixed it in source).

**Session 222 (2026-06-24):** contest-page UX from live feedback — banner/cover **Fit** fix
(ContestBannerAdjust → explicit Fill/Fit/Zoom; Fit shows the whole image, drag works), **cover
placement** (`coverPlacement` about/hero, **migration 0033**), **tabs** redesigned to a centered nav band,
**subheading** unclamped, **video/embed size** control (S/M/L/Full). Published **schema 0.48.0 / editor
0.9.0 / server 2.92.0 / layer 0.86.0**, create-commonpub **0.5.18**. All changes visually verified locally
(seeded contest + Playwright) before shipping. Rolled to all 3.

**Session 221 (2026-06-24):** contest builder UX **Phases 2/4/5/6** shipped to all 3.
Published **schema 0.47.0 / server 2.91.0 / layer 0.85.0** (config unchanged); **migration 0032**
(additive `contests.banner_meta` + `cover_meta` jsonb) applied on all 3 via hard-fail `db-migrate.mjs`.
create-commonpub bumped to **0.5.17**. P2 = field presets + whole-form templates + per-stage block
intro (`instructionsBlocks`); P4 = non-destructive banner/cover zoom (`bannerMeta`/`coverMeta`, shared
`imageFramingStyle`); P5 = hero→tabs gap; P6 = Judges Showcase upload/reorder/import-panel. All 3
verified live (health + /contests + /api/contests = 200; commonpub.io flags ON, deveco/heatsync OFF).

**Session 219 (2026-06-23):** published the 9 changed packages above (everything that had
moved on main since the 2026-06-17 publish) and **rolled all 3 instances to current** —
commonpub.io (local layer, main), deveco.io + heatsynclabs.io (pins → schema ^0.46.0 /
config ^0.23.0 / server ^2.90.0 / layer ^0.83.2). Both consumer deploys applied **migrations
0026–0031** via hard-fail `db-migrate.mjs` = success (incl. **destructive 0031** dropping the
dead `contests.content_format` + `contests.judges` columns). All 3 verified live (health +
homepage + /contests = 200). Packaging gotcha hit + fixed: pnpm's publish packer cannot exclude
test files under a Nuxt bracketed route dir (`server/api/content/[id]/__tests__/`) via ANY glob —
the fix is to RELOCATE the test to a bracket-free `__tests__` (layer 0.83.0/0.83.1 leaked it →
deveco CI typecheck red; 0.83.2 clean). `pnpm pack` (NOT `npm pack`) is the reliable leak detector.
**Follow-up:** bump create-commonpub pins + republish to crates.io.

Latest migration: **0031** (session 211) — **applied on ALL 3** as of session 219 (deveco/heatsync
rolled from 0025 → 0031 in one deploy). **0031** `contest_phase6_drop_dead_cols` (DROP dead
`contests.content_format` + `contests.judges`) · **0030** `contest_phase4_pii_agreements` (PII +
agreement partition tables) · **0028/0029** contest block-body columns + `prizesBlocks`. **0027**
`audit204_indexes_dedup` (hot-read composite indexes on `content_items` + new `processed_activities`
inbox-replay-dedup and `digest_runs` multi-replica-claim tables). **0026** `remote_like_count` (column
on `content_items`/`hub_posts` + backfill so reconcile-counters can't wipe federated likes). Both
additive. **0025** (session 201, applied on all 3) — adds `contest_stakeholders.role`
(`reviewer`|`editor`) AND seeds the 5 RBAC system roles + permission sets + backfills `user_roles`
(`ON CONFLICT DO NOTHING`, idempotent). Prior: **0024** (session 199, scheduled-publishing fields) ·
**0023** (per-field contest text formats, session 197; the now-deprecated `content_format` column from
**0022** is left inert — drop it in a later interactive generate).

**Stoa theme (session 190, ui 0.10.0 / layer 0.63.0):** new built-in theme family (light + dark) —
warm paper, moss accent, Fraunces/Newsreader/Work Sans, soft rounded geometry; shares Agora's Town
Square logo. The instance default-theme **fallback changed `base` → `stoa`**, so fresh installs and
any instance without an explicit `theme.default` now default to Stoa Light. commonpub.io keeps its
explicit `agora-dark` (set Stoa in admin → Appearance to switch). deveco/heatsync were **not bumped**
(left on layer 0.62) so their themes are untouched; bump their pins to make Stoa available there.

Migrations applied this cycle: **0016**–**0019** (contest stages, see below) · **0020**
(`metrics_daily` — public-API analytics rollups, session 190; additive CREATE TABLE + indexes,
`dimension` NOT NULL `''`). The CLI `template.rs` pins go stale on every config/layer/schema/server
publish — **DONE (session 191): create-commonpub 0.5.8 published to crates.io** pinning schema ^0.35 /
config ^0.19 / server ^2.82 / layer ^0.64, default theme → Stoa, `db:migrate` recommended,
`NUXT_REDIS_URL` fixed, `article` dropped. Re-bump these constants after the next package publish.

Contest overhaul (2026-06-04, schema 0.27.0 / server 2.74.0 / layer 0.49.0, all 3 instances):
optional `contests.coverImageUrl` (cards prefer it cover-cropped → contained banner → trophy);
ContestHero redesigned (full-width banner band like content pages + 2-col body with countdown
beside the title/details + status pill); contest create/edit forms gained a cover-image upload;
**prizes are now entirely optional** (the form stopped pre-filling 3 prize rows that survived the
submit filter). Verified live on deveco (`/contests` cards + the redesigned detail hero).

Contest **Phase A** stage lifecycle + editor polish (2026-06-04, schema 0.28.0 / server 2.75.0 /
layer 0.50.0, migration 0017, all 3 instances): two new statuses **`draft`** + **`paused`**;
**bidirectional** transitions (go-back / pause-resume / reopen) via a shared `VALID_TRANSITIONS` map
(server + client mirror in ContestHero & edit.vue); **`showPrizes`** off-switch for the Prizes tab;
**editable slug** (auto-from-title on create, manual override, 409 on collision); compact
contest-card countdown (was dominating the card). **Security fix:** `draft` contests are now
owner/admin/stakeholder/judge-only *regardless of visibility* (`canViewContest` + `listContests`) —
a public draft was previously world-readable + listed. Verified live: deveco
`the-resilient-communities-challenge` returns `showPrizes:true` (migration 0017 confirmed). The
**expanded Phase B plan** (arbitrary multi-round contests — proposal rounds, Top-N selection gates,
sprint/interim stages, multiple judging rounds, event/showcase stages, with the standard 3-step flow
as the synthesized default) is in `docs/plans/contest-stages-and-editor-polish.md`, split into B1
(dynamic stages display + manual progression), B2 (cohorts/advancement + per-round scoring), B3
(submission templates + teams).

Contest editor follow-up (layer **0.51.0**, all 3): the ContestHero countdown is now **stage-aware**
— an `upcoming` contest counts down to its **open** date (label "Opens in"), `judging` to the
judging deadline, `active` to submission close; once a target passes it shows a static date instead
of a frozen 00:00:00. The contest **create + edit forms gained a sticky bottom action bar**
(Save/Create always reachable + live status) instead of a buried button at the end of a long scroll.

Contest **Phase B1 — dynamic stages engine** (2026-06-04, schema 0.29.0 / server 2.76.0 / layer
0.52.0, migration 0018, all 3): contests can now define an arbitrary, ordered **stage timeline**
(`contests.stages` jsonb + `current_stage_id`) — proposal rounds, a Top-N selection, a build sprint,
multiple judging rounds, a showcase event — each with a name, kind, and dates. `stages = []` ⇒ the
server synthesizes the classic Submissions → Judging → Results, so existing contests are unchanged
(the standard flow is the zero-config default). **Design:** `status` stays the behavioural source of
truth for gating; stages are a display/planning overlay (so the ~67 status refs weren't rewired).
New: `ContestStagesEditor.vue` (add/dup/reorder/rename/kind/dates + mark-current + reset) in
create/edit; ContestSidebar renders the dynamic timeline; ContestHero shows the current-stage chip.
Pure helpers `synthesizeStages`/`normalizeStages`/`currentStage` (server + a layer mirror in
`utils/contestStages.ts`); transition map de-duped into `utils/contestTransitions.ts`. **Phase B2**
(per-entry cohorts + Top-N advancement + per-round scoring) remains the next chunk — additive jsonb
fields, no migration. Plan: `docs/plans/contest-stages-and-editor-polish.md`.

Contest **Phase B2 — cohorts & Top-N advancement** (2026-06-04, schema 0.30.0 / server 2.77.0 /
layer 0.53.0, migration 0019, all 3): `contest_entries.stage_state` jsonb tracks per-entry cohort
outcome. `advanceContestStage` applies a review stage's **cut** — top-N by score (deterministic
tiebreak) or a manual pick — snapshots the round's score/rank, moves `currentStageId` to the next
stage, and notifies entrants (advanced / not advanced). Idempotent per stage. `calculateContestRanks`
+ `listContestEntries` are cohort-scoped (eliminated entries excluded from final ranks). New:
`POST /api/contests/[slug]/advance`; a per-review-stage "Advance top N" control on the contest edit
page; Advanced / Not-advanced badges on entry cards. This delivers the "Resilient America" Top-50 →
sprint → final-judging flow. **Deferred (documented in the plan):** cohort-scoped *judging gating*
(eliminated entries are excluded from ranks but can still technically be re-scored), a manual-pick
UI (the API supports it), and true per-round score isolation. This is the last planned phase of the
contest stages epic.

Contest **editor UX pass** (2026-06-04, layer **0.55.0**, all 3): fixed the extracted
`ContestStagesEditor` rendering raw/unstyled inputs — Vue scoped CSS doesn't cross component
boundaries, so the component now carries its own tokenised `cpub-form-*` control styles (the date
fields were cramped monospace boxes with stacked, not 2-column, layout). The contest **edit** page is
now a **two-column layout** (wide content column + a sticky meta rail holding Stage & Status, Entry
rules, Danger Zone; full-width sticky save bar). Stages editor gained a prominent top **Add stage /
Reset** toolbar. Stage array-ops extracted to pure `utils/contestStages.ts` functions with 10 unit
tests. NOTE: layer **0.54.0 is a broken interim** (a forms.css globalisation edit was reverted
mid-flight, leaving inputs unstyled) — deprecated on npm; use 0.55.0+.

Contest **multi-round judging** (2026-06-04, schema 0.31.0 / server 2.78.0 / layer 0.56.0, all 3, no
migration — `criteria` is additive jsonb on the existing `stages`): **per-review-stage rubric** (each
`review` stage can carry its own `criteria`; the judge page uses the current round's, falling back to
the contest rubric) → Round 1 scores on *Feasibility*, Round 2 on *Deployment readiness*.
**Cohort-gated judging** (`judgeContestEntry` rejects eliminated entries; the judge page lists only
the surviving cohort + shows the current round name + count). **Stage-kind clarity**: the stages
editor explains what each kind does, and review stages get a per-round criteria sub-editor.
**Voting is advisory** — never affects ranks/cuts; only judge scores do. The full Resilient-America
build walkthrough is in the plan. KNOWN GAP (deferred): judge scores are single-slot, not keyed by
round — a 2nd judging round overwrites the live score (round aggregate is snapshotted in
`stage_state`); proper fix = tag `judgeScores` by `stageId`.

Contest **per-round advance count + end-to-end test** (2026-06-04, schema 0.32.0 / server 2.79.0 /
layer 0.57.0, all 3, no migration): review stages now carry an **`advanceCount`** (the Top-N
"winners" of that round) — set in the stages editor; the Advancement control pre-fills it. Added a
full **end-to-end integration test** exercising the whole multi-round flow (stages w/ per-round
criteria + advanceCount → submit → round-1 judging → Top-N cull → round-1 snapshot → cohort gate
blocks eliminated in round 2 → re-score → complete → final ranks exclude the eliminated). Server
suite 1259, layer 917 green.

Contest **per-round score isolation + em-dash copy sweep** (2026-06-04, schema 0.33.0 / server 2.80.0
/ layer 0.58.0, all 3, no migration): **per-round score isolation** closes the last judging gap —
each judge score is tagged with its review-round id (`JudgeScoreEntry.roundId`); a judge has one
score per round; the entry's live `score` aggregates **only the current round**, so a second judging
round no longer overwrites/blends with the first (earlier rounds stay in `judgeScores` tagged by
round, as history). The judge page pre-fills only the current round's score. Verified by the
end-to-end test (A keeps round-1 = 90 + round-2 = 85; live score = 85). **Em-dash sweep:** all
rendered site copy in the layer had em dashes replaced (335 occurrences; comments left untouched;
curly apostrophes deliberately kept inside single-quoted strings). **UX:** the contest editor's
Stages section now has an orienting note tying Stages (timeline) ↔ Status (what's open) ↔
Advancement (the cut) ↔ Current (highlight). The contest stages epic is now feature-complete with no
known judging gaps.

Contest **manual-pick advancement UI** (2026-06-04, layer **0.59.0**, all 3, layer-only): the edit
page's Advancement section now offers, per review stage, a **Top N** vs **Pick manually** toggle.
Manual mode lists the eligible (non-eliminated) cohort with checkboxes + each entry's score, and
"Advance N selected" → `POST /advance` with `mode: 'manual'`. (The API already supported manual; this
exposes it.) Contest stages epic: nothing left on the original plan.

Contest editor **dirty-state save + adversarial test review** (2026-06-04, layer **0.60.0**): the
edit form now tracks dirty state — editing any field (e.g. checking an eligible content type) flips
the save bar to "Unsaved changes" and enables Save ("Saved" when clean). Fixes the report that
checking a box "didn't light up the save button" (the button had no dirty feedback; empty
eligible-types correctly = "any type allowed"). Dirty uses a `nextTick`-armed hydration guard so it
can't get stuck off. **Adversarial test review:** found the advancement + e2e tests had scores in
insertion order (so an insertion-order cull bug would pass) — rewrote them so the lowest scorer is
submitted first/mid, and **mutation-tested** (replacing the score-sort with insertion order makes
both tests fail), proving they verify score-based selection, not coincidence.

Recent UI follow-ups (2026-06-03): contest hero banner 260→195px (layer 0.46.0); deveco.io mobile-nav
hamburger fixed (its forked `layouts/default.vue` used bare `<MobileNavRenderer>` → unresolved;
now `<NavMobileNavRenderer>`); **contest list cards now show the bannerUrl cover image** (16:9
cover-cropped thumb + grid/trophy fallback + status-badge overlay + whole-card link, layer 0.48.0).
CLI now auto-publishes: push a `create-commonpub-v*` tag → `cli-release.yml` (the
`CARGO_REGISTRY_TOKEN` secret is set; validated publishing 0.5.4 / 0.5.5 / 0.5.6).
Avatar oval fix (layer 0.47.0): deveco blog byline/author/card avatars rendered as tall ovals even
on wide viewports — the `<img>` fell back to its intrinsic aspect ratio on one axis (NOT flex
compression). Fixed by hard-locking `.cpub-av`/`.cpub-cc-av` to a square via `min/max` on **both**
width and height (driven by a `--cpub-av-size` var), which clamps the used size no matter what
sets/drops a dimension. Verified live on deveco.

### Live flags per instance
| Instance | federation | seamless | actAsRegistry | announceToRegistry | **rbac** | role |
|---|---|---|---|---|---|---|
| commonpub.io | ✅ | ✅ | ✅ | ✅ (self-skips) | ✅ **ON** | **the registry** |
| deveco.io | ✅ | ✅ | ❌ | ✅ | ✅ **ON** (pre-existing override) | mirrors heatsync; seamless w/ commonpub |
| heatsynclabs.io | ✅ | ❌ | ❌ | ✅ | ❌ OFF | mirrored by deveco |

> **rbac (session 201):** seeded on all 3 (migration 0025); effective only where the override is ON.
> commonpub.io + deveco.io are ON (deveco via a pre-existing override that became active once seeded —
> its `staff` users are now moderators). Toggle per instance on `/admin/roles`. `curl /api/features | jq .rbac`.

Registry config defaults (`@commonpub/config`): `registryUrl = https://commonpub.io`,
`registryPingIntervalMs = 21_600_000` (6h), `announceToRegistry` default **true**, `actAsRegistry`
default **false**.

### Repos & infra
- Main monorepo: `commonpub/commonpub` (this repo) — also builds commonpub.io.
- `devEcoConsultingLLC/deveco-io` → deveco.io.
- `heatsynclabs/heatsynclabs-io` → heatsynclabs.io (droplet `167.99.13.109`).

### Landmines (learned the hard way — see `feedback_*` memories)
- **Caret semver on 0.x doesn't cross minors:** `^0.17.0` ⊉ `0.18.0`. Hand-edit consumer pins.
- **Layer publish** only via `pnpm run publish:layer` (workspace:* leak otherwise).
- **npm propagation lag** — poll `npm view` before a publish-dependent install/deploy.
- **Verify flag/version state empirically** — memory & handoffs go stale (federation was claimed
  "off" but was live; heatsync was claimed `db:push` but now uses `db-migrate.mjs`).
- **Warn-only health checks** on deveco/heatsync deploys — curl-verify, don't trust `gh run`.
- **`siteUrl` host must == `instance.domain`** per instance, or mirror requests/registry pings 401.
  (All 3 currently satisfy this: actor host == domain.)
- **Nuxt env vars only override DECLARED `runtimeConfig.public.features` keys.**
- **Two-config-version skew is harmless** — the Zod default is applied by each app's *direct* config
  dep via `defineCommonPubConfig`, not by server's internal copy.
- **Mastodon inbox-*forwarded* activities are now rejected** by the actor↔signer binding (we don't
  forward; direct delivery is unaffected). If a Mastodon reply-thread shows dropped activities, that's why.

---

## `contests` branch — MERGED + LIVE on commonpub.io ONLY (session 216, 2026-06-23)

**Merged to `main` (`00139353`) and deployed to commonpub.io. deveco.io + heatsynclabs.io are
NOT updated** (no npm publish this roll — the reference app builds from `workspace:*`, so commonpub.io
ships from the monorepo; the other two consume npm packages and were intentionally left untouched per
operator instruction). Deploy run `28019122283` = success; migrations **0028-0031** applied via the
deploy `db-migrate` path; `/api/health` 200; new flags `contestProposals`/`contestPii` present + **OFF**;
`/`, `/contests`, `/hubs`, `/docs`, `/learn`, `/videos` all 200. The 108-commit merge shipped BOTH the
**monolith-splits backlog** (sessions 205-210) and the **contest elevation** initiative (211-216).

**Deep audit before the deploy (3 agents, all clean):** migrations GO (additive + metadata-only DROP on
the tiny `contests` table, each in its own tx); security all-PASS (133 tests — PII isolation, CSV
formula-injection, B5a, no unauth 500s, monolith-splits invite-IDOR + like/boost tx fixes); flags
safe-OFF at every layer. One irreversible change: migration 0031 DROP COLUMN of already-dead
`judges`/`content_format`.

**Still pending for deveco/heatsync (NOT done):** the npm publish chain (schema → config → server → ui →
layer via `pnpm run publish:layer`) + bump their pins + both lockfiles + CLI. Until then those two
instances lag main. **Behavior change to flag when they roll:** contest Full-HTML `neutralizeColors` (ON
by default). The contest plan: `docs/plans/contest-elevation.md`; ADR `docs/adr/029-contest-proposal-pii-model.md`;
rolling handoff `docs/sessions/211-contest-elevation.md`.

### What the `contests` branch contained (now on main)
Gates at merge: schema **475**, server **1490**, layer **1223**, all app+package typechecks 0.

**Landed (all atomic, tested):**
- **Phase 1** bug fixes + primitives: transactional `createContest`/`withdrawContestEntry`, race-safe
  `addContestJudge`, emoji removed; enum-derived validators; `utils/datetime` + `CpubDateTimeField`
  (UTC datetime-local fix); `color-scheme` on `:root` + dark themes; dark-mode-safe Full-HTML
  (`neutralizeColors`); `?tab=` deep links; `searchUsers` + contest-scoped user-search.
- **Phase 2** unified block editor: ONE `ContestEditor.vue` (create ≡ edit thin shells); BlockTuple[]
  body in `descriptionBlocks`/`rulesBlocks`/`prizesBlocks` (migrations 0028/0029); `judgesShowcase`
  block; canvas tabs (Overview/Rules/Prizes/Stages/Judging); media strip; Write/Preview/Code + autosave.
- **Phase 3** display redesign: slim compact-bar hero, cover lead image, hydration-mismatch fixes,
  one date formatter.
- **Phase 4** submission paths: flags `contestProposals` + `contestPii` (default OFF); field types
  email/number/select/checkbox/date/agreement/address; `submissionMode: attach|proposal`; PII partition
  (`contest_entry_private_fields` + `contest_agreement_acceptances`, migration 0030) + `contest.pii`
  permission; `submitContestProposal` (draft placeholder); proposal form UI. Server monolith decomposed
  into the `contest/` module DAG.
- **Phase 5** judging + export: B3 (judge criteriaScores validated vs the rubric, rubric max
  authoritative); holistic scale standardized 0-100; per-card aria-live judge UX; CSV export
  (`contest/export.ts`, formula-injection-safe `toCsv`, PII columns gated on `contest.pii`).
- **Phase 6 (non-release)**: dropped dead `contests.judges` + `content_format` (migration **0031**);
  B5a (judge route asserts entry belongs to its `:slug`); score/rank denormalization documented + sync
  test.

**Release (when you give the go-ahead)** — per the runbook above, dependency order:
- **Changed publishable set:** `@commonpub/schema` (cols/validators/PII tables), `@commonpub/config`
  (the two new flags), `@commonpub/server` (contest threading + decomposition + export + B3 + B5a),
  `@commonpub/ui` (theme CSS), `@commonpub/layer` (components/routes). Bump schema → config → server →
  ui → layer (`pnpm run publish:layer`), then deveco/heatsync pins + BOTH lockfiles + CLI.
- **Migrations to commit + deploy:** 0028, 0029, 0030, 0031 (all apply via the deploy `db-migrate`
  path; never `db:push` to prod).
- **The new flags ship default OFF** — no behavior change until an operator enables them. The one
  Phase-1 behavior change to flag in release notes: contest Full-HTML `neutralizeColors` is ON by
  default (existing hardcoded-color HTML renders the theme baseline).
- This roll also clears the still-pending 203/204 + 209/210 work to deveco/heatsync.
