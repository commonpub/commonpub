# Session 220 — Contest builder UX: flags on, Stages tab, standard template

Plan: `docs/plans/contest-builder-ux.md` (authored + Phases 0/1/3 implemented this session).
**State: SHIPPED to all 3 instances.** PR #53 → `main` (`90467ebd`); `@commonpub/layer 0.84.0` published;
deveco.io (`38d7f5a`) + heatsynclabs.io (`fb1d743`) layer pin → `^0.84.0` + deployed. All 3 verified
live: health + `/contests` = 200; commonpub.io flags ON (`/api/features` proposals+pii true),
deveco/heatsync OFF (operator opt-in); deveco CI `nuxt typecheck` green; full suite (server 1490, layer
1322) + `pnpm build` + create→edit Playwright round-trip all green; adversarial diff audit GO.

## What was done

The deep investigation (4 agents) confirmed the maintainer's core question: the agreement/address/PII/
configurable-form/judging machinery was already built (Phase 4/5), just gated OFF by default, buried in
the right rail, and never seeded into new contests. So this session was surfacing + templating + defaults.

### Phase 0 — flags ON for the reference instance
`apps/reference/commonpub.config.ts` now sets `contestProposals: true` + `contestPii: true`. Verified
live: `curl /api/features` → both true. The `@commonpub/config` + layer `nuxt.config.ts` defaults stay
OFF, so deveco/heatsync remain operator opt-in. PII *read* is still gated by `contest.pii` regardless.

### Phase 1 — Stages as a center tab (+ de-monolith)
- `ContestBodyCanvas`: a 4th `stages` tab that renders a `#stages` form slot and hides the
  Write/Preview/Code switch there (`isBlockTab`).
- `ContestEditor`: hides the left block palette on the Stages tab; the `#stages` slot hosts
  `ContestStagesEditor` + (edit-only) `ContestAdvancementPanel`. The old rail "Stages" `EditorSection`
  and the inline advancement code/CSS/entries-fetch were removed.
- **De-monolith** (no behaviour change, suite stayed green): `ContestStagesEditor` (422 → ~135 lines)
  split into `ContestStageCard.vue` (one stage row) + `ContestStageTemplateEditor.vue` (the submission-
  form builder); `ContestAdvancementPanel.vue` extracted (self-fetches entries, acts on persisted review
  stages, emits `advanced`). Array-level template helpers added to `utils/contestStages.ts`; the existing
  stage-indexed `withTemplate*` wrappers delegate to them (existing tests unchanged). Per the scoped-CSS
  rule, the `.cpub-form-input/-stage-*/-advance-*` styles travel into each child.

### Phase 3 — standard new-contest template
`utils/contestTemplates.ts` `standardContestTemplate({ proposals, pii })`: a Proposals (submission)
stage + a starter form (project name / one-line summary / description / approach, + a rules `agreement`
when PII is on), a Judging (review) stage, a Results stage, a default rubric (Innovation 40 / Feasibility
30 / Impact 30), and Overview/Rules starter copy. Flag-adaptive (attach-mode + no agreement when the
flags are off). Seeded in create mode via the new `useContestEditor.applyTemplate()` (dirty-suppressed,
mirrors `hydrate`) + `reseedBodies()` in `ContestEditor`'s create-mode `onMounted`.

## Decisions (confirmed earlier with the maintainer)
Banner zoom = non-destructive metadata (Phase 4, deferred). Judge photos = the Judges Showcase block
(Phase 6, deferred). Flags ON for reference only. Standard-template field shape = the general proposal
shape (no specific contest names) — done.

## Verification
- Full layer suite **1322 passing** (+11 new: `contestTemplates` incl. schema-validation of every seeded
  stage; `applyTemplate` dirty-suppression). Reference `nuxt typecheck` clean.
- Live (local Postgres + nuxt dev, Playwright): create page seeds the stages + form; `agreement`/`address`
  field types present; palette hidden on Stages tab; Overview renders the seeded heading + paragraph.
- Fixed kickoff follow-up #3: `ContestStageSubmission.test.ts` failed in isolation (two `mount()`s, one
  test → duplicate `cpub-stagesub-*` ids) — added `cleanup()` between mounts; now order-independent.

## Landmine
Markdown block attr key is `source` (editor `MarkdownBlock` + `BlockMarkdownView` both read
`content.source`), so body copy must be seeded as structured blocks via `markdownToBlockTuples`, not an
ad-hoc `['markdown', { content }]` tuple. `seedBodyBlocks`' html-legacy fallback shares the latent
`content`-key bug — separate follow-up, left untouched.

## Next (per the plan)
P2 (field presets + form templates + block-editable instructions), P4 (banner zoom, migration 0032),
P5 (hero→tabs 52px gap + surface CSV export + missing-UI sweep), P6 (judges showcase de-friction),
P7 (tests/docs/release). Nothing committed yet — review the diff, then branch + commit when ready.
