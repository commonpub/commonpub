# Session 221 — Contest Builder UX, Phases 2 / 4 / 5 / 6 (built + tested, pre-release)

Continued `docs/plans/contest-builder-ux.md` after session 220 shipped P0/1/3. This session
**built + tested** the remaining phases on branch `contest-builder-ux-p2456`. All gates green;
**not yet published or deployed** (release = next step).

## What was done

### P2 — Submission-form builder upgrades (layer + schema for the intro)
- **Field presets** + **whole-form templates**: new pure module `utils/contestSubmissionTemplates.ts`
  (`FIELD_PRESETS`, `availableFieldPresets`, `templatePresetAdded`, `SUBMISSION_FORM_TEMPLATES`,
  `availableFormTemplates`). PII presets/templates gated by `contestPii`. Unit-tested against the real
  `contestStageSchema`.
- **Block intro per submission stage**: `instructionsBlocks` added to `ContestStage` (TS interface +
  `contestStageSchema` Zod field, capped 200). Lives in the `stages` jsonb — **no migration**. Authored
  as markdown + live preview in `ContestStageTemplateEditor`, stored as BlockTuple[], rendered above the
  fields on `ContestProposalForm` + `ContestStageSubmission` via `BlockContentRenderer`. Also seeded a
  starter intro in the standard new-contest template.
- `ContestStageTemplateEditor.vue` reworked: two dropdown menus (Add field presets · Use a template) +
  the intro editor, on top of the existing field list.

### P4 — Banner/cover zoom (non-destructive) — needs the schema release
- Schema: `bannerMeta`/`coverMeta jsonb` on `contests` → **migration 0032** (additive). Zod
  `contestImageMetaSchema` (`{ zoom 0..4, x/y 0..100 }`), added to create + update validators. Server
  passthrough (create insert + update) + read mapping (`coverMeta` on `ContestListItem`, `bannerMeta` on
  `ContestDetail`). Hand-typed `CreateContestInput` extended.
- Layer: `ContestBannerAdjust.vue` (zoom slider + drag-to-reposition) over the inline media in
  `ContestEditor`'s Overview lead; `utils/contestImage.ts` `imageFramingStyle` (typed `CSSProperties`)
  shared by the editor preview, `ContestHero` banner, and the listing-card cover. **null ⇒ legacy
  `cover`** (back-compat), **zoom 0 ⇒ contain**, **zoom > 0 ⇒ cover + scale + object-position**.

### P5 — Hero gap + export + sweep (layer)
- Hero→tabs gap: `.cpub-contest-main` top padding `32px → 18px` (`pages/contests/[slug]/index.vue`).
- CSV export button already present (`canManage && entries.length`, Entries tab) — no change needed.
- Missing-UI sweep: every contest API endpoint already has a client trigger. Bulk-PII review + judge
  invite-resend noted as future enhancements, not built.

### P6 — Judges Showcase de-friction (layer)
- `JudgesShowcaseBlock.vue`: photo upload via `UPLOAD_HANDLER_KEY`, row reorder (up/down), and
  **"Import panel judges"** seeding rows from `contest_judges` via a new `CONTEST_JUDGES_KEY` loader the
  editor provides (`/api/contests/:slug/judges`). Explainer note on panel vs showcase.

### Follow-up fixed
- `seedBodyBlocks` (`utils/contestBody.ts`) html-legacy fallback emitted the wrong markdown attr key
  (`content` → **`source`**); fixed + test updated.

## Gates
- Full layer suite **1367 green** (+45 new); schema validators **282 green**; `pnpm build` **16/16**;
  reference `nuxt typecheck` **clean** (fixed 3 strict vue-tsc errors: `CSSProperties` index signature on
  the framing style + the loose `unknown[][]` shape for `instructionsBlocks`).

## Decisions / landmines
- The block intro is authored as markdown (round-tripped via `blockTuplesToMarkdown`/`markdownToBlockTuples`)
  rather than a per-stage drag-drop block editor — robust in a reorderable list, consistent with the
  contest-body markdown path, same call the plan made for agreement terms. Storage is BlockTuple[] so it
  can upgrade to full block editing later with no data migration.
- `instructionsBlocks` typed `unknown[][]` (not a tuple) to match the Zod inference + the existing
  `descriptionBlocks` pattern; the layer casts to BlockTuple[] at the render site.
- Framing styles must be typed `CSSProperties` (Vue `:style` needs the `--${string}` index signature) —
  a bare `{objectFit,...}` interface fails vue-tsc though vitest passes.

## Release (remaining — P7)
- Bump + publish in dependency order: **schema** (migration 0032 + bannerMeta/coverMeta +
  instructionsBlocks), **server** (passthrough + read mapping), **layer** (all UI). config unchanged
  (no new flag). Apply 0032 via the deploy `db-migrate` path (hard-fail; never `db:push` in prod).
- Roll the 3 instances: commonpub.io builds from `main` (local layer, flags already ON); deveco.io +
  heatsynclabs.io bump pins (caret won't cross 0.x minor — hand-edit + regen lockfiles), deploy, keep
  proposals/PII off unless the operator opts in.
- Standalone: bump `create-commonpub` crates.io pins (layer/schema/config/server) + `cargo publish`.
