# Session 212 — contest elevation kickoff prompt

Paste the block below as the first message in a fresh session.

---

You're resuming the **contest elevation** initiative in this `commonpub` monorepo. All work continues on
branch **`contests`** (already created + pushed). Do NOT merge to main, deploy, or publish anything without
my explicit go-ahead — keep iterating on the branch. ultrathink.

**Read first, in order:**
1. `docs/sessions/211-contest-elevation.md` — the handoff: what's done, the COMPLETENESS SWEEP (what's
   still missing), data notes, release notes, resume checklist, and landmines. This is your map.
2. `docs/plans/contest-elevation.md` — the 6-phase plan + the §"Target contest editor" shell architecture.
3. Your memory should surface `project_session_211_contest_elevation` (current state) and
   `reference_local_run_and_visual_verify` (how to run the app locally + drive Playwright for visual tests).

**Phase 0 — verify before any new work:**
- Branch is `contests`, tree clean, `git log --oneline main..HEAD` shows the contest commits (newest
  `71519b4d`).
- Gates green: `pnpm -C packages/server exec vitest run` (1469) · `pnpm -C layers/base exec vitest run`
  (1172) · `pnpm -C packages/schema exec vitest run` (470) · `cd apps/reference && pnpm typecheck` (EXIT 0).
  If anything is red, fix it before new work.

**Where to resume — recommended: Phase 2e-2d** (closes the two biggest open gaps together):
- create.vue is DIVERGENT (still the OLD textarea form; create ≠ edit) AND edit.vue's script is a monolith.
- Build cleanly: (1) extract a tested `useContestEditor(slug)` composable (refs / hydration / dirty / save /
  helpers out of edit.vue); then (2) ONE `ContestEditor.vue` orchestrator (the shell: topbar + full-width
  body canvas with `ContestBodyTabs` + right-panel settings) used by BOTH create.vue and edit.vue as thin
  route shells (`mode: 'create' | 'edit'`). This fixes the divergence + de-monoliths in one pass — no cruft,
  no duplication.
- Reuse, don't rebuild: `ContestBodyTabs` (Overview/Rules/Prizes + `extraTabs` slots for Stages/Judging),
  `ContestBodyEditor`, `ContestCriteriaEditor`, `ContestStagesEditor`, `CpubDateTimeField`,
  `ContestJudgeManager` / `ContestStakeholderManager`, `utils/datetime`, `seedBodyBlocks`.
- Smaller alternatives if you'd rather not do the big rewrite yet: finish moving the light settings
  (Details/Schedule/Prizes-cards/Visibility) into the right panel; or 2e-2c (cover/banner placeholders +
  Write/Preview/Code modes + autosave). Ask me which if unsure; recommend a default.
- After the editor shell: Phase 3 (layout/cover-image redesign — slim the hero, surface coverImageUrl),
  Phase 4 (submission paths: agreements + PII + proposal-form → placeholder project + export-collection),
  Phase 5 (judging UX + Excel/CSV export, incl. B3 = validate judge criteriaScores vs the rubric),
  Phase 6 (cleanup: drop dead `judges`/`content_format` cols; B5a = judge.post.ts `:slug`; release).

**How I want you to work (this has been the rhythm — keep it):**
- ultrathink + a real adversarial audit each turn; trace chains; no assumptions; verify against source.
- TDD with a mutation bar — each fix needs a test that goes RED on revert (server → PGlite/real-PG harness
  in `packages/server/src/__tests__/helpers`; components → @testing-library/vue + axe; pure logic → unit).
- VISUALLY VERIFY every UI slice in the real running app via the `reference_local_run_and_visual_verify`
  recipe, then Read the screenshot. Stop the dev server when done.
- Componentize cleanly — no monolith, no tangled web, no cruft/duplication; strict types (no `any`); prune
  dead code + CSS as you go.
- Atomic commits per logical change; run gates (suites + typecheck) before each commit; update
  `docs/sessions/211-contest-elevation.md` + the project memory each session.
- Ask before a big architectural fork; give a recommendation.

**Standing rules (CLAUDE.md):** no merge/deploy/publish without my go-ahead · `var(--*)` only (no hardcoded
color/font) · no em dashes in user-facing copy · `cpub-` class prefix · TS strict · no AI co-author in
commits · committed migrations only (db:push is fine for the LOCAL dev DB, never prod).

**Landmines (full list in the handoff):**
- `layers/base/theme/` is a gitignored GENERATED copy — edit `packages/ui/theme/`, then
  `node layers/base/scripts/bundle-theme.mjs` to refresh the local copy.
- Every dark theme must declare `color-scheme: dark`.
- datetime-local ↔ ISO: use `utils/datetime` (`toLocalInput`/`fromLocalInput`), never
  `new Date(iso).toISOString().slice(0,16)`.
- New contest block: view component in `BlockContentRenderer` map + edit component via
  `provide(BLOCK_COMPONENTS_KEY)` (the `@commonpub/editor` registry is UNUSED).
- New contest canvas tab: `ContestBodyTabs` `extraTabs` prop + a `#<key>` slot (don't special-case).
- Don't put backticks in a double-quoted `git commit -m` (the shell runs them); use single quotes.
- After changing a `packages/*` type, rebuild that package so the layer/app typecheck sees it.

Start with Phase 0, then propose your plan for 2e-2d (or the alternative) and proceed.
