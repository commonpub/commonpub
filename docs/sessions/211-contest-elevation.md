# Session 211 — Contest Elevation (handoff)

Date: 2026-06-22. Branch **`contests`** (forked from `monolith-splits`, pushed to origin; **NOT merged /
published / deployed**). Plan: `docs/plans/contest-elevation.md`. Memory:
`project_session_211_contest_elevation`. Run+verify recipe: `reference_local_run_and_visual_verify`.

## TL;DR

Multi-phase **contest elevation**. A 6-agent deep audit found the contest *engine* mature/correct; the
*surface* (editor, layout, submission breadth, polish) is the work. **Phase 1** (bug-fixes + foundations)
and **Phase 2a–2d + 2e-1 + 2e-2a/b.1/b.2/b.3/b.4 + 2e-2d** are done, tested, and visually verified in a
locally-run app. The contest editor is now ONE shell-style component (`ContestEditor.vue`, mode-aware)
used by BOTH create and edit as thin route shells: a sticky topbar + full-width body canvas with tabs
**Overview · Rules · Prizes · Stages · Judging** + a settings rail. **create ≡ edit (divergence fixed).** Phase **2e-2c** (cover/banner placeholders, Write/Preview/Code,
draft autosave) now done too.
**Gates: schema 470, server 1469, layer 1200 (+13 this session), reference vue-tsc 0.** Nothing outward-facing.

**Session 214 (2026-06-22) — Phase 2e-2c (editor polish, 3 slices):**
- `eb1adbbd` **2e-2c.1** `ContestMediaStrip.vue` (banner 4:1 + cover, reusing the themed `ImageUpload`
  zones) mounted ABOVE the body canvas like the project/blog editors; the two `ImageUpload` fields removed
  from the Details section (no duplication). 5 component tests + axe.
- `ebd7f1c7` **2e-2c.2** Write/Preview/Code segmented switch on the `ContestBodyTabs` tabbar, shown ONLY for
  the block-body tabs (Overview/Rules/Prizes), hidden on Stages/Judging. `ContestBodyEditor` gained a `mode`
  prop: Write keeps the canvas mounted (`v-show`, so block state + undo survive), Preview renders the live
  blocks through `BlocksBlockContentRenderer` (the SAME view renderer the public page uses, in `cpub-prose`),
  Code shows read-only `BlockTuple[]` JSON. Preview/Code derive from the editor's OWN block state (not the
  parent v-model, which only emits after the first edit) so they work on a freshly-loaded legacy contest.
  The switch sits on the canvas (not the topbar per the original plan wording) so it is never dead on the
  non-body tabs. Decision confirmed with operator: Preview = per-tab rendered blocks (not a full-page
  reproduction); the topbar `View` link already opens the real page.
- `0b83de9c` **2e-2c.3** Draft autosave via `useEditorAutosave`, gated `mode==='edit' && status==='draft'`
  (create has no slug; published/upcoming/etc. keep save-on-action). `useContestEditor.save` gained a
  `{ silent }` mode: no toast/refresh/navigation, rethrows on failure for the status machine, and on a slug
  rename calls a new `onRenamed` callback INSTEAD of navigating. The orchestrator renames in place via
  `navigateTo(..., { replace: true })` (same page component, no remount) and a **hydrate guard** (skip
  re-hydration while `formDirty`) keeps the refetch from clobbering in-progress edits. Topbar shows a live
  `role=status aria-live` indicator (All changes saved / Unsaved changes / Saving / Couldn't autosave); the
  Save button flushes immediately. 4 silent-save unit tests.
- Visually verified live (local run + Playwright): media strip on create+edit (strip precedes the tabs, 0
  image fields left in Details); all three body modes (Preview renders Audit Heading, Code shows the tuple
  JSON, switch hides on Stages, mode persists across body tabs); autosave round-trip (edit -> 3s debounce ->
  persisted to DB), **slug rename swaps the URL in place and stays in the editor** (DB slug updated, no
  view-page jump), upcoming contest shows NO autosave + keeps manual Save. Confirmed create-via-editor-button
  still POSTs 200 + navigates + "Contest created" toast (the Playwright datetime-local fill is flaky on the
  FIRST fill of a field; double-fill or `waitForFunction` on the enabled button is the reliable driver — NOT
  a product bug, `canSubmit` + date wiring unchanged).
- Pre-existing "Hydration completed but contains mismatches" on the authenticated edit/view path is NOT from
  this session (A/B'd: baseline create is clean too); still a Phase 3 item.

**Session 213 (2026-06-22) — Phase 2e-2d (unify create/edit, de-monolith):**
- `5556af55` **2e-2d.1** `useContestEditor` composable — the single form model (refs, slugify, ISO date
  validation, dirty tracking, prize/type/role helpers, hydrate, buildPayload, mode-aware POST/PUT save).
  Dates now stored as **ISO** (CpubDateTimeField handles local display; dropped the `new Date().toISOString`
  re-conversion). 15 unit tests (stubbed `$fetch` + spies).
- `2b43a17e` **2e-2d.2** `ContestEditor.vue` orchestrator + `edit.vue` → 1-line thin shell. Edit-only rails
  (People, lifecycle transitions, advancement, danger zone) gated on `mode==='edit'`. Top-level Schedule
  switched to `CpubDateTimeField` (closing the last raw `datetime-local` from Phase 2a).
- `2d9cd055` **2e-2d.3** `create.vue` → 1-line thin shell; the legacy ~470-line form deleted. Create now
  uses the same block body + canvas tabs + `ContestCriteriaEditor` as edit.
- Visually verified live (Playwright, local run): create through the shell → contest created → edit shows
  status badge / People / Stage&Status / Danger rails; dates round-trip in local time (no offset shift).
- Pushed to `origin/contests` (commits `5556af55`/`2b43a17e`/`2d9cd055`/`c04ccd04` + this audit follow-up).

**Adversarial audit (session 213, all PASS):**
- **`eligibleContentTypes: []` is SAFE** — old create.vue sent `undefined` when empty; the unified
  buildPayload always sends the array (possibly `[]`). Traced `contest.ts:768`
  (`if (eligible && eligible.length > 0 && !eligible.includes(...))`): `[]` is treated identically to
  `null` = "all types allowed". Not a regression (edit.vue already sent the array). Verified vs source.
- **Full E2E save-verify (the recommended pre-release gap) DONE.** Deterministic Playwright + API round-trip
  (15/15): create with body blocks + criteria + prizes + ISO dates → every field persists exactly → the
  EDIT page hydrates and **re-renders the persisted blocks** (Heading + paragraph; proves hydrate →
  seedBodyBlocks → mount ordering) → start date shows `10:00` local for a `17:00Z` store (offset correct) →
  save button pristine on load, arms on dirty → edit-save persists subheading **without clobbering the
  blocks**. No page errors on the editor. (Block tuple shape gotcha for future tests: heading is
  `['heading', { text, level }]`, paragraph is `['paragraph', { html }]` — NOT `{ content }`.)
- **`FormatToggle.vue` (`layers/base/components/FormatToggle.vue`) is now ORPHANED** — zero usages after the
  legacy create form was deleted (the block body replaced the markdown/HTML toggle). NOT removed: tied to
  plan open-decision #4 (retain the hardened raw-HTML escape hatch vs deprecate). Removal candidate.
- **Observed (pre-existing, out of scope):** the public contest VIEW page `/contests/[slug]` logs
  "Hydration completed but contains mismatches" (untouched file; likely a date/countdown SSR mismatch).
  Worth a look in Phase 3 (layout redesign touches the hero).

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

1. ~~**create.vue is DIVERGENT (biggest gap).**~~ **DONE (2e-2d).** create + edit are now thin shells over
   one `ContestEditor.vue`; create uses the same block body + canvas tabs + ContestCriteriaEditor.
2. ~~**People not yet in the right panel.**~~ **DONE (2e-2b.4 + 2e-2d).** Judges + Collaborators live in the
   aside (edit mode); create shows a "add them after creating" placeholder.
3. **Light settings 2-col reorg.** Details/Schedule/Prizes-cards/Visibility now sit in the orchestrator's
   `cpub-edit-main` column with Entries/People/Stage&Status/Danger in the `cpub-edit-side` aside. The body
   is full-width above. (The operator's "all settings in a right panel" vision is partially there; a tighter
   grouping pass could move more of Details/Schedule into the aside if desired.)
4. ~~**Topbar.**~~ **DONE (2e-2b.4).** Sticky topbar (back, title, status, dirty/required, View, Save);
   bottom action bar gone (including on create, via the unified shell).
5. ~~**edit.vue script is a monolith.**~~ **DONE (2e-2d.1).** Form model extracted to `useContestEditor`
   (tested); edit.vue + create.vue are 1-line shells; orchestrator holds only the edit-only lifecycle logic.
6. ~~**Cover/banner placeholders** in the canvas (like projects/blogs).~~ **DONE (2e-2c.1).**
   `ContestMediaStrip` shows the banner + cover as visual placeholders above the body canvas; removed from
   Details.
7. ~~**Write/Preview/Code modes + autosave.**~~ **DONE (2e-2c.2 + 2e-2c.3).** Body-tab Write/Preview/Code
   switch + draft autosave (silent save + rename-in-place + hydrate guard).
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
