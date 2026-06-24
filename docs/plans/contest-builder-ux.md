# Plan: Contest Builder UX — surface what exists, template the start, polish the gaps

> Status: **Phases 0, 1, 3 IMPLEMENTED + verified** (session 220, 2026-06-23) — on `main`, NOT
> committed/published/deployed yet. Phases 2 (builder presets/templates/block-intro), 4 (banner zoom),
> 5 (hero gap / export / sweep), 6 (judges showcase), 7 (release) remain. See "Progress" below.
> Authored after a 4-agent deep investigation of the contest schema/server/layer. Decisions confirmed
> with the maintainer (see "Decisions" below).
>
> ## Progress (session 220)
> - **P0 flags ON** — `apps/reference/commonpub.config.ts` sets `contestProposals: true` + `contestPii: true`;
>   verified live (`/api/features` returns both true). deveco/heatsync defaults stay OFF (operator opt-in).
> - **P1 Stages center tab** — `ContestBodyCanvas` gained a `stages` form tab (palette + Write/Preview/Code
>   hidden there); `ContestStagesEditor` + a new `ContestAdvancementPanel` moved out of the cramped rail
>   into the full-width center. **De-monolith:** `ContestStagesEditor` (422→~135 lines) split into
>   `ContestStageCard` + `ContestStageTemplateEditor`; advancement extracted to `ContestAdvancementPanel`;
>   array-level template helpers added to `utils/contestStages.ts` (existing stage-indexed wrappers
>   delegate, tests unchanged). CSS travels with each extracted subtree (scoped-CSS rule).
> - **P3 Standard template** — `utils/contestTemplates.ts` `standardContestTemplate()` (flag-adaptive:
>   proposal mode + rules agreement only when the flags are on, else attach-mode) seeds a Proposals →
>   Judging → Results timeline + a starter proposal form + a default rubric + Overview/Rules copy.
>   Seeded in create mode via `useContestEditor.applyTemplate()` (dirty-suppressed) + `reseedBodies()`.
> - **Verified end-to-end live:** signup → `/contests/create` seeds stages `[Proposals, Judging, Results]`
>   + form `[Project name, One-line summary, Description, Approach, Contest rules]`; field-type menu
>   offers `agreement`/`address`; palette hidden on the Stages tab; Overview renders the seeded
>   heading+paragraph. Full layer suite **1322 green** (+11 new), reference `nuxt typecheck` clean. Also
>   fixed the kickoff's flaky `ContestStageSubmission.test.ts` (double-mount id collision → `cleanup()`).
> - **Landmine found + fixed:** the markdown block's attr key is `source` (not `content`) in BOTH the
>   editor + the view, so template body copy must be seeded via `markdownToBlockTuples` (structured
>   heading/paragraph blocks), not an ad-hoc `['markdown', { content }]` tuple. (`seedBodyBlocks`'
>   html-legacy fallback has the same latent `content`-key bug, left as a separate follow-up.)
> Standing rules apply: feature flags (rule 2), `var(--*)` only (rule 3), TDD (rule 11), a11y (rule 12),
> no AI attribution (rule 15), no em dashes in user-facing copy.

## The core finding (why this is mostly UX, not new backend)

The maintainer's confusion ("did you maybe never do the UI? where is the easy UI for that?") has a clear
answer: **the data model, server logic, and even a builder UI for agreements, address/PII, configurable
submission forms, and the full judging flow already exist and are shipped** (Phase 4/5, sessions 211-218).
The reason none of it is visible or usable:

1. **Gated OFF by default.** `features.contestProposals` and `features.contestPii` both default **OFF**,
   so the agreement/address field types and the proposal-mode selector literally never render in the
   builder. (`layers/base/composables/useFeatures.ts`, `nuxt.config.ts`.)
2. **The form builder is buried.** It lives inside `ContestStagesEditor`, nested under a submission-kind
   stage, in the cramped 340px **right rail** (`ContestEditor.vue:573`). There is no prominent "Stages"
   or "Submission Form" surface, unlike Rules/Prizes which are real center tabs.
3. **New contests start blank.** No standard template, no proposals round, no prebuilt fields. Every
   organizer has to discover and assemble all of this by hand.

So this initiative is **surfacing + templating + defaults**, plus three genuinely new pieces:
banner zoom, hero→tabs gap, and surfacing the Judges Showcase block for judge photos.

### What already exists (do NOT rebuild)

| Capability | Where it lives | State |
| --- | --- | --- |
| Agreements (accept + immutable audit, sha-256 termsHash + snapshot + IP) | `agreement` field type, `contest_agreement_acceptances` table, `validation.ts` `hashTerms` | Built, gated by `contestPii` |
| Address / PII (structured, auto-private, partitioned) | `address` field type, `contest_entry_private_fields`, `validateSubmissionFields` partition | Built, gated by `contestPii`; READ gated by `contest.pii` permission |
| Configurable per-stage form (9 field types) | `submissionTemplate[]`, `ContestSubmissionField.vue`, `ContestStagesEditor.vue` | Built |
| Proposal (form-first) entry | `ContestProposalForm.vue`, `submitContestProposal`, draft-placeholder flow | Built, gated by `contestProposals` |
| Per-round judging, rubric, Top-N cull | `judging.ts`, `pages/contests/[slug]/judge.vue` | Built |
| CSV export (PII columns gated by `contest.pii`) | `export.ts` `buildContestExport`, `GET /contests/:slug/export` | Built |
| In-app PII/agreement viewer | `ContestEntryPrivateData.vue` (entry detail) | Built |
| Editorial judge showcase (custom photo upload + name + bio) | `JudgesShowcaseBlock.vue` (edit) + `BlockJudgesShowcaseView.vue` (view) | Built |

## Decisions (confirmed with maintainer, session 220)

1. **Banner/cover zoom = non-destructive metadata.** Add `bannerMeta`/`coverMeta` jsonb `{zoom, x, y}`;
   render via `object-fit` + `scale` + `object-position`; original image untouched, re-adjustable forever.
   Zoom 0 = `contain` (perfect fit). (NOT the destructive crop-on-upload path.)
2. **Judge photos = the Judges Showcase block.** Lean on the existing `judgesShowcase` editorial block
   (already has custom avatar upload + name + description) for the curated public face. The scoring panel
   (`contest_judges`) stays account-avatar. We will *surface* and *de-friction* the block, not add columns
   to `contest_judges`.
3. **Flags ON for the reference instance.** Flip `contestProposals` + `contestPii` ON in the
   reference/commonpub.io config so the builder is discoverable and the standard template can ship a
   proposals round. deveco/heatsync operators opt in via their own config. **PII READ stays gated by the
   `contest.pii` permission regardless of flag** (unchanged).

---

## Phase 0 — Flags + discoverability (small; unblocks everything)

Turn the existing builder UI on for the reference instance so the rest of the work is visible.

- Set `contestProposals: true` + `contestPii: true` in the **reference instance** config:
  `apps/reference/commonpub.config.ts` and `apps/reference/nuxt.config.ts`
  `runtimeConfig.public.features` (the env-propagation landmine: a flag absent from the declared
  `runtimeConfig.public.features` is silently dropped). Leave package-level defaults (`@commonpub/config`)
  and the layer `nuxt.config.ts` defaults **OFF** so other operators stay opt-in.
- Verify empirically: `curl https://commonpub.io/api/features` after deploy must show both ON
  (memory `feedback_verify_flag_state` — never claim flag state from memory).
- deveco/heatsync: untouched (operator opt-in in their configs).

**Acceptance:** the builder shows proposal mode + agreement/address field types on commonpub.io.

---

## Phase 1 — Make Stages + Submission Form a real center tab

The heaviest, most-requested UX change. Move stage + submission-form editing out of the 340px rail into
the spacious center canvas, as a peer of Overview/Rules/Prizes.

- **Add a `stages` body tab.** Extend the `BodyTab` union in BOTH `ContestBodyCanvas.vue:16` and
  `ContestEditor.vue:81` to `'overview' | 'rules' | 'prizes' | 'stages'`. Add it to the `TABS` array
  (`ContestBodyCanvas.vue:31`) with an icon (`fa-diagram-project` / `fa-list-check`).
- **Make the canvas tab-kind aware.** Overview/Rules/Prizes are *block* tabs (Write/Preview/Code mode
  switch over a `BlockCanvas`). The new `stages` tab is a *form* tab: it renders `ContestStagesEditor`
  full-width instead of the block canvas, and the Write/Preview/Code mode switch is hidden for it.
- **Relocate `ContestStagesEditor`** from the right rail (`ContestEditor.vue:573`) into the center for
  the `stages` tab. The right rail keeps only the lightweight **Schedule** dates + the edit-only
  **Advancement** (Top-N / manual cut) controls, OR move advancement into the Stages tab too (it is
  stage-scoped). Recommendation: advancement lives in the Stages tab beside the stage it acts on.
- **Re-lay-out `ContestStagesEditor` for width.** Today it is a 270-line cramped vertical stack. With
  full center width, render stages as cards in a single column, and the submission-template builder as a
  two-column field grid (field config left, live field preview right). Reuse all existing pure helpers
  (`utils/contestStages.ts` `withTemplateField*`, `withTemplateOption*`) and `ContestSubmissionField`
  for the preview. No server/schema change.

**Acceptance:** Stages + the submission-form builder are a first-class tab with room to breathe; Rules/
Prizes/Overview unchanged; advancement still works.

---

## Phase 2 — Submission-form builder upgrades (presets · templates · block intro)

Make the form builder genuinely easy, per "address should be a prebuilt field", "templates", and "edit
the submission form partially with blocks".

- **One-click field presets.** Above the field list, an "Add field" menu with prebuilt configs:
  *Short text*, *Long text*, *URL*, *Email*, *Number*, *Select*, *Checkbox*, *Date*, **Mailing address**
  (auto-PII, permission-gated, reassurance copy: "Stored privately, only admins with PII access can read
  it"), **Agreement** (terms + must-accept). Each preset just seeds a `submissionTemplate` field with
  sensible defaults via the existing `withTemplateFieldAdded` + a patch. Address/Agreement appear only
  when `contestPii` is on (already the gating; now ON for reference per Phase 0).
- **Whole-form templates.** A "Start from template" picker that fills a stage's `submissionTemplate`:
  - *Standard proposal* — Project name, One-line summary, Description (textarea), Approach (textarea),
    Team/contact, Rules agreement.
  - *Hardware / shipping* — adds **Mailing address** + a shipping/liability **agreement**.
  - *Minimal* — Project name + link.
  - *Blank* — empty.
  Templates are pure data (`utils/contestSubmissionTemplates.ts`), unit-tested, no backend.
- **Block-editable instructions per submission stage.** Add `instructionsBlocks?: BlockTuple[]` to
  `ContestStage` (it lives inside the `contests.stages` jsonb, so **no migration** — same pattern as
  `submissionTemplate`/`criteria` were added). Add a Zod field to `contestStageSchema`
  (`validators/contest.ts`). In the Stages tab, a small `useBlockEditor` instance edits the intro; on the
  public side, `ContestProposalForm.vue` + `ContestStageSubmission.vue` render
  `instructionsBlocks` via `BlockContentRenderer` **above** the form fields. This is the "partially edit
  the submission form with blocks" ask: rich intro/instructions in blocks, structured fields below.
- **Agreement terms:** keep the existing `terms` markdown/html textarea + a live preview pane (terms
  already supports `termsFormat: markdown|html`). Full block-editing of terms is deferred (the immutable
  snapshot/hash semantics make blocks higher-risk; markdown preview is enough).

**Acceptance:** a builder can assemble a real proposal form in under a minute from a template + presets,
add a block intro, and add an agreement + address without touching JSON.

---

## Phase 3 — Standard template for NEW contests

"any new contest should start with a standard template including a proposals round with forms and
everything."

- Add `defaultContestModel()` (in `useContestEditor.ts` or a `utils/contestTemplates.ts`) used by
  `pages/contests/create.vue` to seed a NEW contest with:
  - **Stages:** a *Proposals* submission stage (`submissionMode: 'proposal'` when `contestProposals` on,
    else `'attach'`) carrying a *Standard proposal* `submissionTemplate` + a rules **agreement** field +
    a block intro; a *Judging* review stage with 3 default weighted criteria; a *Results* stage.
  - **Bodies:** starter `descriptionBlocks` (a short "About this contest" + a `criteriaBar` + a
    `roadmap` pulled from the stages), `rulesBlocks` (a starter rules outline), `prizesBlocks`.
- **Adaptive to flags:** if `contestProposals`/`contestPii` are off (deveco/heatsync default), the
  template degrades gracefully (attach-mode submission stage, no agreement/address fields) so it is never
  inert or broken.
- Offer a **template picker on create**: *Standard proposal contest* (default) · *Multi-round hackathon*
  · *Blank*. Keeps power users fast and newcomers guided.

**Acceptance:** "New contest" lands the organizer in a populated, sensible draft, not a blank page.

---

## Phase 4 — Banner/cover zoom (non-destructive metadata)

Per Decision 1.

- **Schema:** add `bannerMeta jsonb` and `coverMeta jsonb` to `contests` (`packages/schema/src/contest.ts`)
  → **migration 0032** (additive, additive-default `null`; generate via `drizzle-kit generate` to keep
  the snapshot chain consistent). Shape `{ zoom: number; x: number; y: number }` (zoom ≥ 0, x/y in
  percent 0..100). Zod in `validators/contest.ts`; thread through `CreateContestInput`/update passthrough
  (`CONTENT_PASSTHROUGH_FIELDS`-style) in the server.
- **Editor control:** a small `ContestBannerAdjust.vue` over the inline banner/cover preview in
  `ContestEditor.vue` (the `#overview-lead` slot, ~`:498-529`): a zoom slider (0 = fit/contain) + drag to
  reposition (sets x/y). Writes `bannerMeta`/`coverMeta` on the form model, marks dirty. Pure, no upload
  change (upload still uses the existing `uploadMedia`).
- **Public render:** `ContestHero.vue` (`.cpub-hero-banner img`, currently hardcoded
  `object-fit: cover`) reads `bannerMeta`: `null` → **unchanged `cover`** (back-compat: existing banners
  do not suddenly letterbox); `zoom === 0` → `object-fit: contain`; `zoom > 0` → `cover` +
  `transform: scale(1 + zoom)` + `object-position: x% y%`. Same treatment for `coverImageUrl` on the
  Overview lead.

**Acceptance:** an organizer can dial banner framing live; zoom 0 = perfect fit; existing contests look
identical until touched; original image preserved.

---

## Phase 5 — Hero → tabs gap + missing-UI sweep

- **Fix the 52px gap.** Root cause: `.cpub-hero-bar-inner { padding: 20px 32px }` (hero bottom) +
  `.cpub-contest-main { padding: 32px }` (top) stack to ~52px before the tab bar
  (`pages/contests/[slug]/index.vue`). Reduce `.cpub-contest-main` top padding to ~16-20px (or pull the
  tabbar up with a negative margin), and tighten further when there is no banner. Verify visually in both
  themes.
- **Surface the CSV export.** The `GET /contests/:slug/export` route + `buildContestExport` exist; add a
  visible **"Export entries (CSV)"** button in the editor People/Entries rail (and/or the public Entries
  tab for owners), PII columns auto-gated by `contest.pii`. Confirm whether a trigger already exists in
  `pages/contests/[slug]/index.vue` (a reference was found) and de-dupe.
- **Missing-UI audit.** A quick sweep for backend capability lacking a UI trigger: bulk agreement/PII
  review beyond the per-entry `ContestEntryPrivateData`, judge-invite resend, stage advancement
  discoverability. File anything found as follow-ups; fix the cheap ones.

**Acceptance:** tight hero→tabs spacing; every shipped contest capability has a reachable UI control.

---

## Phase 6 — Judges Showcase de-friction (judge photos)

Per Decision 2, judge photos are served by the editorial `judgesShowcase` block, not new columns.

- Confirm `JudgesShowcaseBlock.vue` photo upload (UPLOAD_HANDLER_KEY) works end-to-end and the block is
  discoverable in the palette's Contest group. Polish the edit UX (add/reorder/remove judge rows, photo +
  name + title + bio).
- **Bridge the "two lists" friction:** add a one-click **"Import panel judges"** in the showcase block
  edit that seeds rows from the contest's `contest_judges` (name + account avatar) as a starting point,
  which the organizer can then re-photo/retitle. (Pull via the existing judges list; pure client merge.)
- Add a short note in the editor explaining the two concepts: the **Judges panel** (People rail = real
  accounts who score) vs the **Judges Showcase** block (curated public faces, custom photos). Optionally,
  the public **Judges tab** renders the showcase when present and falls back to the panel.

**Acceptance:** an organizer can publish branded judge photos/titles via the showcase block, seeded from
the panel in one click.

---

## Phase 7 — Tests, docs, release

- **TDD + a11y** (rules 11/12): unit-test the template/preset pure helpers
  (`contestSubmissionTemplates`, `defaultContestModel`, banner-meta CSS mapping); component + axe on the
  new Stages tab, the field-preset menu, `ContestBannerAdjust`, and the block-intro render path; server
  test the `instructionsBlocks` validator + `bannerMeta` passthrough.
- **Docs:** update `docs/reference/guides/contests.md` (the editor section: new Stages tab, presets,
  templates, block intro, banner zoom; flags now ON for reference). Refresh `codebase-analysis/` +
  `facts.md`. Session log in `docs/sessions/`.
- **Release chain** (`docs/STATUS.md` → "Release an npm package"): bump **schema** (migration 0032 +
  bannerMeta/coverMeta + instructionsBlocks validator), **config** (no new flag, but if any default
  surface), **server** (passthrough + any validator), **layer** (all the UI). Publish in dependency order
  `schema → config → server → … → layer`. Apply migration 0032 via the deploy `db-migrate` path
  (committed, hard-fail; never `db:push` in prod — memory `feedback_use_deploy_migrations_not_ssh`).
- **Roll-out:** commonpub.io builds from `main` (local layer) + gets flags ON. deveco/heatsync: bump
  pins (caret won't auto-cross 0.x minor — hand-edit + regen BOTH lockfiles), deploy; they keep
  proposals/PII **off** unless the operator opts in. Bump `create-commonpub` pins + the stale ones noted
  in 220-kickoff (`^0.45/^2.90/^0.83`).

---

## File map (representative)

- **schema:** `packages/schema/src/contest.ts` (`bannerMeta`/`coverMeta`, `instructionsBlocks` on
  `ContestStage`), `validators/contest.ts` (zod), `migrations/0032_*.sql`.
- **config / flags:** `apps/reference/commonpub.config.ts` + `apps/reference/nuxt.config.ts` (flags ON for
  reference only).
- **server:** `packages/server/src/contest/contest.ts` (bannerMeta passthrough), `validation.ts`
  (instructionsBlocks tolerated; unchanged partition).
- **layer — editor:** `components/contest/ContestEditor.vue` (stages tab wiring, banner adjust slot),
  `ContestBodyCanvas.vue` (`stages` tab, form-tab mode), `ContestStagesEditor.vue` (relocate + widen +
  presets + templates + block intro), new `ContestBannerAdjust.vue`,
  `utils/contestSubmissionTemplates.ts` + `utils/contestTemplates.ts`, `composables/useContestEditor.ts`
  (`defaultContestModel`).
- **layer — public:** `pages/contests/[slug]/index.vue` (hero→tab gap, export button, showcase-aware
  Judges tab), `components/contest/ContestHero.vue` (banner-meta CSS), `ContestProposalForm.vue` +
  `ContestStageSubmission.vue` (render `instructionsBlocks`), `blocks/JudgesShowcaseBlock.vue`
  ("Import panel judges").

## Reused (not rebuilt)
The entire PII/agreement partition + audit engine, `validateSubmissionFields`, `submitContestProposal`/
`submitStageArtifact`, the whole judging/advancement engine, `ContestSubmissionField`, the
`submissionTemplate` field-CRUD helpers, `useBlockEditor` + `BlockContentRenderer`, the `judgesShowcase`
block, the CSV export, the `cpub-form-*` + dirty-save patterns.

## Sequencing / tracking
Phase 0 (flags) first — it makes everything else visible. Then 1 (Stages tab) → 2 (builder upgrades) →
3 (standard template) are the UX spine and ship together. 4 (banner zoom) + 5 (gap/sweep) + 6 (showcase)
are independent and can land in any order. 7 closes out (tests/docs/release). Suggested
`TaskCreate`: P0-flags, P1-stages-tab, P2-builder-upgrades, P3-standard-template, P4-banner-zoom,
P5-gap-and-sweep, P6-judges-showcase, P7-release.

## Open questions for the maintainer
- **Standard template content:** is the *Standard proposal* field set above right, or do you have a
  preferred field list (e.g. the Resilient-America shape)?
- **Public Judges tab:** should it auto-render the showcase block when present (single source for the
  public), or keep the panel + showcase visually distinct?
- **deveco/heatsync:** keep proposals/PII off for them by default (current plan), or turn on for one as a
  second live test?
