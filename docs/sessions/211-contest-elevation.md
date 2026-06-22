# Session 211 — Contest Elevation (handoff)

Date: 2026-06-22. Branch **`contests`** (forked from `monolith-splits`, pushed to origin; **NOT merged /
published / deployed**). Plan: `docs/plans/contest-elevation.md`. Memory:
`project_session_211_contest_elevation`. Run+verify recipe: `reference_local_run_and_visual_verify`.

## TL;DR

Multi-phase **contest elevation**. A 6-agent deep audit found the contest *engine* mature/correct; the
*surface* (editor, layout, submission breadth, polish) is the work. **Phase 1** (bug-fixes + foundations)
and **Phase 2a–2d + 2e-1 + 2e-2a/b.1/b.2/b.3** are done, tested, and visually verified in a locally-run
app. The contest **editor on the EDIT page** is now a shell-style canvas: a full-width body with tabs
**Overview · Rules · Prizes · Stages · Judging**. **Gates: schema 470, server 1469, layer 1172, reference
vue-tsc 0.** Nothing outward-facing.

## What's done (commits on `contests`, by area)

**Phase 1 — fixes + foundations:** `06ea4a84` tx create/withdraw + race-safe judge add + drop emoji ·
`1cb17681` pgEnum-derived validators · `761383b9` `utils/datetime` (UTC datetime-local bug) + `color-scheme` ·
`570709c3` dark-mode-safe Full-HTML (`sanitizeRichHtml` neutralizeColors + `.cpub-md-html` baseline) ·
`0e290a4d` `?tab=` deep links · `671b0a14` contestCreation default · `10b9bc9a` stoa-dark color-scheme.

**Phase 2 — editor:**
- `7be35df1` **2a** `CpubDateTimeField` + stage min/max coupling.
- `c169ff1a` **2b (B5b)** `searchUsers` + contest-manager-gated `/api/contests/[slug]/user-search`; judge/
  reviewer pickers off the admin endpoint.
- `4671c937` **2d** `contests.description_blocks`/`rules_blocks` jsonb (**migration 0028**) + validators +
  server threading + dual-path viewer.
- `30a58761` **2c** `judgesShowcase` block (in-layer: view in BlockContentRenderer, edit via
  `provide(BLOCK_COMPONENTS_KEY)` — the editor registry is unused).
- `41cdf7a8` **2e-1** `ContestBodyEditor` + `seedBodyBlocks` (convert-on-edit); Description = block editor.
- `42b94656` **2e-2a** `ContestBodyTabs` (Overview/Rules/Prizes) + `prizes_blocks` (**migration 0029**) +
  viewer.
- `956d80ac` **2e-2b.1** body promoted to full-width canvas.
- `f0a28b65` **2e-2b.2** **Stages** as a canvas tab (ContestBodyTabs `extraTabs`+slot; ContestStagesEditor
  injected).
- `6c637e83` **2e-2b.3** **Judging** canvas tab + NEW `ContestCriteriaEditor` (one rubric editor reused by
  the Judging tab AND ContestStagesEditor per-round — kills the duplicate editors).

**Component map (separation of concerns):** `ContestBodyEditor` (one block field) · `ContestBodyTabs`
(canvas tab host: body tabs + `extraTabs` slots, decoupled) · `ContestCriteriaEditor`, `ContestStagesEditor`
(focused editors injected as tab content) · `ContestJudgeManager`/`ContestStakeholderManager` (People) ·
`ContestBodyEditor`→`utils/{datetime,contestBody}` + `seedBodyBlocks`. edit.vue = wiring (model/hydration/
save) + the settings sections.

## COMPLETENESS SWEEP — what's NOT done yet (don't forget)

1. **create.vue is DIVERGENT (biggest gap).** The CREATE page still uses the OLD form (FormatToggle +
   textareas for description/rules/prizes, old stages section) — it does NOT use ContestBodyTabs / block
   editor / Judging tab. So creating ≠ editing. Resolved by **2e-2d** (one `ContestEditor` orchestrator for
   both) — until then, new contests start with legacy text (converted to blocks on first edit).
2. **People not yet in the right panel.** Collaborators (`ContestStakeholderManager`) + Judges
   (`ContestJudgeManager`) are in edit.vue's MAIN column; operator wants them in the right panel (aside).
3. **Light settings not yet in a right panel** — Details/Schedule/Prizes-cards/Visibility still in the main
   flow (the full `[body | settings]` 2-col reorg is pending).
4. **Topbar** — still the bottom sticky `cpub-edit-actionbar` save bar (not a topbar).
5. **edit.vue script is still a monolith** — refs/hydration/dirty/save inline. Anti-monolith move: extract a
   `useContestEditor(slug)` composable (testable) before/with the orchestrator.
6. **Cover/banner placeholders** in the canvas (like projects/blogs) — not done.
7. **Write/Preview/Code modes + autosave** — not done.
8. **B5a** — `judge.post.ts` ignores its `:slug` (misleading contract; not an escalation) — NOT fixed.
9. **B3** — `judgeContestEntry` doesn't validate `criteriaScores` against the rubric — deferred to Phase 5.
10. **Phase 3** layout/cover redesign (slim hero, surface coverImageUrl) · **Phase 4** submission paths
    (agreements/PII/proposal flow + placeholder project + PII table/permission + export-collection) ·
    **Phase 5** judging UX + Excel/CSV export · **Phase 6** cleanup (drop dead `judges`/`content_format`
    cols) + release.
11. **Full E2E save-verify of the new editor** (edit every tab + save + reload + confirm) is recommended
    before release — unit/server tests + targeted visual checks pass, but no single end-to-end pass yet.

## Data notes
- **Prizes has 3 related fields:** structured `prizes` cards (place/value) + `prizesBlocks` (block prose,
  Prizes tab) + legacy `prizesDescription` (fallback). Viewer renders prose (blocks else legacy) + cards.
- Legacy `description`/`rules`/`prizesDescription` text columns stay (rollback/back-compat); vestigial once
  block-edited. Phase 6 may drop after all instances convert.

## Release notes (when this lands — explicit go-ahead required)
- **Migrations 0028 + 0029** (both additive jsonb cols) apply via the deploy db-migrate path.
- **Changed publishable set:** `@commonpub/schema` (cols/validators), `@commonpub/server` (contest threading
  + searchUsers), `@commonpub/ui` (theme CSS), `@commonpub/layer` (components/routes). Publish order
  schema → … → server → … → layer (`pnpm run publish:layer`); bump deveco/heatsync pins + both lockfiles + CLI.
- **Behavior change to flag:** contest Full-HTML neutralizes inline colors by default (existing hardcoded-
  color HTML renders the theme baseline).
- This roll also clears the still-pending 203/204 + 209/210 work to deveco/heatsync (nothing published since).

## Resume checklist
1. `git -C <repo> log --oneline main..HEAD` (branch `contests`, clean).
2. Gates: `pnpm -C packages/server exec vitest run` (1469), `pnpm -C layers/base exec vitest run` (1172),
   `pnpm -C packages/schema exec vitest run` (470), `cd apps/reference && pnpm typecheck` (0).
3. Visual verify: follow `reference_local_run_and_visual_verify` (docker :5433 + `drizzle-kit push` to add
   new cols + `nuxt dev --port 3100` + Playwright: API sign-up auto-session, SQL admin-promote read fresh,
   `Origin` header on custom `/api/*` POSTs).

## Landmines
- `layers/base/theme/` is a GENERATED gitignored copy — edit `packages/ui/theme/`; refresh with
  `node layers/base/scripts/bundle-theme.mjs`.
- Every dark theme MUST declare `color-scheme: dark`.
- datetime-local: use `utils/datetime` (`toLocalInput`/`fromLocalInput`), never `toISOString().slice`.
- Adding a contest canvas tab = `ContestBodyTabs` `extraTabs` prop + a `#<key>` slot (don't special-case).
- New contest blocks live in-layer (view in BlockContentRenderer map; edit via `provide(BLOCK_COMPONENTS_KEY)`).
- Don't put backticks in a double-quoted `git commit -m` (shell runs them); use single quotes.
