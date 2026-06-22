# Session 213 — contest elevation kickoff prompt

Paste the block below as the first message in a fresh session.

---

ultrathink. You're resuming the **contest elevation** initiative in this `commonpub` monorepo. All work
continues on branch **`contests`** (already created + pushed to origin). Do NOT merge to main, deploy, or
publish anything without my explicit go-ahead — keep iterating on the branch.

**Read first, in order:**
1. `docs/sessions/211-contest-elevation.md` — the rolling handoff: TL;DR, what's done (incl. the Session 213
   block), the COMPLETENESS SWEEP (what's still missing, with DONE strikethroughs), the adversarial-audit
   results, data notes, release notes, resume checklist, and landmines. This is your map.
2. `docs/plans/contest-elevation.md` — the 6-phase plan + the §"Target contest editor" shell architecture +
   §7 open sub-decisions.
3. Your memory should surface `project_session_211_contest_elevation` (current state, kept up to date) and
   `reference_local_run_and_visual_verify` (how to run the app locally + drive Playwright for visual tests).

**Phase 0 — verify before any new work:**
- Branch is `contests`, tree clean, `git log --oneline main..HEAD` shows the contest commits (newest
  `d18d331b`, an audit-handoff doc; newest CODE commit is `2d9cd055`). `origin/contests` is in sync (ahead 0).
- Gates green: `pnpm -C packages/server exec vitest run` (1469) · `pnpm -C layers/base exec vitest run`
  (1187) · `pnpm -C packages/schema exec vitest run` (470) · `cd apps/reference && pnpm typecheck` (EXIT 0).
  If anything is red, fix it before new work.

**Where things stand (Phase 1 + Phase 2a–2d + 2e-1 + 2e-2a/b.1/b.2/b.3/b.4 + 2e-2d are DONE + audited):**
The contest editor is now ONE mode-aware component, `layers/base/components/contest/ContestEditor.vue`, used
by BOTH `pages/contests/create.vue` and `pages/contests/[slug]/edit.vue` as 1-line thin shells
(`<ContestEditor mode="create|edit" />`). The form model is the tested composable
`layers/base/composables/useContestEditor.ts` (refs · slugify · ISO date validation · dirty · hydrate ·
buildPayload · mode-aware POST/PUT save · 15 tests). **create ≡ edit (the big divergence is fixed).** Shell =
sticky topbar + full-width body canvas (`ContestBodyTabs`: Overview/Rules/Prizes + Stages/Judging extra tabs)
+ a settings rail (Details/Schedule/Prizes/Visibility in the main column; Entries/People/Stage&Status/Danger
in the aside). Dates are stored as **ISO** (CpubDateTimeField does local display). Full E2E save-verify passed
(create with blocks+criteria+prizes → persists exactly → edit re-renders the blocks → edit-save doesn't
clobber). Reuse these, don't rebuild: `ContestEditor`, `useContestEditor`, `ContestBodyTabs`,
`ContestBodyEditor`, `ContestCriteriaEditor`, `ContestStagesEditor`, `CpubDateTimeField`,
`ContestJudgeManager`/`ContestStakeholderManager`, `utils/{datetime,contestBody,contestStages,contestTransitions}`,
`seedBodyBlocks`.

**Where to resume — recommended: Phase 2e-2c** (the last of the editor-shell polish), then Phase 3:
- **2e-2c** — cover/banner **placeholders** above the canvas (like the project/blog editors show where each
  image appears), plus **Write / Preview / Code** mode switch (Preview renders the real contest page; Code
  shows the BlockTuple[] JSON), plus **autosave** for drafts via the existing `useEditorAutosave`. Cover +
  banner are currently plain `ImageUpload` fields in the Details section.
- **Phase 3** (display/layout redesign) — slim the two-band hero into one cohesive header, **surface
  `coverImageUrl`** on the detail page (it's collected but never rendered there), judges-in-overview, a
  typography pass. While in the hero, chase the pre-existing "Hydration completed but contains mismatches"
  the public contest VIEW page logs (likely a date/countdown SSR mismatch).
- After that: Phase 4 (submission paths: agreements + PII + proposal-form → placeholder project +
  export-collection, with flags `contestProposals`/`contestPii` + the `contest.pii.read` permission), Phase 5
  (judging UX + Excel/CSV export, incl. B3 = validate judge `criteriaScores` vs the rubric), Phase 6 (cleanup:
  drop dead `judges`/`content_format` cols; B5a = `judge.post.ts` ignores its `:slug`; release).
- Smaller open items you can fold in: settings could be grouped tighter (move more of Details/Schedule into
  the aside per my "all settings in a right panel" wish — partially there); `FormatToggle.vue` is now orphaned
  (removal pending plan decision #4 — ask me). Ask which to pick up if unsure; recommend a default.

**How I want you to work (this has been the rhythm — keep it):**
- ultrathink + a REAL adversarial audit each turn; trace chains end to end; **make no assumptions; verify
  every claim against the source** (read the file, run the query, don't trust memory or "should").
- TDD with a mutation bar — each fix needs a test that goes RED on revert (server → PGlite/real-PG harness in
  `packages/server/src/__tests__/helpers`; components → @testing-library/vue + axe; pure logic / composables →
  unit, stub `$fetch`/`confirm` via `vi.stubGlobal` and pass context callbacks as spies — see
  `useContestEditor.test.ts` / `useDocsSiteSettings.test.ts`).
- VISUALLY VERIFY every UI slice in the real running app via the `reference_local_run_and_visual_verify`
  recipe, then Read the screenshot. Stop the dev server when done.
- Componentize cleanly — no monolith, no tangled web, no cruft/duplication; strict types (no `any`); prune
  dead code + CSS as you go.
- Atomic commits per logical change; run gates (suites + typecheck) before each commit; update
  `docs/sessions/211-contest-elevation.md` + the project memory each session.
- Ask before a big architectural fork; give a recommendation.

**Standing rules (CLAUDE.md):** no merge/deploy/publish without my go-ahead · `var(--*)` only (no hardcoded
color/font) · no em dashes in user-facing copy · `cpub-` class prefix · TS strict, no `any` · WCAG 2.1 AA +
axe on new components · no AI co-author in commits · committed migrations only (`db:push` is fine for the
LOCAL dev DB, never prod) · every new feature behind a flag in `commonpub.config.ts`.

**Landmines (full list in the handoff):**
- `layers/base/theme/` is a gitignored GENERATED copy — edit `packages/ui/theme/` (base/dark/components/
  prose.css), then `node layers/base/scripts/bundle-theme.mjs` to refresh the local copy.
- Every dark theme must declare `color-scheme: dark`.
- datetime-local ↔ ISO: use `utils/datetime` (`toLocalInput`/`fromLocalInput`), never
  `new Date(iso).toISOString().slice(0,16)`. The editor model stores ISO; `CpubDateTimeField` converts.
- New contest block: view component in `BlockContentRenderer` map + edit component via
  `provide(BLOCK_COMPONENTS_KEY)` (the `@commonpub/editor` registry is UNUSED). Block tuple shape: heading is
  `['heading', { text, level }]`, paragraph is `['paragraph', { html }]` — NOT `{ content }`.
- New contest canvas tab: `ContestBodyTabs` `extraTabs` prop + a `#<key>` slot (don't special-case).
- `ContestStagesEditor`'s `startDate/endDate/judgingEndDate` props are VESTIGIAL (declared, never read).
- Don't put backticks in a double-quoted `git commit -m` (the shell runs them); use single quotes.
- After changing a `packages/*` type, rebuild that package so the layer/app typecheck sees it.
- **Local run gotchas (verified this session):** the app reads **`NUXT_DATABASE_URL`** (not `DATABASE_URL`);
  Docker PG is `commonpub-postgres-1` on `:5433` (`postgresql://commonpub:commonpub_dev@localhost:5433/commonpub`);
  use a free port for `nuxt dev` (`PORT=3100`, since 3000 = doot-games); Better Auth sign-up needs a
  **`username`** field (the `users` table — plural — has username NOT NULL); admin-promote via
  `docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "UPDATE users SET role='admin' WHERE email='…'"`;
  drive Playwright with `waitUntil: 'domcontentloaded'` (dev HMR websocket never reaches `networkidle`); send
  an `Origin` header on custom `/api/*` POSTs.

Start with Phase 0, then propose your plan for 2e-2c (or Phase 3) and proceed.
