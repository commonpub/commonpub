# Session 217 kickoff — Contest editor 3-panel shell redesign

> Paste-ready kickoff for a fresh-context session. Branch **`contest-editor-shell`**. The contest feature
> is already LIVE on commonpub.io (merged to main session 216); THIS branch is a fresh, **not-yet-built**
> redesign of the contest EDITOR to match the house project/blog/explainer editor. Do NOT merge to main,
> deploy, or publish without explicit go-ahead — iterate on this branch.

---

ultrathink. You're picking up the **contest editor 3-panel shell redesign** in the commonpub monorepo. The
contest editor today is a single scrolling column (banner/cover strip → tabbed body → all settings stacked
below in a 2-col grid), rendered inside the site nav. The operator wants it to FEEL like the house
project/blog/explainer editor: **left block palette · center body with tabs · right settings rail**, with
banner+cover in the body, plus a new **HTML block**. The design is DONE and decisions are LOCKED; your job
is to BUILD it in verifiable, screenshotted slices.

## Read first, in order
1. `docs/plans/contest-editor-shell.md` — THE plan. Full inventory of everything the editor must contain,
   the reference architecture, the target layout (ASCII), the stitching, the HTML block, the phasing, and
   the locked decisions (§3, §8). This is your map.
2. `layers/base/components/editors/ProjectEditor.vue` — THE reference 3-panel shell to match (left
   `EditorBlocks` 220px / center canvas with inline cover + title + `BlockCanvas` / right `EditorSection`
   settings 280px). Also skim `ArticleEditor.vue`.
3. `layers/base/pages/u/[username]/[type]/[slug]/edit.vue` — the content editor PAGE: `layout: false`,
   owns `cpub-editor-layout` + `cpub-editor-topbar` (title input, autosave, Write/Preview/Code, Save), then
   mounts the per-type editor. Copy this frame for the contest editor.
4. `layers/base/components/contest/ContestEditor.vue` (623 lines) — what you're restructuring. Form model
   already lives in `layers/base/composables/useContestEditor.ts` (refs, save, hydrate, buildPayload,
   slugify, toggleType/Role, prizes helpers) — REUSE it; you're reshaping the template + CSS, not the logic.
5. Memory should surface `project_session_211_contest_elevation` (contest feature state) and
   `reference_local_run_and_visual_verify` (run the app + drive Playwright).

## Phase 0 — verify before any new work
- Branch `contest-editor-shell`, tree clean. Newest commit `ca95bb39` (the plan). It branched off `main`
  (`628b5299`), which has the contest feature LIVE on commonpub.io.
- Gates green: `pnpm -C packages/server exec vitest run` (1490) · `pnpm -C layers/base exec vitest run`
  (1223) · `pnpm -C packages/schema exec vitest run` (475) · `cd apps/reference && pnpm typecheck` (0) ·
  `cd apps/shell && pnpm typecheck` (0). **The pre-push hook runs `turbo typecheck` across ALL apps —
  typecheck BOTH reference AND shell before pushing.**

## Where things stand
- The contest feature (elevation Phases 1-6 + the monolith-splits backlog) is MERGED to main (`00139353`)
  and LIVE on **commonpub.io only** (deploy `28019122283`, migrations 0028-0031 applied, flags
  `contestProposals`/`contestPii` present + OFF). **deveco.io + heatsynclabs.io are NOT updated** — they
  await a separate npm publish chain (schema→config→server→ui→layer); don't touch them.
- This `contest-editor-shell` branch has ONLY the plan committed. Nothing built yet. Resume at Phase 1.

## The design — LOCKED (don't re-litigate)
Make `contests/[slug]/edit.vue` + `contests/create.vue` `layout: false` full-screen editors;
`ContestEditor.vue` renders the `cpub-editor-layout` topbar + a 3-panel `cpub-ce-shell`:

```
TOPBAR  [back] Title… [STATUS] ·autosave· | Write Preview Code | spacer | View↗  Save  Status▾
┌─ LEFT 220 ─┬──────── CENTER (3 prose tabs) ────────┬──── RIGHT ~340 ────┐
│ EditorBlocks│ tabs: Overview · Rules · Prizes        │ EditorSection rail  │
│ always-on   │ [Overview] leads with inline BANNER +  │ Details (slug,sub)  │
│  Basic:Text │   COVER (project cover-in-body, hover  │ Schedule (dates)    │
│  Heading    │   upload/replace/remove). Rules/Prizes │ Stages ▸ editor +   │
│  Image Code │   show no media.                       │   advancement[edit] │
│  Contest:   │ shared <BlockCanvas :block-editor=     │ Entries (types,max) │
│   Judges    │   activeBodyEditor :block-types=groups>│ Prizes (toggle+cards)│
│   Showcase  │ per-body Write/Preview/Code.           │ Judging ▸ rubric +  │
│  Media:Video│ statusbar: N blocks · N words.         │   visibility+voting │
│   Embed     │                                        │ Access (vis,roles)  │
│  Rich: … +  │                                        │ People [edit]       │
│   HTML(new) │                                        │ Danger [edit,owner] │
└─────────────┴────────────────────────────────────────┴─────────────────────┘
```

Locked decisions (session 217):
1. Center = **three prose tabs only** (Overview/Rules/Prizes). **Stages + Judging are RIGHT-RAIL sections**,
   not center tabs. Left palette is therefore always active.
2. Banner + cover render **inline in the Overview body only** (not above the tab bar).
3. Lifecycle transitions → topbar **`Status ▾`** menu; advancement stays inside the Stages rail section.
4. Right rail widened to **~340px** (Stages/Judging are dense); lay `ContestStagesEditor` /
   `ContestCriteriaEditor` out single-column so they read at rail width. If still cramped, a section may
   open a wider slide-over — try inline first.

### The one real refactor — hoist the body editors
Today each `ContestBodyEditor` owns its `useBlockEditor` internally. For the left palette to insert into the
ACTIVE body, lift the three editors into `ContestEditor.vue`:
`overviewEditor/rulesEditor/prizesEditor = useBlockEditor(seedBodyBlocks(...))`;
`activeBodyEditor = computed(() => ({overview,rules,prizes}[activeTab]) ?? overviewEditor)`. Feed
`activeBodyEditor` to BOTH the left `<EditorBlocks>` and the center `<BlockCanvas>`. `provide(UPLOAD_HANDLER_KEY)`
+ `provide(BLOCK_COMPONENTS_KEY, {judgesShowcase, html})` once at the ContestEditor level. buildPayload reads
`overviewEditor.toBlockTuples()` etc; dirty/autosave watch all three. `ContestBodyTabs`/`ContestBodyEditor`/
`ContestMediaStrip` collapse into the shell.

### New HTML block (operator asked for it)
- View `layers/base/components/blocks/BlockHtmlView.vue` — `sanitizeRichHtml(content.html, {neutralizeColors:true})`
  into `.cpub-md-html` (dark-safe; scripts stripped by the allowlist). Model on `BlockMarkdownView.vue`.
- Edit component (monospace `<textarea>` for raw HTML + tiny live preview) — model on the existing markdown block.
- Register: `html:` in `layers/base/components/blocks/BlockContentRenderer.vue` map; `provide(BLOCK_COMPONENTS_KEY,
  { html: ... })` in the editor; add to the palette **Rich** group next to Markdown. Available in all 3 bodies.
- Security: same sanitizer path as contest Full-HTML; add a sanitizer + axe test.

### Contest palette groups (`contestBlockGroups`)
Basic (Text·Heading·Image·Code) · Contest (Judges Showcase = existing `judgesShowcase`) · Media (Video·Embed)
· Rich (Tip·Warning·Quote·Divider·Markdown·**HTML**).

### Full inventory — nothing may be lost
Identity (title/slug/subheading) · media (banner/cover) · bodies (descriptionBlocks/rulesBlocks/prizesBlocks)
· schedule (start/end/judging dates) · stages (`ContestStagesEditor` + advancement) · entries
(eligibleContentTypes/maxEntriesPerUser) · prizes (showPrizes + cards) · judging (`ContestCriteriaEditor` +
judgingVisibility + communityVotingEnabled) · access (visibility/visibleToRoles) · people (judges via
`ContestJudgeManager`, collaborators via `ContestStakeholderManager`, edit-only) · lifecycle (transitions +
Danger delete, edit-only). All reused from `ContestEditor.vue` / `useContestEditor.ts` — read those for the
exact refs + handlers.

## Where to resume — build in screenshotted slices (operator wants early visual checkpoints)
Per the plan §7. Suggested order, screenshot + Read each before moving on:
1. **Shell scaffold** — pages `layout: false`; `ContestEditor` → `cpub-editor-layout` topbar +
   `cpub-ce-shell` (left palette placeholder, center prose tabs, right rail). Move EVERY settings section
   into the right rail as `EditorSection`s (Details/Schedule/Stages/Entries/Prizes/Judging/Access/People/
   Danger). Verify nothing lost. **Screenshot, show the operator.**
2. **Hoist body editors + wire the left palette** + shared `BlockCanvas`; collapse ContestBodyTabs/Editor.
3. **Inline media in the Overview body** (project cover-in-body pattern); remove the old strip.
4. **Topbar `Status ▾`** lifecycle menu; advancement stays in the Stages rail section.
5. **HTML block** (view + edit + registry + palette + tests).
6. Gates (all suites + BOTH app typechecks) + axe on new components + final visual verify. Update the plan
   + add a session log + project memory. STOP before any merge/publish/deploy for explicit go-ahead.

The editor stays `<ClientOnly>` (auth-gated, no SEO; its model hydrates from a client fetch — SSR would
mismatch). No new feature flag — this reworks existing surface behind the existing `contests` flag.

## How the operator wants you to work (keep this rhythm)
- ultrathink + a real adversarial audit each turn; trace chains end to end; verify every claim against the
  source (read the file, run the query, capture the FULL console warning — don't trust memory).
- **VISUALLY VERIFY every UI slice in the real running app, then Read the screenshot.** Build in small
  verifiable slices and screenshot each — the previous editor attempt drifted ("made it weird"), so early
  visual checkpoints are required. Stop the dev server when done.
- TDD with a mutation bar for logic (RED on revert); components → @testing-library/vue + axe.
- Componentize cleanly — no monolith, strict types (no `any`), prune dead code/CSS. Match the house editor
  layout VERBATIM in feel; don't invent.
- Atomic commits per logical change; run gates (suites + BOTH app typechecks) before each commit; update
  the plan + session log + project memory.
- Ask before a big architectural fork; give a recommendation.

## Standing rules (CLAUDE.md)
No merge/deploy/publish without go-ahead · `var(--*)` only (no hardcoded color/font) · `cpub-` class prefix
· TS strict no `any` · WCAG 2.1 AA + axe on new components · no em dashes in user-facing copy · committed
migrations only (none expected here) · no AI co-author in commits · every new feature behind a flag (n/a
here).

## Landmines (current)
- `layers/base/theme/` is a GENERATED gitignored copy — edit `packages/ui/theme/` then
  `node layers/base/scripts/bundle-theme.mjs`. Every dark theme declares `color-scheme: dark`.
- New block: VIEW in `BlockContentRenderer.vue` map + EDIT via `provide(BLOCK_COMPONENTS_KEY)`. The
  `@commonpub/editor` registry is unused; resolveComponent is static-literal only.
- After changing a `packages/*` type, rebuild that package (`pnpm build` in it) so the layer/app typecheck
  sees it. Adding a server route can perturb Nuxt typed-route `$fetch<T>` inference in ONE app — typecheck
  BOTH apps.
- datetime: use `utils/datetime` (`toLocalInput`/`fromLocalInput`/`formatLocalDate`), never
  `new Date(iso).toISOString().slice(...)`. Any server-rendered local-date display must be onMounted-gated.
- Vue `<style scoped>` hashes per component — when you extract a v-for'd subtree into a child, move the
  relevant scoped CSS WITH it (same commit) or it loses styling.
- No backticks in a double-quoted `git commit -m`.

## Local run + visual verify (`reference_local_run_and_visual_verify`)
- Docker PG `commonpub-postgres-1` on :5433, db/user `commonpub`, password `commonpub_dev`. App reads
  `NUXT_DATABASE_URL`. Start: `cd apps/reference && NUXT_DATABASE_URL="postgresql://commonpub:commonpub_dev@localhost:5433/commonpub" PORT=3100 pnpm dev` (3000 may be taken).
- Sign up via the UI/API (Better Auth needs a `username` field); admin-promote via
  `docker exec commonpub-postgres-1 psql -U commonpub -d commonpub -c "UPDATE users SET role='admin' WHERE email='…'"`.
  The `contests` flag is ON in the reference config; edit at `/contests/<slug>/edit`, create at
  `/contests/create`.
- Drive Playwright via its absolute `.pnpm` path; `waitUntil:'domcontentloaded'`; `Origin` header on custom
  `/api` POSTs; use the FULL signed `better-auth.session_token` cookie for an authed context. The FIRST
  `.fill()` of a `datetime-local` is flaky — double-fill or `waitForFunction(()=>!btn.disabled)`.
- `curl` can be missing on PATH inside compound subshells — use `python3 urllib` for HTTP checks.
  Screenshots via the Read tool. Stop the dev server (`lsof -ti:3100 | xargs kill`) when done.

That's the complete handoff. The design is locked in `docs/plans/contest-editor-shell.md`; resume at Phase 1
(the structural shell) on branch `contest-editor-shell` and screenshot each slice for the operator.
