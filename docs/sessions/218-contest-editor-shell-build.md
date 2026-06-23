# Session 218 — Contest editor 3-panel shell redesign (build)

> **Consolidated handoff:** see `docs/sessions/219-kickoff-next.md` for the clean current-state
> summary (full feature inventory · gates · run/verify · next steps). This doc is the chronological
> build log.

Branch: `contest-editor-shell`. Plan: `docs/plans/contest-editor-shell.md` (session 217).
Goal: make the contest editor FEEL like the house project/blog/explainer editor —
left block palette · center body tabs · right settings rail — with banner + cover
inline in the body and a new sanitized HTML block.

**NOT merged / deployed / published.** Contest feature is still LIVE on commonpub.io
only (main `00139353`); deveco/heatsync await a separate publish. This branch is the
next iteration, built in 5 verified slices + a gates pass.

## What was done (5 build slices, each visually verified via local run + Playwright)

1. **Shell scaffold + settings rail** (`22c3b9e5`) — `ContestEditor` restructured into a
   `layout:false` full-screen `cpub-ce-layout`: topbar (back · title · status badge ·
   autosave · View · Save) + 3-panel `cpub-ce-shell`. All settings moved into a ~340px
   right `EditorSection` rail (Details, Schedule, Stages + edit-only advancement, Entries,
   Prizes, Judging, Access, People, Danger Zone). Stages + Judging relocated from center
   body tabs to rail sections; title moved to the topbar. `create.vue` + `[slug]/edit.vue`
   → `layout:false`.
2. **Hoist body editors + wire palette** (`551879e5`) — the three `useBlockEditor`
   instances (overview/rules/prizes) lifted into `ContestEditor` so one left `EditorBlocks`
   palette inserts into the active body. `ContestBodyTabs` + `ContestBodyEditor` collapsed
   into a new presentational `ContestBodyCanvas` (tab bar + Write/Preview/Code over one
   shared `BlockCanvas`). Palette groups: Basic / Contest / Media / Rich.
3. **Inline media** (`27f78f92`) — banner + cover render inline at the top of the Overview
   body (write mode) via a `#overview-lead` slot: wide ~4:1 banner hero with a ~4:3 cover
   thumbnail inset over its lower-left, hover/focus overlays (upload/URL/replace/remove).
   `ContestMediaStrip` deleted.
4. **Topbar Status menu** (`66b0ea12`) — lifecycle transitions moved into a topbar
   `Status ▾` dropdown (the contest analogue of Publish), edit-only, with the shared
   go/warn/danger tones; closes on select/Escape/outside-pointer. Advancement stays in the
   Stages rail section.
5. **HTML block** (`5b35a0de`) — new first-class `html` block: `BlockHtmlView` renders
   `sanitizeRichHtml({ neutralizeColors: true })` into `.cpub-md-html` (dark-safe; scripts,
   handlers, unsafe URLs stripped — same path as contest Full-HTML / CustomHtmlSection);
   `HtmlBlock` is the edit component (monospace textarea + live sanitized preview).
   Registered in `BlockContentRenderer`, provided via `BLOCK_COMPONENTS_KEY`, added to the
   palette Rich group. Available in Overview/Rules/Prizes.

## Key decisions / landmines hit

- **No `<form>` wrapper.** The first cut wrapped the 3-panel shell in a `<form>`. Third-party
  buttons inside it (`EditorBlocks` palette items, `EditorSection` headers, `BlockCanvas`
  controls) default to `type="submit"`, so every palette click / section toggle submitted
  the form → `save()` → refetch → re-hydrate → wiped the dirty state. Fixed by dropping the
  form and driving Save via an explicit `@click` `type="button"` (matches the house editor,
  which uses no form). This was the root cause of an early "block insert doesn't enable
  Save" symptom.
- **Dirty on structural insert.** A bare `watch(editor.blocks, …, {deep})` on the readonly
  ref caught nested content edits but not array push/splice. Switched to the proven getter
  form `watch(() => editor.blocks.value, …, {deep})` and mark dirty explicitly in the
  write-back (`syncBody`), guarded by a `syncingBodies` reseed flag so hydration stays clean.
- **`EditorSection`/`EditorBlocks`/`BlockCanvas` are `@commonpub/editor/vue` package exports,
  not local components** — they must be explicitly imported (Nuxt auto-import won't find
  them). Forgetting the `EditorSection` import made the rail render flat (slot content leaked,
  no headers/collapse).
- Per-tab block state persists because the three editors live in `ContestEditor`; the shared
  `BlockCanvas` is keyed by `activeTab` for a clean remount per body.

## Components

- New: `ContestBodyCanvas.vue`, `blocks/BlockHtmlView.vue`, `contest/blocks/HtmlBlock.vue`.
- Deleted (absorbed): `ContestBodyTabs.vue`, `ContestBodyEditor.vue`, `ContestMediaStrip.vue`
  (+ their tests).
- New tests: `ContestBodyCanvas.test.ts` (tabs/mode/preview/code + axe), `BlockHtmlView.test.ts`
  (sanitizer + axe), `HtmlBlock.test.ts` (textarea/emit/preview + axe).

## Gates (all green)

- Layer suite: **1226 passed, 0 failed** (was 1223; net +3 after the restructure).
- `turbo run typecheck`: **28/28** (all packages + both apps — reference & shell typecheck 0).
- axe: passing on all three new components.
- Server / schema: untouched (zero file changes; turbo typecheck confirms no cross-package
  type breakage).

## Notes / follow-ups

- `ContestStageSubmission.test.ts` (the entrant submission form, unrelated to this redesign)
  FAILS when run as an isolated subset but PASSES in the full layer suite — a test-isolation
  artifact (depends on global state set by an earlier file in the full run), not a regression.
- Rail width is 340px; `ContestStagesEditor` / `ContestCriteriaEditor` read acceptably inline
  at that width in testing (no slide-over drawer needed).
- Next: on go-ahead, the deveco/heatsync roll is a separate later step.

## Post-build audit + full-lifecycle E2E (same session)

After the build, ran a background adversarial code audit + a complete contest-lifecycle E2E
locally (commit `be15fd74`).

**Full-lifecycle E2E** (`draft→upcoming→active→judging→completed`, 26/26 assertions): created a
contest via the editor-shaped payload, verified editor hydrate + Preview (HTML block sanitized,
judges-showcase rendered), opened the topbar Status menu (UI), 3 entrants published projects +
entered, 2 judges added + accepted + scored per-criterion (6 scores), non-judge rejected (403),
Top-N advancement at the review stage (2 advanced / 1 eliminated; eliminated entry no longer
scorable), completion computed rankings, and the **public contest page** rendered banner/cover/
subheading + all three bodies including the sanitized HTML block (rendered output script-free +
color-neutralized; the raw `<script>` only survives in Nuxt's escaped JSON hydration island, which
is non-executable and re-sanitized client-side). Multi-stage timeline (submission/review/interim/
results/event) + advancement UI in the editor verified in the judging state.

**Fixed (commit `be15fd74`):**
- **P1 — dividers vanished on render.** The palette inserts `horizontal_rule` but
  `BlockContentRenderer` mapped only `divider`/`horizontalRule` (fallback only catches `.html`
  blocks), so dividers rendered nothing in Preview + on the public page (also affected the project
  editor). Added the `horizontal_rule` alias. Verified divider now renders in preview + public.
- **a11y** — `ContestBodyCanvas` tablist now moves DOM focus with arrow-key selection (+ focusable
  tabpanel); the topbar Status menu implements the full menu-button keyboard pattern (open focuses
  first action, Arrow/Home/End rove, Esc closes + returns focus to the toggle, items `tabindex=-1`,
  `aria-controls`/`id`). Verified with keyboard-driven checks.

**Documented, NOT fixed (pre-existing / narrow / out of redesign scope):**
- Autosave-rename mid-flight race: keystrokes typed during a draft autosave that *also* renames the
  slug can be overwritten by the post-rename `reseedBodies`. Narrow window; pre-existing in
  `useContestEditor`.
- `reseedBodies()` resets per-body undo history on every non-dirty refetch (after a non-silent save /
  transition / advance). No data loss; minor UX.
- Deleting ALL Overview blocks on a *legacy* contest resurfaces the old `description` markdown
  (public page falls back when `descriptionBlocks` is empty). Pre-existing data-model interaction.
- Cover inset can overflow a very short banner on a narrow center column. Cosmetic.

**Confirmed NON-issues** (E2E "failures" that were test-harness artifacts): contests are created in
`upcoming` not `draft` (the Status menu correctly reflects actual status); the HTML block *does*
render on the public page (an early assertion mis-checked the hydration-island raw source instead of
the rendered DOM, and a post-transition capture raced the SSR settle).

Re-gates after fixes: layer suite **1226/1226**, `turbo typecheck` **28/28**, E2E **26/26**,
a11y/divider checks **7/7**. Audit verdict: no P0s, no XSS, no save-path data loss.

## Advanced contest E2E + in-app PII viewer (same session)

Ran a full multi-stage / multi-track contest E2E (`15/15`) — two tracks (a `select` field),
proposal → sprint → final per-stage submissions with agreement + address (PII) fields, and **two
review rounds with different rubrics** (the judge UI resolves the rubric from the current review
stage, so the same judge scores Individual vs Startup criteria per round). Captured every stage +
view to `contest-e2e-screens/` (untracked). Confirmed PII partitioning, per-round rubrics, score
visibility (judges-only hides during judging, reveals on completion), and the CSV export's PII
columns vs a plain judge's PII-free export.

That E2E surfaced a gap: **no in-app viewer for partitioned PII** (addresses + agreement acceptances
were only reachable via CSV export or the raw `/private` API). Closed it (commit `b3cb9057`): new
`ContestEntryPrivateData.vue` on the entry detail page renders a "Personal information" card (PII
fields with addresses formatted, + agreement acceptances with terms snapshot + sha-256 hash),
fetched **client-side only** so PII never enters the SSR payload, gated by `features.contestPii` +
the endpoint's entrant-or-`contest.pii` authz. Verified: organizer + entrant see it, judge does not,
PII absent from SSR. Layer suite **1232/1232**.

Then a **deep PII storage/privacy audit** (two adversarial sweeps + manual review): verdict **safe,
no P0/P1** — strict template-driven partitioning (PII can't reach the public artifact), airtight
access control (admin-only when RBAC off; cross-contest entryId rejected; no non-`/private` leak;
no federation/log leak), and `ON DELETE CASCADE` on contest/entry/**user** FKs so all three hard-
delete paths erase PII (right-to-erasure works). Hardening applied (commit `6b4b3ff0`): `no-store`
on `/private` + `/export`; consent-`ip` surfaced in `getEntryPrivateData` + the viewer (subject-
access transparency); accurate `contest.pii` gating copy. Documented decisions (plaintext-at-rest
relies on operator DB encryption; no automated retention purge yet) in `docs/reference/guides/
contests.md` → "Storage, retention & safety". Layer suite **1233/1233**.

## Rich contest content blocks (same session, commit `ee69d445`)

So organizers stop hand-writing HTML for rich rules/overview layouts (the Resilient America
rules were one giant HTML blob with CSS radio-tabs), added three first-class body blocks —
available in the Overview/Rules/Prizes block bodies, registered in all four spots (renderer
`componentMap` + palette `contestBlockGroups` + `blockDefaults` + `BLOCK_COMPONENTS_KEY`):

- **`tabs`** (Layout group) — tabbed container; each panel is nested `BlockTuple[]`. Solves
  **tabbed / multiple rule sets** (Track A vs Track B): drop a Tabs block in the Rules body.
  Edit via `TabsBlock` + `ContestTabPanel` (one nested `BlockCanvas`/`useBlockEditor` per active
  tab, keyed; parent content is source of truth). View `BlockTabsView` = WAI-ARIA tablist
  (roving tabindex + arrows, `useId` for SSR-safe unique ids) rendering panels recursively via
  the auto-import `BlocksBlockContentRenderer`; all panels stay in the DOM (v-show). Nested
  palette (`PANEL_GROUPS`) omits container blocks → no tabs-in-tabs.
- **`table`** (Rich group) — responsive data table; cells plain text (no v-html). Editable grid.
- **`criteriaBar`** (Contest group) — judging criteria as ONE stacked bar, each criterion a
  proportional colored segment (theme-color palette, dark/light-safe) + a legend. Segment math
  in `utils/contestBlocks.ts` (pure, tested).

+34 tests (axe on each). Layer suite **1267/1267**, typecheck 0. Live-verified: tabbed Track A/B
rules (with a table + callout per panel), the stacked criteria bar, the editor palette + tabs
editor — screenshots `contest-e2e-screens/16`–`20`.

### Routing note ("routed pages for each rules section")
The public contest tabs (`?tab=overview|rules|prizes|…`) are a **solid deep-link** (audited):
read on load, written to the URL on switch (`router.replace`), restored on back/forward + reload,
WAI-ARIA tablist. Each section is URL-addressable and shareable — verified `?tab=rules` loads
straight into Rules. **There are NO true sub-routes** (`/contests/:slug/rules` is not a page; it's
one `[slug]/index.vue` with query-param panels) — net-new work if literally wanted. The in-content
**Tabs block** has component-local tab state (not URL-wired); fine for nested content.

### Block follow-ups (built, commit `ed391752`)
- **Tabs URL deep-link** — optional `urlKey` on the tabs block; the view syncs the open tab to
  `?<urlKey>=<slug>` (read on load · `router.replace` on switch · back/forward restore), router
  access try/catch-guarded so it no-ops without a route context. Editor has a Deep-link key field.
  E.g. `?tab=rules&track=track-b-startups` opens the Startups rules tab.
- **Criteria-bar "Use rubric"** — `ContestEditor` provides its live `judgingCriteria`
  (`CONTEST_RUBRIC_KEY`); `CriteriaBarBlock` injects it and offers a one-click fill from
  `{label, weight}` (button hidden outside the contest editor).
- **Markdown GFM tables → structured `table` block** — `@commonpub/editor` `mapTable` now emits
  `['table', { header, rows }]` (plain-text cells) instead of HTML-in-`text`, so legacy/imported
  markdown tables become editable table blocks. Inline marks in cells flatten to text.

  Gates: editor suite 243/243, layer 1270/1270, turbo typecheck 28/28; live-verified (screenshots
  `21`–`23`). Still open (not requested): a true `/contests/:slug/rules` sub-route.
