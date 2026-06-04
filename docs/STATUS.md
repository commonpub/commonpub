# CommonPub — Status & Operator Runbook

> **Living doc — your "come back later" reference.** Snapshot taken 2026-06-04 (session 189).
> Verify any version/flag claim before trusting it: `npm view @commonpub/<pkg> version`,
> `curl https://<instance>/api/features`, `cargo search create-commonpub`.
> Companion docs: the plan `docs/plans/federation-discovery-and-hardening.md`, the work log
> `docs/sessions/188-federation-release.md`, the rolling handoff `docs/sessions/185-kickoff-next.md`.

---

## TL;DR — where things stand

Federation discovery & hardening (Phases 0–4) is **shipped and live on all 3 instances**, and
**commonpub.io is now the default discovery registry** — every instance announces to it by default.
All npm packages are published with zero source-vs-published drift; the `create-commonpub` CLI is
published to crates.io. `main` is clean. The only federation feature not yet exercised end-to-end is
the **P3 mirror-request approve flow** (needs an admin login on two instances).

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
- **GitHub Actions Node 20 deprecation** — `actions/checkout@v4` etc. forced to Node 24 on 2026-06-16.

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
2. **Verify green:** `pnpm typecheck` (expect 26/26) + the suites (`pnpm --filter @commonpub/<pkg> test`).
3. **Publish in dependency order**, polling `npm view @commonpub/<pkg> version` between each:
   `schema → config → protocol → auth → server → ui → layer`.
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

### Published versions (verified 2026-06-04)
| Package | Version | | Package | Version |
|---|---|---|---|---|
| @commonpub/schema | **0.33.0** | | @commonpub/infra | 0.8.0 |
| @commonpub/config | **0.18.0** | | @commonpub/editor | 0.7.11 |
| @commonpub/protocol | 0.13.0 | | @commonpub/explainer | 0.7.15 |
| @commonpub/auth | 0.8.0 | | @commonpub/docs | 0.6.3 |
| @commonpub/server | **2.80.0** | | @commonpub/learning | 0.5.2 |
| @commonpub/ui | 0.9.2 | | @commonpub/test-utils | 0.5.6 |
| @commonpub/layer | **0.60.0** | | create-commonpub (crates.io) | **0.5.7** |

Migrations applied this cycle: **0016** (`contests.cover_image_url`) · **0017** (`contest_status`
+draft/+paused; `contests.show_prizes`) · **0018** (`contests.stages` jsonb + `contests.current_stage_id`
— Phase B1) · **0019** (`contest_entries.stage_state` jsonb — Phase B2 cohorts).

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
| Instance | federation | seamless | actAsRegistry | announceToRegistry | role |
|---|---|---|---|---|---|
| commonpub.io | ✅ | ✅ | ✅ | ✅ (self-skips) | **the registry** |
| deveco.io | ✅ | ✅ | ❌ | ✅ | mirrors heatsync; seamless w/ commonpub |
| heatsynclabs.io | ✅ | ❌ | ❌ | ✅ | mirrored by deveco |

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
