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
draft autosave) **and Phase 3** (slim hero + cover-on-detail + hydration-mismatch fixes + one date formatter) now done too.
**Gates: schema 470, server 1469, layer 1204, reference vue-tsc 0.** Nothing outward-facing.

**Session 216 (2026-06-23) — RELEASED to commonpub.io ONLY.** After the Phase 6 non-release work below,
the operator gave the go-ahead to release to commonpub.io only (NOT deveco/heatsync). Ran a 3-agent deep
audit, then merged + deployed.
- **Deep audit (3 parallel agents, all clean):** (1) migrations 0028-0031 = **GO** — additive or
  metadata-only DROP on the tiny `contests` table, each in its own tx (drizzle native migrate); prod was
  at 0027 so exactly these 4 pending. (2) security = **all 5 PASS** (133 tests): PII isolation (3 gated
  readers only), CSV formula-injection-safe, B5a, no unauth 500s (entryId validated as uuid pre-bind),
  and the monolith-splits fixes (hub-invite IDOR + wrong-hub use-burn `a4e02d98`; like/boost tx+row-lock
  `0fc4b1ef`) both correct. (3) flags = **safe-OFF** at every layer (config schema, layer
  `nuxt.config.ts:103-104` runtimeConfig, useFeatures); reference config byte-identical to main; no
  leftover flips. Behavior changes all LOW risk (Full-HTML neutralizeColors ON, contestCreation→admin
  tightening, local-TZ dates). + my own local SSR smoke (all critical routes 200).
- **Release mechanics:** the reference app uses `workspace:*`, so commonpub.io builds the layer/packages
  FROM the monorepo — **no npm publish needed** for commonpub.io. `.github/workflows/deploy.yml` triggers
  on push to `main` and targets ONLY commonpub.io's droplet (deveco/heatsync are separate repos), so
  merging to main is inherently "commonpub.io only". Merged `contests`→`main` `--no-ff` (**`00139353`**,
  108 commits = monolith-splits 205-210 + contest 211-216), pushed; pre-push turbo typecheck 28/28.
- **Deploy `28019122283` = success.** Build → scp image → load + `db-migrate.mjs` (applied 0028-0031 under
  `pipefail`) → `smoke.mjs` (waits `/api/health`, verifies `/`). **Verified LIVE:** `/api/health` 200;
  `/api/features` now shows `contestProposals`/`contestPii` present + **FALSE** (were `None`);
  `/`, `/contests`, `/hubs`, `/docs`, `/learn`, `/videos` all 200, zero error markers. Prod has 0 live
  contests (list renders empty state).
- **deveco.io + heatsynclabs.io DELIBERATELY UNTOUCHED.** To roll them later (separate go-ahead): the npm
  publish chain schema → config → server → ui → layer (`pnpm run publish:layer`) + bump their pins + both
  lockfiles + CLI. Flag the Full-HTML `neutralizeColors` (ON) behavior change in their release notes.
- One irreversible change shipped: migration 0031 DROP COLUMN of already-dead `judges`/`content_format`
  (flagged the snapshot caveat to the operator; the data was already unread).

**Session 216 (2026-06-23) — Phase 6 (the non-release subset): cleanup + B5a + denorm note + docs.**
Five atomic commits on `contests`; STOPPED before publish/deploy (awaiting explicit go-ahead). Gates
green throughout: schema **475**, server **1490**, layer **1223**, schema+server+reference+shell
typechecks all 0. Phase 0 re-verified first (counts matched the handoff exactly, tree clean, origin in sync).
- `3730d9b4` **B5a** — `POST /contests/:slug/judge` ignored its `:slug` (judged purely by entryId — a
  misleading contract, not an escalation). The route now `getContestBySlug` (404 if missing) and threads
  `contest.id` into `judgeContestEntry`, which rejects an entry that doesn't belong to that contest (new
  optional trailing `expectedContestId` param — keeps all 40+ positional test calls valid). +1 test
  (entry in A judged through B's id → rejected; correct id proceeds), RED on revert of the guard.
- `116e2cda` **drop dead cols** — removed `contests.judges` + `contests.content_format` (both long
  `@deprecated`/inert). Grep-verified ZERO readers/writers across packages + layer + BOTH apps first; the
  `contest_content_format` pg enum is KEPT (the per-field `descriptionFormat`/`rulesFormat`/
  `prizesDescriptionFormat` columns still use it), and the create-input `judges` field (seeds the
  `contest_judges` table) is untouched. The reference seed wrote the dead `judges` column and never seeded
  the real table, so its demo contest had no functional judges; it now seeds two accepted `contestJudges`.
  Interactive `drizzle-kit generate` → **migration 0031** = two clean `DROP COLUMN`; applied to the local
  dev DB (verified cols gone, enum present).
- `95f51282` **score/rank denormalization** — documented the authoritative chain on the
  `contest_entries.score`/`rank` columns (judgeScores → score → rank → stageState snapshots; score = mean
  of the current round's judgeScores; rank = RANK() over score across the surviving cohort) + a regression
  test asserting the sync (two judges, two entries, complete → score==mean, rank in score order).
- `d8094209` **docs** — refreshed `codebase-analysis/` (02 migrations 0026-0031 + contests/judges/PII
  tables; 08 the two new flags; 09 the PII-partition / denormalization / contest.pii-single-dot / CSV-
  injection / B5a / module-DAG invariants), wrote **ADR 029** (contest proposal + PII model), rewrote the
  stale `docs/STATUS.md` contests-branch section (was stuck at Phase 2b) to cover Phases 1-6 + the release
  runbook + the four migrations (0028-0031).
- **Adversarial audit (this session, all PASS):** whole-repo grep confirmed the only remaining `judges:`
  refs are the create-input seed (→ contest_judges table) + the `judgesShowcase` block content + tests;
  the only `contentFormat`/`content_format` refs are the preserved enum + the per-field validators. The
  B5a membership guard sits before the status check (no cross-contest state leak). server+schema package
  typechecks (which include test files, unlike vitest's esbuild) both 0. **Live smoke (real Postgres, cols
  dropped):** `/api/features` shows contestProposals+contestPii present + **OFF**; `/api/contests` 200
  (20 items); detail 200; SSR `/contests/<slug>` + `/contests` render 200 with zero error markers — the
  destructive drop didn't break the read path. Dev server stopped.
- **NEXT: the RELEASE step only** (explicit go-ahead required) — publish chain schema → config → server →
  ui → layer, commit migrations 0028/0029/0030/0031, deploy commonpub.io then deveco/heatsync with
  curl-verify, bump CLI pins + both lockfiles. Flags ship default OFF; the one Phase-1 behavior change to
  note is contest Full-HTML `neutralizeColors` (ON by default).

**Session 215 (2026-06-23) — Phase 4 (submission paths) + contest.ts decomposition + comprehensive docs:**
Built Phase 4 end-to-end across 5 atomic commits, decomposed the server monolith, wrote the hyper-detailed
reference doc, and VISUALLY VERIFIED the whole flow in the running app. **Not merged/published/deployed.**
- `f7557a90` **4a foundation** — flags `features.contestProposals` + `features.contestPii` (both default OFF,
  wired end-to-end: config types/schema, nuxt runtimeConfig, useFeatures, /admin/features); extended
  `submissionTemplateFieldSchema` with field types email/number/select/checkbox/date/agreement/address +
  options/pii/terms/termsFormat/mustAccept; new tables `contest_agreement_acceptances` +
  `contest_entry_private_fields`; new RBAC permission **`contest.pii`** (single-dot to fit the catalog
  convention + its test) on the catalog + STAFF_PERMISSION_SET; **migration 0030** (additive tables +
  idempotent staff `contest.pii` seed). Applied to local dev DB. Validator/permission tests + rbac seed
  parity test updated to union staff grants across 0025+0030.
- `bb98a749` **4b server** — `validateSubmissionFields` validates every new type AND partitions into
  { artifact, pii, agreements } so PII/consent NEVER reach the public `stageSubmissions` jsonb;
  `recordPrivateAndAgreements` (tx-scoped, PII upsert-merged per entry, agreements append-only with terms
  hash+snapshot+ip); `submitStageArtifact` made PII-aware (+ optional ip); **`submitContestProposal`**
  (one flow: validate → createContent DRAFT placeholder → link entry relaxing the published gate for
  proposal mode → artifact + PII + agreements + entryCount, compensating-delete on tx failure);
  `getEntryPrivateData`. Routes: `POST /contests/:slug/proposal` (features.contestProposals) +
  `GET /contests/:slug/entries/:entryId/private` (contest.pii OR own entry); submission.put forwards ip.
  Stage gained `submissionMode: 'attach' | 'proposal'`. 10 integration tests (partition purity, PII
  isolation, agreement capture, gates, per-user cap, attach-path PII-awareness).
- `0ccd55c4` **DECOMPOSITION** (user-requested "no monolithic files") — split the 1666-line
  `contest/contest.ts` into a clean acyclic DAG: `types.ts`(211) · `stages.ts`(59) · `validation.ts`(140) ·
  `read.ts`(203) · `entries.ts`(344) · `submissions.ts`(350) · `judging.ts`(253) · `contest.ts`(351 CRUD).
  DAG: types ← stages/validation ← read/entries/submissions ← judging; contest ← read+entries. Public API
  (contest/index.ts barrel + server top-level index) unchanged. Behavior-preserving (full suite green).
- `ca0c0586` **4c organizer UI** — ContestStagesEditor builder: new field types (flag-gated — scalars on
  contestStageSubmissions; agreement/address/PII-toggle on contestPii), select-options editor, agreement
  terms+must-accept editor, per-field PII toggle, per-stage submission-mode selector (contestProposals).
  Pure tested helpers in utils/contestStages.ts (withTemplateFieldTypeChanged + option add/set/remove).
- `a833ee00` **4d entrant UI** — `ContestSubmissionField.vue` (one reusable control for ALL types: address
  structured subform JSON-encoded, agreement terms+accept, checkbox/agreement true/empty model);
  `utils/contestSubmission.ts` (shared tested helpers blockingFields/buildSubmissionPayload/address); 
  `ContestStageSubmission` refactored onto the shared field (ids+payload contract preserved);
  `ContestProposalForm.vue` (POST /proposal → routes to the new draft project editor); index.vue entries tab
  is submission-mode aware (proposal form / login prompt / attach CTA / artifact edit).
- `8bd14186` **docs** — rewrote `docs/reference/guides/contests.md` into a hyper-detailed reference with
  state-flow diagrams (architecture, server-module DAG, data model, status state machine, stage engine,
  both submission paths, field types, PII/agreement access-control, judging/advancement, editor, public
  page, full API table, flags, RBAC, federation scope, testing).
- **VISUAL VERIFICATION (local run + Playwright, all PASS):** proposal form renders every field type with
  ZERO hydration mismatches; end-to-end submit creates the draft project + redirects to its editor
  (`/u/<un>/project/solar-pump-v1/edit`); **PII isolation confirmed LIVE** (entries listing leaks neither
  email nor address — artifact = {title,track,summary}; `/private` returns the PII + agreement snapshot);
  the builder renders all Phase 4 controls (mode selector, 6 type selects, select options, agreement terms,
  4 PII toggles), zero hydration. Screenshots reviewed.
- **Gates green at HEAD:** schema 474, server **1479**, layer **1223**, reference vue-tsc 0.
- Decision (operator, this session): **PII access = admin/staff only** (not owner/editor); FormatToggle.vue
  **retained** (hardened, not removed).
- **NOT yet done (next):** Phase 5 (judging UX + Excel/CSV export, incl. B3 = validate judge criteriaScores
  vs rubric); Phase 6 (drop dead `judges`/`content_format` cols, B5a, release). The Phase 4 flags ship
  default OFF; reference config left at defaults (the local-verify flag flip was reverted).

**Session 215 cont. — Phase 5 (judging UX + CSV export + B3), all visually verified:**
- `46b671c4` **5a (B3)** — `judgeContestEntry` no longer trusts the client criterion `max`. New pure
  `scoreAgainstRubric` resolves the rubric (round `criteria` else `judgingCriteria`), rejects unknown/
  missing criteria + OOB scores, computes overall + stores criteriaScores using the RUBRIC max
  (`rubricCriterionMax` = weight>0 ? weight : 100). Per-criterion with no rubric → rejected. +3 tests
  (tampered max → 100 not 2.5; unknown/missing; no-rubric), RED on revert.
- `6857f0da` **5b (G9 CSV export)** — new `contest/export.ts`: pure `toCsv` (RFC 4180) + `buildContestExport`
  (ALL entries, not the 100 cap; one EMPTY column per rubric criterion for manual tallying; PII columns
  ONLY when `includePii`). Route `GET /api/contests/:slug/export` (contest-level, sibling of advance/
  transition to dodge the `entries/[entryId]` typed-route collision) — owner/`contest.manage`/editor/
  accepted-judge; PII gated on `contest.pii`; UTF-8 BOM. Organizer "Export entries (CSV)" link on the
  Entries tab (canManage). Tests: toCsv quoting, PII omit/include, missing-contest null.
- `bd0ca71f` **5c (judge UX + scale)** — operator decided **standardize holistic to 0–100** (min 1→0; CSV
  only, no xlsx). judge.vue: per-card `role=status aria-live` save status (replaces the page-level banner);
  per-criterion inputs in a `<fieldset>` + sr-only `<legend>`; sr-only `<label>` on the feedback textarea;
  inline disabled reason; wrapped the auth-gated no-SEO page in `<ClientOnly>` (kills the lazy-fetch
  hydration race, same as the editor); crit-max `text-faint→text-dim` for AA. Validator score `min(0)`;
  boundary test flipped.
- `f4f4fbf7` **docs** — contests.md updated (B3, 0–100, judge UX, export route + module).
- **VISUAL VERIFICATION (local run + Playwright + curl, all PASS):** judge page renders "Score 0 to 100",
  grouped criteria, per-card "✓ Score saved.", **Your Score 85** (30/40 + 55/60 via rubric maxes — B3 live),
  **ZERO hydration warnings** (after ClientOnly), judge-page axe clean (only global `.cpub-kbd` + footer h4
  + dev devtools remain — all pre-existing/dev-only). CSV export: 200 + `text/csv` + attachment headers +
  rubric columns `Feasibility,Impact` (empty tally) + score 85; entrant (non-judge/non-manager) → **403**.
- **Gates after Phase 5:** schema 475, server **1486**, layer 1223, reference vue-tsc 0.
- **NEXT: Phase 6** — drop dead `contests.judges` + `contests.content_format` cols (interactive drizzle
  generate); B5a (judge.post.ts ignores its `:slug` — load contest by slug + assert entry belongs);
  score/rank denormalization note; docs/STATUS refresh; then the RELEASE (publish chain + deploy) on
  explicit go-ahead. Phase 4+5 flags ship default OFF.

**Adversarial audit (session 215, post-Phase-5):**
- **`fe03bf29` FIXED (real, security)** — CSV **formula injection**. The export carries entrant-controlled
  text (project title, proposal summary, author name) into a spreadsheet; `toCsv` quoted per RFC 4180 but a
  cell starting with `= + - @` TAB or CR would be evaluated as a formula when an organizer opens it in Excel/
  Sheets. `toCsv` now prefixes such cells with `'` before quoting. Tests RED on revert (per-trigger + an
  end-to-end `=HYPERLINK` title). server 1488.
- **PII isolation re-confirmed** for the export: the `Submission` column = `summarizeArtifact(stageSubmissions)`
  which is the partitioned NON-PII artifact only; PII columns appear ONLY when `includePii` (`contest.pii`).
  No PII reaches a judge's export.
- Earlier this session `e7929984` fixed a Nuxt typed-route fragility the export GET route exposed
  (`useFileUpload`'s `$fetch<T>` mis-resolved in the shell app → pre-push turbo typecheck failed). Both apps
  green now; pre-push hook runs `turbo typecheck` across all 28 tasks (it WILL block a push on any app's
  typecheck, incl. apps/shell — not just apps/reference).
- Noted (not fixed, low priority): `scoreAgainstRubric` double-counts if a rubric has DUPLICATE criterion
  labels (the schema doesn't enforce label uniqueness); the API allows a holistic score on a rubric contest
  (the UI doesn't). Both pre-existing data-model gaps, out of Phase 5 scope.
- Final gates: schema 475, server **1488**, layer 1223, both apps vue-tsc 0. Pushed to origin/contests.

**Adversarial audit (session 215, post-Phase-4, all PASS except one real edge-case bug, now fixed):**
- **PII isolation holds** — traced every reader: `contest_entry_private_fields` + `contest_agreement_acceptances`
  are read ONLY inside `submissions.ts` (the PII upsert-lock + the gated `getEntryPrivateData`). The
  `/entries` list + `/entries/[entryId]` detail + judge page read only `stageSubmissions` (partitioned, no
  PII). No leak path; contests don't federate.
- **`255b5ced` FIXED (real bug)** — the proposal-submit redirect guessed the project type client-side
  (`eligibleContentTypes[0] ?? 'project'`) while the server derives `placeholderType` differently (skips
  non-creatable types, then `createContent` normalizes `article→blog`). When `eligibleContentTypes[0]` isn't
  creatable (e.g. the `article` alias), the server made a `project` but the client navigated to
  `/u/<un>/article/<slug>/edit` → 404. Fix: `submitContestProposal` returns `contentType` (the ACTUAL created
  type); route + ContestProposalForm + index.vue navigate with it. Regression test (eligible `['article']` →
  `contentType: 'project'`, RED on revert). Also anchored the `/private` route's contestId/userId to the
  validated context (getEntryPrivateData can't fill them for an agreements-only entry).
- Decomposition spot-checked: `submissions.ts` correctly imports from `./stages`, `./validation`, `./types`;
  build clean; full suite green. No dropped exports (the server top-level re-export-by-name would fail build).
- Gates after audit fix: schema 475, server **1480**, layer 1223, reference vue-tsc 0.

**Session 214 cont. — Phase 3 (display redesign + the hydration bug):**
- `32c0aa29` (audit follow-up) dedupe repeated autosave-error toasts (a persistent error retried every
  ~3s spammed the same toast).
- `6a332c14` **Editor hydration mismatch FIXED.** Diagnosed by capturing the FULL Vue warning (the public
  VIEW page was clean; the mismatch was on the EDIT page, contra the earlier note). Two causes: (1)
  `CpubDateTimeField` rendered TZ-dependent value/min/max (`toLocalInput` uses the runtime TZ) — a
  prod-SERIOUS bug since Vue does NOT rectify attribute mismatches in prod (viewer would see the SERVER
  timezone); fixed by deferring the local conversion to `onMounted` (render empty until mounted). (2) The
  whole editor SSR-rendered with an unhydrated model (data loads via a client lazy fetch) → e.g. the
  slug-preview text mismatched; fixed by wrapping the (authed, no-SEO) editor in `<ClientOnly>`.
- `e476b339` **Hero slimmed + cover surfaced** (operator chose "compact bar under slim banner" + "cover as
  lead image in Overview"). `ContestHero` rewritten: slim banner (≤220px) + ONE clean compact bar (badge,
  status pill, stage chip, right-aligned inline countdown chip, title, tagline, dates + entries, Submit/
  Share, admin transitions). `coverImageUrl` now renders as a framed lead image atop the Overview/About
  tab. Folded in the LATENT view-side TZ mismatch fix: `ContestHero` dates + `ContestSidebar` timeline
  dates are `mounted`-gated (they'd mismatch in prod UTC-vs-local).
- `ecd0da06` **One date formatter** (plan's typography goal): `formatLocalDate(iso, { year })` in
  `utils/datetime`, used by Hero/Sidebar/Entries (killed 3 inline `toLocaleDateString` copies).
- Verified live: editor + view pages log ZERO hydration messages; hero compact with/without banner; cover
  lead image; sidebar timeline dates; axe 0 on the hero; create-via-button still 200+navigates.
- **Phase 3 judges-in-overview:** already satisfied by the `judgesShowcase` block (2c) — organizer-opt-in,
  renders in the Overview when added; Judges tab stays canonical otherwise. No new work needed.
- `fffaebec` **(audit follow-up)** dropped a colliding per-mode class: `ContestBodyEditor`'s wrapper carried
  `:class="cpub-cbe-${mode}"`, which in preview/code mode added `cpub-cbe-preview`/`cpub-cbe-code` to the
  WRAPPER, colliding with the inner content divs of the same name (double padding/styling; 6
  `.cpub-cbe-preview` rendered for 3 editors). Removed (it was also dead — no `.cpub-cbe-write` rule).

**Adversarial audit (session 214, post-Phase-3, all PASS except the class collision above):**
- All gates green at HEAD `fffaebec`: server 1469, schema 470, layer 1204, reference vue-tsc 0.
- Re-verified the risky changes live: under `<ClientOnly>` + the `CpubDateTimeField` mounted-gate, the editor
  dates still DISPLAY correctly (17:00Z→10:00 local) AND ROUND-TRIP (edit End to 09:00 local → autosave →
  persisted `16:00Z`, exact at UTC-7); autosave indicator reaches "All changes saved"; Preview/Code modes
  still work; create-via-button still 200+navigates. Editor + view pages log ZERO hydration messages.
- Hero fallback states all correct: completed→"Contest ended", paused→"Submissions paused",
  draft→"Draft, not launched"; pills correct. axe 0 on the hero.
- ClientOnly is NOT a double-mount (`.cpub-contest-edit`=1, `.cpub-contest-body-editor`=3); the "6" was the
  class collision, now fixed.

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
10. ~~**Phase 3** layout/cover redesign (slim hero, surface coverImageUrl).~~ **DONE (session 214).** Slim
    compact-bar hero, cover lead image in Overview, editor + view hydration mismatches fixed, one date
    formatter. · **Phase 4** submission paths
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
1. `git -C <repo> log --oneline main..HEAD` (branch `contests`, clean; newest = `fffaebec`, origin in sync).
2. Gates: `pnpm -C packages/server exec vitest run` (1469), `pnpm -C layers/base exec vitest run` (1204),
   `pnpm -C packages/schema exec vitest run` (470), `cd apps/reference && pnpm typecheck` (0).
3. Visual verify: follow `reference_local_run_and_visual_verify`. Verified gotchas this session: app reads
   `NUXT_DATABASE_URL`; **DB password is `commonpub_dev`** (container `commonpub-postgres-1` on :5433);
   `nuxt dev` on `PORT=3100`; Playwright `waitUntil:'domcontentloaded'`; `Origin` header on custom POSTs;
   the FIRST `.fill()` of a `datetime-local` is flaky (double-fill or `waitForFunction(()=>!btn.disabled)`);
   capture FULL Vue console warnings to diagnose hydration mismatches (they name the node + server/client
   values). Block tuple shape: heading `['heading',{text,level}]`, paragraph `['paragraph',{html}]`.

## Landmines
- `layers/base/theme/` is a GENERATED gitignored copy — edit `packages/ui/theme/`; refresh with
  `node layers/base/scripts/bundle-theme.mjs`.
- Every dark theme MUST declare `color-scheme: dark`.
- datetime-local: use `utils/datetime` (`toLocalInput`/`fromLocalInput`), never `toISOString().slice`.
- Adding a contest canvas tab = `ContestBodyTabs` `extraTabs` prop + a `#<key>` slot (don't special-case).
- New contest blocks live in-layer (view in BlockContentRenderer map; edit via `provide(BLOCK_COMPONENTS_KEY)`).
- Don't put backticks in a double-quoted `git commit -m` (shell runs them); use single quotes.
