# Session 194 — Contest per-stage submission artifacts (proposal → prototype)

> 2026-06-09. Implements `docs/plans/contest-per-stage-submissions.md` (authored session 193),
> both phases in one pass. Released schema 0.39.0 / config 0.21.0 / server 2.84.0 / layer 0.71.0,
> migration **0021** (additive `contest_entries.stage_submissions jsonb default '[]'`).

## What was done

**Phase A — data model + server + template editor**
- `ContestStage.submissionTemplate` (`{key,label,type:text|textarea|url,required,help}[]`, jsonb on
  `stages` → no migration) + new `ContestStageSubmission` type and
  `contest_entries.stageSubmissions` column (migration `0021_thick_speed.sql`, drizzle-generated).
- Validators: `submissionTemplateFieldSchema` (key `^[a-z0-9_]+$`, unique-key refine on the stage),
  `stageSubmissionSchema` (bounded record, ≤50 keys, ≤4000 chars/value).
- New flag `features.contestStageSubmissions` — default ON, inert until a template exists. Declared
  on all 5 surfaces (config types+schema, layer `nuxt.config.ts` runtimeConfig features, `useFeatures`
  interface/DEFAULT_FLAGS/computed, admin features flagMeta) — the env-propagation landmine is covered.
- Server `submitStageArtifact(db, entryId, stageId, fields, userId)`: owner-only; `status === 'active'`
  (status stays gating-truth) + stage must be the resolved `currentStage`, `kind === 'submission'`,
  non-empty template; cohort gate via `isEliminated`; per-template validation in the pure
  `validateStageArtifactFields` (unknown keys rejected, required non-blank, url = `https?://` +
  `new URL` parse — known-bad payloads like `javascript:alert(1)` are red in tests); upsert-by-stage
  inside a `FOR UPDATE` transaction (same lost-update pattern as judgeScores).
- `listContestEntries` opts: `includeStageSubmissions` (privileged) + `stageSubmissionsViewerId`
  (entrant's own rows). New `getContestEntry(db, entryId)` enriched single-entry getter.
- `ContestStagesEditor`: "Submission form, this stage" panel on `submission` stages (add/edit/remove
  field rows), mirroring the per-round criteria editor; pure array ops in `utils/contestStages.ts`
  (`withTemplateFieldAdded/Set/LabelChanged/Removed`, `fieldKeyFromLabel`) — keys auto-derive from
  the label and pin once hand-edited.

**Phase B — entrant submit UI + entry detail + judge display**
- API: `PUT /api/contests/:slug/entries/:entryId/submission` (flag-gated, validates the entry belongs
  to the slug's contest) and `GET /api/contests/:slug/entries/:entryId` (privilege-gates judgeScores,
  honours `shouldRevealScores`, strips artifacts unless privileged/entrant/flag-on).
  `entries.get.ts` now rides artifacts along for privileged viewers + the entrant's own entries.
- `ContestStageSubmission.vue`: template-driven artifact form on the contest page's Entries tab —
  pre-fills from the existing artifact, multi-entry picker, dirty-gated save, required/help a11y.
- `pages/contests/[slug]/entries/[entryId].vue`: entry-detail page — content summary card + the
  stage-ordered artifact timeline (template-labelled; orphaned keys still render — never drop data);
  public-safe when the server stripped artifacts. Entry cards in `ContestEntries.vue` link here.
- `judge.vue`: shows the round's artifact (nearest `submission` stage preceding the current review
  stage) inline beside the rubric + an "All submissions" link. Classic contests render unchanged.

**Tests** (all green): 13 server integration cases (happy path, upsert-replace, owner/stage/current/
template gates, not-active, adversarial cohort gate with lowest-scorer-submitted-first, pure validator
domain checks), 6 schema validator cases, +1 config default, 6 util cases, 9 `ContestStageSubmission`
component cases + axe, 6 entry-detail page cases + axe. Full suites: server 92 files / 1338 passed,
layer 53 files / 959 passed, schema 449, config 25, `pnpm typecheck` 28/28, full build green.

## Decisions made

- **Migration is 0021** (plan said 0020, but `0020_spooky_gideon` was taken by `metrics_daily`).
  Generated via `drizzle-kit generate` so the snapshot chain stays consistent.
- Submit gate = `active` + current-stage match (the organizer flips a later submission round back to
  `active` via the existing kind→status mapping when advancing).
- Artifact visibility: judges/owner/admin + the entrant. Public gets the content card only.
- Judge display resolves the artifact by walking back from the current review stage to the nearest
  templated submission stage (round 1 sees the proposal, round 2 the prototype).
- Field keys auto-derive from labels but pin once hand-edited (stable keys = artifact integrity).

## Gotchas hit

- vue-tsc (strict) caught that `submitStageArtifact` passed its joined row (with `contestStatus`)
  straight into `currentStage()`, which reads `.status` — silently undefined at runtime; vitest
  passed because the explicit `currentStageId` pointer masked it. Built an explicit `StageSource`.
  (The vue-tsc-vs-vitest memory strikes again — typecheck before push.)
- zod 4: `z.record` requires an explicit key schema (`z.record(z.string().max(64), ...)`).
- In layer vitest, spreading `{ ...defaults, key: undefined }` did not override the default in a
  test fixture; mirroring the server's actual `delete entry.stageSubmissions` was the faithful fix.

## Open questions / deferred

- Public artifact visibility (e.g. public proposals for community voting) — deliberate non-goal;
  would be a per-contest setting later.
- Teams + per-entry judge assignment + timeline-clarity work — out of scope per the plan.
- deveco/heatsync pin bumps remain operator-gated (not part of this release).

## Post-ship audit round (same session)

A fresh-eyes adversarial audit of the shipped surface found two issues, fixed as
**server 2.84.1 / layer 0.71.1** (PR #23):

1. **stageState snapshot score leak** (pre-existing since session 189, replicated in the new entry
   GET): `listContestEntries` returned `stageState` unconditionally — including each round's
   snapshot `score` written by `advanceContestStage` — so a judges-only contest mid-judging (or a
   `private` one permanently) leaked round scores to the public even though `revealScores` nulled
   the live aggregate. Snapshot `score` now honours `revealScores` in the listing and the entry
   detail route; the cohort outcome and `rank` stay public (mirrors the top-level exposure).
   Locked by a new integration test (advance → public view shows no score anywhere; privileged
   keeps snapshots).
2. **Judge page artifact box ignored the flag** (cosmetic): with `contestStageSubmissions` off the
   server strips artifacts but the template metadata in `stages` jsonb would render empty
   "Nothing submitted" boxes. `artifactStage` is now flag-gated.

Audit also re-verified (clean): IDOR (entry↔contest slug binding on both new routes), proto-key
smuggling through `fields`, payload bounds, em-dash-free copy, `var(--*)`-only styles, template
survival through the edit/create save paths, classic-contest byte-identical judge page, and that
ContestEntries' new detail links always have the slug in their one usage site.

## Next steps

- Live end-to-end on commonpub.io after deploy (create a 2-template contest, run the cull, fill the
  prototype as the advanced entrant, judge round 2) — see the plan's Verification section.
