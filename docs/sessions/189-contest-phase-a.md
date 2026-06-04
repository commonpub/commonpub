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

## Decisions

- Kept the `status` enum as the coarse lifecycle; fine-grained "which round" will live in
  `currentStageId` (Phase B), not by exploding the enum.
- Phase A intentionally on the *existing* status model (no `stages` jsonb yet) — independently
  shippable, de-risks B.

## Open questions / next

- **Phase B1** is the next build (dynamic stages display + editor + manual progression).
- Carryover (unchanged): e2e draft PR #7 (prod-env config for 7 auth pages); P3 mirror-request
  approve flow (needs admin login on 2 instances).
