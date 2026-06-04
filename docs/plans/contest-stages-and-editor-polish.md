# Contest stages engine + editor polish

> Plan created session 188 (2026-06-04). Contests are **instance-local** (no federation surface),
> which keeps this change contained to schema + server + the layer UI. Ships to all instances via a
> schema migration + server + layer release.

## Deep analysis — the current contest lifecycle (what we're replacing)

- **`contestStatusEnum`** (`packages/schema/src/enums.ts`): `upcoming | active | judging | completed
  | cancelled`. Fixed, linear.
- **`VALID_TRANSITIONS`** (`server/src/contest/contest.ts`): forward-only —
  `upcoming→[active,cancelled]`, `active→[judging,cancelled]`, `judging→[completed,cancelled]`,
  `completed→[]`, `cancelled→[]`. No going back, no pause.
- **`transitionContestStatus(db, contestId, userId, newStatus)`**: owner-gated; validates the map;
  on `completed` runs `calculateContestRanks`; fires entrant notifications (active/judging/
  completed/cancelled) + winner-aware congrats on completed.
- **3 fixed dates**: `startDate`, `endDate`, `judgingEndDate`.
- **Derived 4-step timeline** (ContestSidebar): Opens → Submissions close → Judging → Results, from
  `STATUS_ORDER[status]` + the 3 dates.
- **Hero**: countdown to `endDate` (or `judgingEndDate` while judging); status pill; Submit CTA only
  when `status==='active'`.
- **~67 hardcoded `'active'|'judging'|…'` references** across `layers/base/components/contest/*`,
  `layers/base/pages/contests/*`, and `server/src/contest/*` — the blast radius.

## Goals (from the request)

1. De-activate a contest **without cancelling** (a reversible "paused" state).
2. **Go back a stage** (bidirectional progression).
3. **Add / duplicate / arbitrarily name stages**, keeping a required core — e.g. two judging
   rounds, multiple submission rounds, an arbitrary dated milestone.
4. The stage timeline must **display well everywhere** it's surfaced (hero countdown, sidebar
   timeline, status pill, cards, tabs, edit-page controls).
5. **Completely turn off the Prizes tab** at will.
6. Editor page (create/edit) **full UI/UX polish**.
7. Architecturally **elegant**.

## Architecture (recommended) — explicit ordered stages, jsonb

Match the existing `prizes` / `judgingCriteria` jsonb-array pattern on `contests` (idiomatic here;
no join; trivially reorderable/duplicable; no separate table to keep in sync). Contests aren't
queried by stage, so jsonb is the right tradeoff.

```ts
// contests table (migration 0017)
stages: jsonb('stages').$type<Array<{
  id: string;                                   // stable uuid — survives reorder/duplicate/rename
  name: string;                                 // arbitrary ("Round 1", "Finalist Judging")
  kind: 'submission' | 'judging' | 'results' | 'custom';  // drives BEHAVIOUR
  startsAt?: string;                            // ISO, optional
  endsAt?: string;                              // ISO deadline, optional (countdown target)
  core?: boolean;                               // required stage — can't delete (≥1 submission)
}>>().default([]),
currentStageId: text('current_stage_id'),       // active stage; null ⇒ not running (draft/paused)
```

- **`status` enum keeps coarse lifecycle**, extended additively: add `'draft'` (not launched) +
  `'paused'` (deactivated-not-cancelled). `completed`/`cancelled` stay terminal. Fine-grained
  "which round" lives in `currentStageId` → the current stage's `kind`/`name`.
- **Behaviour derives from the current stage**, not a status string:
  - Submissions open ⟺ `currentStage.kind === 'submission'` and status `running`.
  - Judging UI ⟺ `currentStage.kind === 'judging'`.
  - Rank calc ⟺ entering a `results` stage (or `completed`).
  - Countdown ⟺ `currentStage.endsAt`.
  - Status pill ⟺ `currentStage.name` (fallback to status).
- **Bidirectional transitions** replace `VALID_TRANSITIONS`: owner can set `currentStageId` to ANY
  stage (forward or back), `pause` (status→paused, keep currentStageId for resume), `resume`,
  `cancel`, `complete`. Re-entering an earlier stage is allowed; rank-calc is idempotent.
- **Back-compat (no data migration of rows):** a `normalizeStages(contest)` helper synthesizes the
  classic stages from `status` + the 3 dates when `stages` is empty — legacy contests render
  identically. New/edited contests persist explicit `stages`. The 3 date columns stay (the first
  submission stage's `startsAt`/`endsAt` mirror `startDate`/`endDate` for compat + OG/SEO).
- **Prizes tab toggle:** add `showPrizes boolean` (default true) — tab shows when `showPrizes &&
  (prizes.length || prizesDescription)`. Empty prizes already hide it; the flag is the explicit
  off-switch even when data exists.

## Touch points (the ~67 references + UI)

- schema: `stages`, `currentStageId`, `showPrizes`, enum `+draft,+paused`, migration 0017.
- validators: `contestStageSchema`, stages array, currentStageId, showPrizes in create/update.
- server: `normalizeStages`, `currentStage(contest)`, replace `transitionContestStatus` with
  `setContestStage`/`pauseContest`/`resumeContest` (+ keep a thin status setter); generalize
  notifications to stage changes; rank-calc on results/complete.
- layer: ContestHero (stage-aware countdown + pill), ContestSidebar (render dynamic stages),
  contest detail (stage-aware CTA + owner stage controls + prizes-tab toggle), cards (stage-aware),
  create/edit forms (**stages editor**: add/dup/reorder/rename/kind/dates + polish + prizes toggle).
- codebase-analysis: 02 (new columns/migration), 03 (lifecycle fns), 05 (components), 09 (the
  stage-derivation invariant).

## Phasing

- **Phase A — editor polish + lower-risk lifecycle — ✅ DONE (session 189, code-complete + tested,
  release pending):** create/edit UI/UX polish; `paused` + `draft` states; **bidirectional**
  transitions (go-back / deactivate-pause / resume / reopen) on the EXISTING status model, derived
  from a shared `VALID_TRANSITIONS` map (server + a client mirror in hero & edit); `showPrizes`
  off-switch; **editable slug** (auto-from-title on create, manual override + 409-on-collision);
  compact contest-card countdown. Hero/sidebar/cards/detail all render the new states.
  - **Audit fixes shipped with it:** (1) **draft-visibility leak** — `canViewContest` +
    `listContests` now treat `draft` as owner/admin/stakeholder/judge-only *regardless of
    visibility* (a `public` draft was world-readable + listed); regression tests added. (2)
    slug-rename navigates to the contest **view** page (a fresh route component) — navigating to the
    new `/edit` URL would reuse the same component with a stale fetch key. (3) empty-slug guard.
  - **Bidirectional map (authoritative):** `draft→[upcoming,active,cancelled]`,
    `upcoming→[draft,active,cancelled]`, `active→[upcoming,paused,judging,cancelled]`,
    `paused→[active,upcoming,judging,cancelled]`, `judging→[active,paused,completed,cancelled]`,
    `completed→[judging]`, `cancelled→[draft,upcoming]`. Rank-calc on entering `completed` is
    idempotent, so re-completing after a go-back is safe.

- **Phase B — the dynamic stages engine** (see the next section for the expanded design). Split into
  **B1** (dynamic stages: display + manual progression), **B2** (cohorts & advancement + per-round
  scoring), **B3** (submission requirement templates + teams). The big refactor of the ~67
  hardcoded status references.

Phase A was independently shippable and de-risks Phase B.

---

## Arbitrary multi-round contests — the expanded Phase B (the "Resilient America" shape)

> Motivating real example (a contest organiser's actual schedule):
> 1. **Launch, proposals open, the joint workgroup forms** — entrants submit *proposals* (an idea +
>    plan), not finished projects.
> 2. **Judges select the Top 50 Innovators** — a judging round that *culls* the field; only the
>    top 50 advance.
> 3. **The eight-week hardware sprint** — the advancing cohort *builds*; they refine their existing
>    entries (add the functional prototype). No new entrants.
> 4. **Final judging of functional prototypes** — a *second* judging round, on the survivors.
> 5. **Finale & showcase at the EDGE AI FOUNDATION event in Washington, D.C.** — results announced,
>    tied to a real-world dated/located event.
>
> The standard flow (Submissions → Judging → Results) **stays the zero-config default**; this engine
> is opt-in for organisers who need more. Contests remain **instance-local** (no AP surface), so
> none of this federates.

### What the example demands (beyond the v1 stages sketch above)

The original sketch (`kind: submission|judging|results|custom`) already covers *multiple named
rounds + arbitrary dated milestones*. The example adds four genuinely new capabilities:

1. **Submission *mode* / *requirements* per stage** — a "proposal" round wants lighter content than
   a "prototype" round (and an *update* round wants edits, not new entries).
2. **An advancement / cull gate** (the Top 50) — after a judging round, narrow the cohort.
   Introduces **per-entry, per-stage state** (`active` / `advanced` / `eliminated`). This is the
   hard part.
3. **A working/sprint stage** — submissions locked to the cohort; entries become *editable* but no
   new entrants.
4. **An event/showcase stage** — a dated milestone with a location/URL.

### Stage model (jsonb on `contests`, matches the `prizes`/`judgingCriteria` idiom)

```ts
type StageKind =
  | 'submission'   // accept entries (new and/or edits)
  | 'review'       // judges score; optional advancement cut at the end
  | 'interim'      // a working period (sprint): cohort refines entries, no new entrants
  | 'results'      // publish ranks for the current cohort
  | 'event'        // a real-world milestone/showcase (date + place)
  | 'custom';      // arbitrary dated marker, no behaviour

interface ContestStage {
  id: string;            // stable uuid — survives reorder / duplicate / rename
  name: string;          // arbitrary ("Proposals Open", "Top 50 Selection", "Hardware Sprint", "Finale — D.C.")
  kind: StageKind;
  startsAt?: string;     // ISO
  endsAt?: string;       // ISO — the countdown target while this stage is current
  core?: boolean;        // a default-flow stage; can't be deleted (≥1 submission required)

  // kind-specific config — all optional, with sane per-kind defaults:
  submission?: {
    mode?: 'proposal' | 'full' | 'update';   // copy + which entry template (B3)
    accepts?: 'new' | 'edits' | 'none';       // default: 'new' for submission, 'edits' for interim
    requirements?: string;                    // markdown: what to submit/refine this round
    eligibleContentTypes?: string[];          // per-round override of contest-level eligibility
  };
  review?: {
    rubricRef?: 'default' | string;           // which judging criteria set (default = contest rubric)
    visibility?: ContestJudgingVisibility;    // per-round score visibility
    advance?: { mode: 'topN' | 'manual'; topN?: number };  // the cull gate, applied at stage end
  };
  event?: { location?: string; url?: string };
}
```

On `contests`: `stages: jsonb<ContestStage[]>.default([])` + `currentStageId: text` (null ⇒ not
running — draft/paused/completed). On `contest_entries` (B2 only):
`stageState: jsonb<Array<{ stageId; status: 'active'|'advanced'|'eliminated'; score?; rank? }>>`.
The existing `contest_entries.score/rank/judgeScores` columns stay the **live/current-round** working
set; advancing past a `review` stage snapshots that round into `stageState`. **The default
single-round flow never writes `stageState`** → byte-for-byte unchanged behaviour for normal contests.

### The elegant core: one runtime helper, no scattered status checks

`contestRuntime(contest)` derives every behaviour from `status` + `currentStageId` + `stages`, so the
~67 hardcoded `status === 'active'|…` checks collapse to reads off one object:

- `currentStage` = `stages.find(currentStageId)` (or the synthesized classic stage).
- `acceptsNewEntries` ⟺ running ∧ `currentStage.kind==='submission'` ∧ `submission.accepts==='new'`.
- `acceptsEdits` ⟺ `currentStage` is a `submission`(accepts:'edits') or an `interim`.
- `inJudging` ⟺ `currentStage.kind==='review'`.
- `countdownTarget` = `currentStage.endsAt`; `pill/label` = `currentStage.name` (fallback `status`).
- `cohort` = entries not `eliminated` in `stageState` (everyone, until a cull happens).

### Back-compat — the standard flow is the synthesized default

`normalizeStages(contest)`: when `stages` is empty, synthesize the classic three —
`submission`(endsAt=`endDate`, core) → `review`(endsAt=`judgingEndDate ?? endDate`, core) →
`results`(core) — and map `status` → `currentStageId`. Legacy + standard contests render **exactly
as today**; only contests that explicitly define `stages` get the rich engine. The `status` enum
(draft…cancelled) is untouched — it stays the coarse lifecycle; the fine-grained "which round" lives
in `currentStageId`.

### The stages editor (create/edit)

An ordered, reorderable list (drag handle): per row — name, kind, dates, a collapsible kind-specific
panel (submission mode/accepts/requirements; review rubric/visibility/advance-topN; event
location/url), and a `core` lock. Add / **duplicate** / reorder / delete (non-core). Two presets:
**Standard** (the 3-step, default) and **Multi-round** (proposals → selection → sprint → final
judging → finale) that seeds the Resilient-America shape in one click. Reuse the existing
`grid-layout-plus`/`@vue-dnd-kit` primitives already vetted for the layout editor — don't add a new
dnd lib.

### Phasing (de-risked)

- **B1 — dynamic stages (display + manual progression). ✅ DONE (session 189, schema 0.29.0 /
  server 2.76.0 / layer 0.52.0, migration 0018).** `stages` jsonb + `currentStageId` +
  `synthesizeStages`/`normalizeStages`/`currentStage` (pure, server + a layer mirror in
  `utils/contestStages.ts`); `ContestStagesEditor.vue` (add/duplicate/reorder/rename/kind/dates +
  mark-current + reset-to-standard) wired into create + edit; ContestSidebar renders the dynamic
  timeline; ContestHero shows the current-stage chip. Kinds: `submission`/`review`/`interim`/
  `results`/`event`/`custom`. **Decision (de-risk):** `status` stays the behavioural source of truth
  for gating — stages are a display/planning overlay, so the ~67 status refs were NOT rewired.
  `currentStageId` is owner-set (the "Current" radio) and tolerated/guarded when stale. No cull yet
  (cohort = everyone). This makes all five Resilient-America stages real, named, dated, ordered, and
  displayed. One additive migration. Transition-map duplication (hero/edit) was also collapsed into
  `utils/contestTransitions.ts`.
- **B2 — cohorts & advancement. ✅ DONE (session 189, schema 0.30.0 / server 2.77.0 / layer 0.53.0,
  migration 0019).** `contest_entries.stage_state` jsonb; `advanceContestStage` applies a review
  stage's cut (`topN` by score with deterministic tiebreak, or `manual` pick), snapshots round
  score/rank, moves `currentStageId`, and notifies entrants (advanced / not advanced). Idempotent
  per stage. `calculateContestRanks` + `listContestEntries` are cohort-scoped (eliminated excluded
  from ranks; `eliminated` surfaced). `POST /api/contests/[slug]/advance` + a per-review-stage
  "Advance top N" control on the edit page; ContestEntries shows Advanced / Not-advanced badges.
  **Deferred:** per-round scores are snapshotted into `stage_state` but the next round still reuses
  the live `score`/`rank` columns (re-scoring overwrites — acceptable); manual-pick has no dedicated
  UI yet (API supports it); submission/judging gating isn't yet cohort-scoped (eliminated entries
  could still be re-scored — they're just excluded from ranks/results).
- **B3 — submission requirement templates + teams (defer).** Proposal-vs-prototype field templates
  & per-stage requirement checklists; and — separately — team/workgroup formation ("the joint
  workgroup forms"), which is really a generic *teams* concern, not contest-specific. Keep out of
  B1/B2; model later.

## How multi-round judging + voting actually work (session 189)

- **Judging is per-review-stage.** Each `review` stage can carry its own `criteria` rubric
  (`ContestStage.criteria`, jsonb — no migration). The judge page uses the **current review stage's**
  criteria, falling back to the contest-level `judgingCriteria` when a stage defines none. So Round 1
  can score on *Feasibility* and Round 2 on *Deployment readiness*.
- **Judging is cohort-scoped.** `judgeContestEntry` rejects entries that were eliminated at a prior
  review cut; the judge page only lists the surviving cohort. So Round 2 judges exactly the finalists.
- **Voting never decides outcomes.** Community voting (`communityVotingEnabled`) is a single,
  advisory tally per entry — an "audience favourite" signal. It does NOT affect ranks or advancement;
  only judge **scores** drive `calculateContestRanks` and the Top-N cull. For an expert-panel contest
  (like Resilient America) leave voting off.
- **Per-round score isolation is the one remaining gap.** Entries carry a single live `score`; the
  round's aggregate is snapshotted into `contest_entries.stage_state` on advance, but a later round
  reuses the live `score` (re-scoring overwrites). For two judging rounds separated by a sprint, the
  finalists still show their Round-1 score until re-judged. Proper fix = store judge scores keyed by
  `stageId` (judgeScores tagged per round, `score` computed per current round). Deferred — documented
  as the next judging task.

## Worked example — building the Resilient America Challenge

Five stages (Stages editor), with the cull + per-round rubrics:

1. **"Proposals open"** — `submission`, `endsAt` = proposal deadline (June). Description: "Publish your
   blueprint — no prototype yet." Status → `active`.
2. **"Top 50 Selection"** — `review`, criteria = *Community impact / Technical merit / Feasibility*.
   Judges (the joint workgroup) score every proposal; the organiser runs **Advance top 50** → the 50
   advance, the rest are marked "not advanced". Status → `judging` for this round.
3. **"Hardware Sprint"** — `interim` (≈8 weeks, July–Aug). The 50 refine their entries (add prototype
   repo + writeup + demo); no new entrants. Description spells out the required final submission.
4. **"Final Judging"** — `review`, criteria = *Community impact/usefulness / Technical quality /
   Deployment readiness*. Judges score ONLY the 50 (cohort-scoped). Status → `judging`.
5. **"Finale — Washington, D.C."** — `event`, `location` = "Washington, D.C.", date = Sept 18; then
   **Complete** the contest → `calculateContestRanks` over the final-round scores → grand prize.

Prizes tab optional; visibility `public`; voting off (expert panel). Everything except per-round
score isolation (gap above) is supported today.

### Sanity check against the example

| Organiser's stage | Engine expression | Phase |
|---|---|---|
| Proposals open + workgroup forms | `submission` (mode `proposal`, requirements text); teams deferred | B1 (B3 for true proposal template; teams later) |
| Judges select Top 50 | `review` with `advance:{mode:'topN', topN:50}` | shape in B1, **enforced** in B2 |
| 8-week hardware sprint | `interim` (accepts `edits`), 8-week dates | B1 |
| Final judging of prototypes | second `review`; per-round scores | B1 shape, B2 scoring |
| Finale & showcase, D.C. | `event` (location, date) | B1 |

So **B1 makes the whole timeline real and visible**; only the cull-to-50 and per-round scoring truly
need **B2**. That split is the natural seam: B1 = "the schedule is real everywhere"; B2 = "the
competition mechanics are real." The standard flow is the default throughout.
