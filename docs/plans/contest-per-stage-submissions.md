# Plan: Contest per-stage submission artifacts (proposal → prototype)

> Status: in progress (session 193, 2026-06-09). Scope + design confirmed with
> the maintainer: **project-based entry + per-stage template fields**, **per-stage submissions only**
> (teams / per-entry judge assignment / timeline-clarity are out of scope).
>
> **Refinements at implementation time (session 193 recon):** the new column ships as
> **migration 0021** (0020 was taken by `metrics_daily`), generated via `drizzle-kit generate` so
> the snapshot chain stays consistent. Submit gate = `status === 'active'` (status stays
> gating-truth) AND the stage is the resolved `currentStage` AND `kind === 'submission'` with a
> non-empty template. `listContestEntries` gains `includeStageSubmissions` (privileged) + a
> viewer-id path so entrants always see their own artifact; new `getContestEntry` powers the
> detail page. Judge display resolves the artifact from the nearest `submission` stage preceding
> the current review stage.

## Context

A multi-phase contest like the "Resilient America" timeline needs entrants to submit **different
artifacts at different stages** — a *proposal* (summary, focus area, approach) at the proposal stage,
a *prototype* (repo URL, demo video, docs) at the prototype stage. The contest **engine is already
complete**: dynamic stages (`contests.stages` jsonb, 6 kinds), per-round judging with `roundId`
isolation + per-stage `criteria`, cohort culling (`stageState` advanced/eliminated), the
`advanceContestStage` Top-N/manual cut + `calculateContestRanks`, AND the admin advancement UI
(`pages/contests/[slug]/edit.vue` `advanceStage`/`advanceStageManual`). The **one real gap**: an
entry is a single `contentId` (a published project) with no per-stage artifact, so a proposal and a
prototype can't be captured separately and judges can't see "the proposal" vs "the prototype."

**Chosen model (project + per-stage fields):** the entry stays a content item (the team's evolving
project page); each *submission* stage defines a **template** (required fields), and the entry stores
a **per-stage artifact** (the filled field values, snapshotted). Judges/viewers see the artifact for
the stage. Reuses the entire judging/advancement machinery; additive; one migration.

**Scope:** per-stage submissions only (templates + artifacts + submit form + judge display +
entry-detail view). Teams, per-entry judge assignment, and the timeline/status-clarity work are NOT
in scope.

**Standing rules:** new flag `features.contestStageSubmissions` (rule 2 — gates the template editor +
submit surfaces; default ON, but inert until an organizer adds a template to a stage, so additive).
Committed migration via the deploy db-migrate path (rule: never hand-edit prod) following the
0017–0019 contest pattern. TDD — server logic tested first (rule 11); axe on new components (rule 12).
No AI attribution (rule 15). `var(--*)` only in component CSS (rule 3).

---

## Phase A — Data model + server + template editor (organizer side)

**Schema** (`packages/schema/src/`):
- `contest.ts`: extend `ContestStage` with `submissionTemplate?: Array<{ key: string; label: string;
  type: 'text' | 'textarea' | 'url'; required: boolean; help?: string }>` (jsonb on `stages` →
  **no migration**, mirrors how `criteria`/`advanceCount` were added). Add a new column
  `contest_entries.stageSubmissions jsonb default '[]' notNull` typed
  `Array<{ stageId: string; fields: Record<string,string>; submittedAt: string }>` → **migration 0020**
  (additive column, exactly like `stageState`/0019).
- `validators.ts`: `submissionTemplateFieldSchema` (key `^[a-z0-9_]+$` max 40, label max 120, type
  enum, required bool, help max 300) added to `contestStageSchema` (`.max(50)`); `stageSubmissionSchema`
  for the submit payload — `{ stageId, fields: z.record(z.string().max(4000)) }` with per-field type
  validation (url fields via the existing URL refinement; required fields present; cap field count).

**Config** (`packages/config/`): add `contestStageSubmissions` to `FeatureFlags` + schema default ON;
declare in `layers/base/nuxt.config.ts` `runtimeConfig.public.features` (the env-propagation landmine),
`useFeatures`, and the `/admin/features` flag list.

**Server** (`packages/server/src/contest/`):
- New `submitStageArtifact(db, entryId, stageId, fields, userId)`: verify the entry is the user's;
  the stage exists, is `kind: 'submission'`, has a template, and is the contest's current (open)
  stage; **cohort gate** — for a later submission stage, reject if `isEliminated(entry)` (reuse the
  existing helper); validate `fields` against the stage's `submissionTemplate`; upsert the
  `stageSubmissions` row for that `stageId` (replace while the stage is open); return the updated entry.
- Include `stageSubmissions` in `listContestEntries`/a `getContestEntry(db, entryId)` for privileged
  viewers (judges/owner/admin) + the entrant themselves.
- Reuse as-is: `submitContestEntry` (entry creation/contentId unchanged), `normalizeStages`/
  `currentStage`, `isEliminated`, `judgeContestEntry`, `advanceContestStage`.

**Organizer UI** (`layers/base/components/contest/ContestStagesEditor.vue`): for `submission`-kind
stages, a **template-fields editor** (add/set/remove field rows: key/label/type/required/help),
mirroring the existing per-round `criteria` editor (`addCriterion`/`setCriterion`/`removeCriterion`).
Field array ops in `layers/base/utils/contestStages.ts` (+ tests) alongside the existing stage ops.

**Tests:** server integration (submit a proposal artifact; required/url validation; cohort gate
rejects an eliminated entry; re-submit replaces; non-owner rejected); `contestStages` util tests for
the template field ops; validator unit tests.

## Phase B — Entrant submit UI + entry-detail + judge display

**API** (`layers/base/server/api/contests/[slug]/`): `entries/[entryId]/submission.put.ts` →
`submitStageArtifact`; a `entries/[entryId].get.ts` (or extend `entries.get.ts`) returning an entry +
its `stageSubmissions` for the detail/judge views (privilege-gated like the score visibility).

**UI** (`layers/base/`):
- `components/contest/ContestStageSubmission.vue` — renders the **current submission stage's** template
  fields for the entrant to fill/edit (driven by `submissionTemplate`), saving via the API. Shown on
  `pages/contests/[slug]/index.vue` to an entrant who has an entry (and, for a later submission stage,
  is not eliminated). Reuses the `cpub-form-*` styles + the dirty-save pattern from the contest edit form.
- `pages/contests/[slug]/entries/[entryId].vue` — the **entry-detail / artifact viewer**: the content
  summary + each stage's submitted artifact in a timeline (proposal fields, then prototype fields) +
  scores when privileged. This is the "proposal viewer / prototype viewer," parameterized by stage.
  Entry cards in `ContestEntries.vue` link here instead of straight to the content item.
- `pages/contests/[slug]/judge.vue` — show the entry's `stageSubmissions` (most-recent artifact for the
  round being judged) inline + a link to the detail view, beside the existing per-round rubric.

**Tests:** component + axe on `ContestStageSubmission` + the entry-detail view; a test that submitting
required fields emits the right payload and that url fields validate.

---

## Files (representative)
- **schema:** `packages/schema/src/contest.ts` (ContestStage.submissionTemplate + stageSubmissions
  column + types), `validators.ts` (template + submission schemas), new migration
  `packages/schema/migrations/0020_*.sql`.
- **config:** `packages/config/src/{types,schema}.ts` (flag).
- **server:** `packages/server/src/contest/contest.ts` (`submitStageArtifact`, entry getters), `index.ts` export.
- **layer:** `nuxt.config.ts` (flag), `server/api/contests/[slug]/entries/[entryId]/submission.put.ts`
  + `[entryId].get.ts`, `components/contest/ContestStagesEditor.vue` + `ContestStageSubmission.vue`,
  `pages/contests/[slug]/{index,judge}.vue` + `entries/[entryId].vue`, `utils/contestStages.ts`,
  `composables/useFeatures` + `/admin/features`.

## Reused (not rebuilt)
The whole judging/advancement engine (`judgeContestEntry`, `advanceContestStage`,
`calculateContestRanks`, `currentStage`/`normalizeStages`, `isEliminated`), the stages editor +
per-round `criteria` editor pattern, `submitContestEntry`, the entry listing + score-visibility
gating, and the `cpub-form-*` + dirty-save patterns from `edit.vue`.

## Tracking
TaskCreate: P-A (data+server+template editor), P-B (submit UI + detail + judge display), Release.

## Docs + codebase-analysis updates
- `docs/reference/guides/` — a contest "multi-stage submissions" guide section (how to define a stage
  template + the entrant/judge flow), and refresh the Resilient-America walkthrough.
- `docs/sessions/NNN-*.md` + the rolling handoff; `codebase-analysis/` (contest schema +
  flag count + the new entry-detail component); ADR addendum for the per-stage-artifact model.

## Release
One epic release after both phases verify green: bump schema (minor — new column + types), config
(minor — flag), server (minor — `submitStageArtifact`), layer (minor — UI + routes). Publish order
`schema → config → server → … → layer`; **apply migration 0020 via the deploy db-migrate path**
(committed, hard-fail), PR + squash-merge (commonpub.io builds from source + runs migrations on
deploy); bump CLI `template.rs` pins (schema/config/server/layer) + crate. deveco/heatsync remain
operator-gated.

## Verification
- `pnpm --filter @commonpub/server test` (the new `submitStageArtifact` integration cases + existing
  contest suite), schema + config tests, layer component + axe tests, `pnpm typecheck`, full build.
- **Migration:** run `0020` against a scratch Postgres + confirm `stageSubmissions` defaults `[]` and
  existing rows are unaffected (additive).
- **End-to-end on commonpub.io after deploy** (behind the flag): create a contest with a 2-template
  flow (Proposals stage template + Prototype stage template); as an entrant, submit a project + fill
  the proposal fields; as the organizer, run the Screening Top-N cut; confirm only advanced entrants
  can fill the Prototype template; as a judge, confirm the proposal artifact shows in round 1 and the
  prototype artifact in round 2; confirm the entry-detail view shows both artifacts in a timeline.
