# Session 189 — Contest stages: Phase A (lifecycle + editor polish) + expanded Phase B plan

Date: 2026-06-04

## What was done

Shipped **Contest Phase A** to all 3 instances (schema 0.28.0 / server 2.75.0 / layer 0.50.0,
migration 0017):

- **Two new statuses** — `draft` (not launched) + `paused` (deactivated, not cancelled). Enum
  extended additively (`0017`: `ADD VALUE 'draft' BEFORE 'upcoming'`, `'paused' BEFORE 'judging'`).
- **Bidirectional transitions** — `VALID_TRANSITIONS` rewritten so you can go back a stage, pause &
  resume, and reopen a cancelled/completed contest. Owner-gated; rank-calc on `completed` is
  idempotent so re-completing after a go-back is safe. A client mirror of the map drives the inline
  controls in `ContestHero` + `edit.vue` (data-driven buttons, not hardcoded).
- **`showPrizes`** boolean (default true) — explicit off-switch for the Prizes tab even when prize
  data exists. Wired through schema → validators → server types/mappings/create/update → detail-page
  gate + both forms.
- **Editable slug** — `create.vue` auto-derives from title (manual override); `edit.vue` lets you
  rename, server enforces uniqueness (throws `SLUG_TAKEN` → 409), and on rename the edit page
  navigates to the contest *view* page (a fresh route component — navigating to the new `/edit` URL
  would reuse the same component with a stale fetch key).
- **Compact contest-card countdown** — `CountdownTimer` gained a `compact` one-line variant
  (`Nd HHh MMm`, no boxes/seconds); cards only show it for `active`/`upcoming` (per screenshot, the
  flip-clock dominated the card).
- New states rendered everywhere: hero pill + side panel (paused/draft notices), sidebar timeline +
  status chip, card status badge.

### Audit (ultrathink) findings + fixes (shipped in the same release)

1. **Draft-visibility leak (security).** `canViewContest` only gated `private`, and `listContests`
   matched `public` regardless of status → a `public` `draft` was world-readable + listed. Fixed:
   `draft` is now owner/admin/stakeholder/judge-only **regardless of visibility** in BOTH functions.
   Regression tests added (per-contest gate + list exclusion).
2. **Slug-rename navigation.** Was navigating to the new `/edit` URL (same component reused → stale
   `useLazyFetch` key). Now navigates to the contest view page.
3. **Empty-slug guard.** `slugify(x) || undefined` so an all-symbols input doesn't POST `''` (would
   fail the validator regex → 400).
- `updateContest` slug self-collision logic verified safe (it `.select()`s all columns, so
  `existing[0].id`/`.slug` are present).

### Expanded Phase B plan

Wrote the **arbitrary multi-round contests** design into
`docs/plans/contest-stages-and-editor-polish.md`, motivated by the real "Resilient America" schedule
(proposals open → judges pick Top 50 → 8-week hardware sprint → final judging → finale/showcase in
D.C.). New capabilities identified beyond the v1 sketch: per-stage **submission mode** (proposal vs
full vs update), an **advancement/cull gate** (Top N → per-entry `stageState`), a **working/interim**
stage, **multiple judging rounds**, and an **event/showcase** stage. A single `contestRuntime(contest)`
helper derives all behaviour from `status` + `currentStageId` + `stages`; `normalizeStages` synthesizes
the classic 3 stages when `stages` is empty so the **standard flow stays the zero-config default**.
Split into **B1** (dynamic stages: display + manual progression), **B2** (cohorts & advancement +
per-round scoring — the hard part), **B3** (submission templates + teams — deferred).

### Codebase-analysis updated

`02` (migration 0017 row + count 18 + contest_status enum), `03` (bidirectional transitions +
draft-gate on canViewContest/listContests), `09` (new invariant: draft is an access gate orthogonal
to visibility; gate it in BOTH functions; keep client/server transition maps in sync).

## Verification

- Server contest suite green (1248 pass, +2 new tests); schema suite green (418); reference-app
  `nuxt typecheck` clean.
- All 3 deployed + curl-verified: commonpub.io 200 (hard-fail pipeline ⇒ migration 0017 applied);
  deveco 200 + `the-resilient-communities-challenge` returns `showPrizes:true`; heatsync 200.

## Follow-up (same session, layer 0.51.0)

- **Stage-aware hero countdown:** `upcoming` now counts down to the **open** date ("Opens in"),
  `judging` to the judging deadline, `active` to submission close. A passed target falls back to a
  static date note instead of a frozen 00:00:00 clock.
- **Sticky editor save bar:** contest create + edit forms got a `position: sticky; bottom: 0` action
  bar (Save/Create + Cancel + live status) so the primary action is always reachable — the prior
  editor was one long scroll with the Save button buried at the bottom.
- Layer-only change → published 0.51.0, deployed all 3 (commonpub builds layer from source; deveco +
  heatsync pin bumped). All 3 health 200.

## Phase B1 — dynamic stages engine (same session, schema 0.29.0 / server 2.76.0 / layer 0.52.0)

Built the dynamic stage timeline (migration 0018: `contests.stages` jsonb + `current_stage_id`):

- **Schema/validators:** `ContestStage` type + `contestStageSchema`; `stages`/`currentStageId` in
  create/update.
- **Server (pure, tested):** `synthesizeStages` (classic trio from status+dates, stable ids) /
  `normalizeStages` (explicit-or-synthesized — standard flow is the default) / `currentStage`
  (resolve `currentStageId` else derive from status). Persist on create/update + a **stale-pointer
  guard** that drops a `currentStageId` not present in the stages array. New `contest-stages.test.ts`
  + an integration test for persistence/guard.
- **Layer:** `ContestStagesEditor.vue` (add/duplicate/reorder/rename/kind/dates + mark-current radio
  + reset-to-standard) wired into create + edit; ContestSidebar renders the dynamic timeline;
  ContestHero shows the current-stage chip. Helpers mirrored in `utils/contestStages.ts` (don't
  bundle the server into the browser).
- **Separation of concerns / audit:** the form pages grew only +22/+21 lines (the editor + helpers
  are extracted). The duplicated `VALID_TRANSITIONS` + status-action labels in ContestHero and
  edit.vue were collapsed into a single `utils/contestTransitions.ts`.
- **Key decision:** `status` remains the behavioural source of truth for gating; stages are a
  display/planning overlay → the ~67 hardcoded status refs were NOT rewired (that, plus per-entry
  cohorts + Top-N advancement + per-round scoring, is Phase B2).

Audit: no cruft/debug leftovers; create/update routes pass `stages`/`currentStageId` through
(spread, not cherry-picked); server suite 1256 + layer 907 green; reference typecheck clean.

## Phase B2 — cohorts & Top-N advancement (same session, schema 0.30.0 / server 2.77.0 / layer 0.53.0)

The cull (migration 0019: `contest_entries.stage_state` jsonb):

- **Server (tested):** `advanceContestStage(db, contestId, userId, {reviewStageId, mode:'topN'|'manual', topN?, advancedEntryIds?})` — owner-gated, review-stage only; splits the surviving cohort into advancers + eliminated, snapshots round score/rank into `stage_state`, moves `currentStageId` to the next stage, notifies entrants. **Idempotent per stage** (replaces that stage's rows). `isEliminated` helper. `calculateContestRanks` excludes eliminated (jsonb `NOT @>` filter); `listContestEntries` surfaces `stageState` + derived `eliminated`. Tests: topN cull + snapshot + currentStageId move + rank-scoping + idempotency + owner/review guards.
- **API/UI:** `contestAdvanceSchema` + `POST /api/contests/[slug]/advance`; a per-review-stage "Advance top N" control in the edit page's new Advancement section; Advanced / Not-advanced badges (+ dimmed cards) in ContestEntries.
- **Decision:** `status` still gates submissions/judging; B2 adds the cohort cull + rank-scoping but does NOT yet cohort-scope judging itself (eliminated entries are excluded from ranks/results but could still be re-scored). Per-round score isolation + a manual-pick UI are deferred (documented in the plan). This is the last planned phase of the epic.

Audit (post-B2): server suite 1258 + layer 907 green; reference typecheck clean; the new server exports were threaded through both barrels (`contest/index.ts` + `index.ts`); no cruft.

## Contest editor UX pass (same session, layer 0.55.0)

User feedback: the editor was "one long column," the stages editor inputs were unstyled
("what the fuck is going on"), and adding stages was unclear. Audit root cause: the extracted
`ContestStagesEditor` used `cpub-form-*` classes that only existed in the parent pages' `<style
scoped>` — Vue scoped CSS doesn't cross component boundaries, so the component's inputs fell back to
raw browser defaults (cramped monospace datetime; `cpub-form-row` lost its grid → stacked dates →
tall rows → "Add stage" buried). Exactly [[feedback_css_scope_component_extraction]].

Fixes:
- **Component self-contained:** `ContestStagesEditor` now carries its own tokenised `cpub-form-*`
  control styles. (A first attempt to globalise them into `theme/forms.css` was reverted mid-flight
  — leaving 0.54.0 broken/deprecated — so the self-contained approach is the shipped one; 0.55.0.)
- **Two-column edit layout:** wide `cpub-edit-main` + sticky `cpub-edit-side` rail (Stage & Status,
  Entry rules, Danger Zone); full-width sticky save bar; container widened to 1080px.
- **Stages discoverability:** top toolbar with Add stage / Reset.
- **Architecture + tests:** stage array-ops (add/duplicate/move/remove/seed) extracted to pure
  `utils/contestStages.ts`; 10 unit tests in `utils/__tests__/contestStages.test.ts` (917 layer green).
- All form CSS tokenised (var(--space-*)/--text-sm/--font-sans/--accent/--shadow-accent).

Process note: caught myself sitting in long blocking `gh run` poll loops to watch deploys (user
interrupted one) → new memory [[feedback_no_long_deploy_poll_loops]]: one-shot check, don't loop.

## Multi-round judging (same session, schema 0.31.0 / server 2.78.0 / layer 0.56.0)

Prompted by "how would multi-round judging/voting work" + the real Resilient America brief (two
review rounds with different criteria). Audit found 4 gaps; closed 3, documented 1:
- **G1 per-review-stage rubric:** `ContestStage.criteria` (additive jsonb, no migration); judge page
  uses the current review stage's criteria, falls back to contest-level. Stages editor gained a
  per-review-stage criteria sub-editor.
- **G2 cohort-gated judging:** `judgeContestEntry` rejects eliminated entries; judge page lists only
  the surviving cohort. Tested.
- **G4 round awareness:** judge page shows the current review stage name + cohort count.
- **Stage-kind clarity:** `STAGE_KIND_HELP` map; the editor explains what each kind does.
- **Voting** clarified as advisory (never drives ranks/cuts; judge scores do).
- **G3 per-round score isolation = KNOWN GAP (deferred):** scores are single-slot; a 2nd round
  overwrites the live score (round aggregate snapshotted in `stage_state`). Proper fix = tag
  `judgeScores` by `stageId`. (Tried a reset-on-advance half-measure, reverted — doesn't handle the
  interim-between-rounds case + broke the test.)
- Full **Resilient America build walkthrough** written into the plan (5 stages + cull + per-round
  rubrics). Everything except G3 is supported today.

## Per-round advance count + end-to-end test (same session, schema 0.32.0 / server 2.79.0 / layer 0.57.0)

- **`ContestStage.advanceCount`** (additive jsonb) — define the Top-N "winners" of a review round as
  part of the contest plan; the stages editor sets it, the edit-page Advancement control pre-fills it.
  Was previously only an ad-hoc number at advance time.
- **End-to-end integration test** (the user asked to "run the flow end to end"): a full multi-round
  run — stages w/ per-round criteria + advanceCount → submit 3 → round-1 judging → Top-2 cull →
  round-1 snapshot → cohort gate blocks the eliminated entry in round 2 → re-score → complete →
  final ranks (B=1, A=2, eliminated=null). Validates the whole pipeline together.
- Audit: moved `advanceN`/`advancing` refs above the contest loader in edit.vue (the loader pre-fills
  `advanceN` — declaring it after risked an SSR temporal-dead-zone crash; cf. provider-inject guard).

## Decisions

- Kept the `status` enum as the coarse lifecycle; fine-grained "which round" will live in
  `currentStageId` (Phase B), not by exploding the enum.
- Phase A intentionally on the *existing* status model (no `stages` jsonb yet) — independently
  shippable, de-risks B.

## Open questions / next

- **Phase B1** is the next build (dynamic stages display + editor + manual progression).
- Carryover (unchanged): e2e draft PR #7 (prod-env config for 7 auth pages); P3 mirror-request
  approve flow (needs admin login on 2 instances).
