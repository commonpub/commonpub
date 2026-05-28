# Session 162 — fresh-context kickoff prompt

Paste the prompt block below (everything between the `---` rules) as the **FIRST message** of the new Claude Code session. Designed for a cold-start session with no prior context.

---

Fresh Claude Code session on the CommonPub monorepo.

**Predecessor**: session 161 shipped 6 commits on `main`. **All session 160 audit P1s are closed.** Editor is live at `https://commonpub.io/admin/layouts` (gated on `features.layoutEngine`). 298 layer tests + 470 schema + 1126 server + 3 skipped + repo typecheck 26/26 fresh. heatsync + deveco UNTOUCHED on npm 0.24.0 (standing user direction — DO NOT publish or modify without explicit user approval).

Final commit: `b1e6ccf` (session-close doc on top of `494310f` = canvas no-squish).

## Session 161 in two paragraphs

User asked Phase 3b drag-drop vs schema-package refactor — picked schema refactor. Mid-session they screenshotted the editor canvas getting squished on `/admin/layouts/[id]` (admin sidebar AND the editor's own 3-col shell both eating canvas room) and noted "deal with this later". Then "ultrathink audit then continue" turned into a self-audit + 4 follow-up commits that closed every outstanding session 160 audit P1, fixed two P2 correctness issues, and addressed the squish via two independent fixes (collapsible admin sidebar in commit 1; collapsible palette + inspector in commit 5).

Six commits in order: `4d9d92c` admin sidebar collapse → `af390c1` schema refactor + per-section configSchema enforcement → `46126df` self-audit polish (useCookie no-flash) + migrate-homepage in-place update → `ea03af6` AbortController on save → `494310f` editor canvas no-squish → `b1e6ccf` session-close summary. heatsync + deveco UNTOUCHED throughout. 0 npm publishes. **Both user-flagged squish complaints fixed.** Two new composables shipped: `useAdminSidebar` (admin chrome) + `useEditorChrome` (palette + inspector visibility). Two new feedback memories captured: `feedback-vitest-import-meta-client-undefined` + `feedback-vi-restoreallmocks-wipes-vifn-impls`.

## Mandatory reads before any code (in order)

1. **`CLAUDE.md`** at the repo root — standing rules. Critical ones:
   - #2 No feature without a flag (in `commonpub.config.ts`)
   - #3 `var(--*)` only in any component styles
   - #11 Test-driven (tests first or alongside)
   - #12 Accessibility-first — WCAG 2.1 AA minimum
   - #14 Research before building — web research for each major system
   - **#15 NEVER add Claude as co-author** — no `Co-Authored-By`, `Signed-off-by`, or any AI attribution in git commits, ever

2. **`MEMORY.md`** index, then these priority memories:
   - `feedback-no-coauthor` — re-pinned because rule #15 is the most violated default
   - `feedback-visual-editor-ux-patterns` (160 R1) — cursor as contract, save-trust signals, 3-option conflict modal, Strapi 3-state, 28×28 touch targets (WCAG AA = 24×24 min not 44), drag-drop a11y, 10 anti-patterns
   - `feedback-editor-security-patterns` (160 R2) — draft-leak guard with cache-key bifurcation, per-section schema enforcement at API boundary, URL scheme refinement, single-flight save guard, array `.max()` bounds, structured stdout audit logs
   - `feedback-editor-db-perf-patterns` (160 R4) — Drizzle indexes only used if WHERE clause references them, force-replace destroys cascade history, bounded LRU one Map's worth of code, beforeunload + onBeforeRouteLeave together
   - `feedback-vitest-import-meta-client-undefined` (161) — `import.meta.client` is undefined in vitest; use `typeof window` for portable browser guards
   - `feedback-vi-restoreallmocks-wipes-vifn-impls` (161) — `vi.restoreAllMocks()` resets impl of `vi.fn(impl)` mocks; use `vi.clearAllMocks()` to preserve impls
   - `feedback-reuse-existing-components` — Layout engine is an ARRANGER for existing components; never write parallel renderers
   - `feedback-phase-3-hybrid-libraries` — `grid-layout-plus@1.1.1` + `@vue-dnd-kit/core@2.4.6` installed; FormKit deferred to 3e
   - `feedback-deploy-health-check-warn-not-fail` — NEVER trust `gh run list` for deploys; ALWAYS curl `/api/health`
   - `feedback-pnpm-publish-layer` — Never `npm publish` the layer; use `pnpm publish:layer`
   - `feedback-caret-semver-0x-minor-bump` — `^0.21.22` = `>=0.21.22 <0.22.0`; hand-edit consumer package.json
   - `project-session-161-sidebar` + `project-session-161-schema-refactor` — accurate session summaries

3. **Session log + close-doc** (in priority):
   - **`docs/sessions/161-session-close.md`** — single-page tying together all 6 commits, test deltas, what's closed, what's deferred. **Read this first; it's the canonical summary.**
   - `docs/sessions/161-admin-sidebar-collapse.md` — sidebar work + audit-polish post-script
   - `docs/sessions/161-schema-package-refactor.md` — schema refactor session log
   - `docs/sessions/161-handoff-prompt.md` — superseded by this doc; keep for the deferred-queue strikethroughs that show what got done

4. **Plan docs** (still active, no changes):
   - `docs/plans/phase-3-editor.md` — Phase 3a checklist all ✅; 3b-3f remain (3b drag-drop is the natural next big arc)
   - `docs/plans/layout-engine-rollout.md` — Stage D ✅ (Phase 3a + 4 audits); Stage E (3b drag-drop) is next
   - `docs/plans/layout-and-pages.md` §7 (Editor UX) — design source of truth for 3b. Specifically §7.3 (eight gestures), §7.4 (drop targets), §7.5 (resize), §7.6 (state machine), §7.8 (a11y), §7.14 (undo/redo)
   - `docs/adr/027-layout-engine-architecture.md` — architecture ratified, decisions documented

## Verify current state (read-only)

```bash
# All 3 sites healthy
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
  echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
done

# commonpub.io homepage DOM markers unchanged (3 layout-rows + 5 layout-sections)
curl -sS https://commonpub.io/ | grep -oE 'class="[^"]*cpub-layout-(row|section)[^"]*"' | grep -oE 'cpub-layout-(row|section)(--editable)?' | sort | uniq -c

# Editor reachable (302 = login redirect, expected when unauth)
curl -s -o /dev/null -w '/admin/layouts = %{http_code} (302 expected)\n' https://commonpub.io/admin/layouts

# Public layout endpoint serves the published homepage
curl -sS 'https://commonpub.io/api/layouts/by-route?path=/' | grep -oE '"state":"[^"]+"' | head -1

# New CSS token shipped (sidebar collapse)
curl -sS https://commonpub.io/ | grep -oE '\-\-sidebar-width(-collapsed)?:[^;]+' | sort -u

# Libraries installed (Phase 3b deps)
grep -E 'grid-layout-plus|@vue-dnd-kit' layers/base/package.json

# Test counts
pnpm --filter @commonpub/layer test 2>&1 | grep -E "Tests" | tail -1
pnpm --filter @commonpub/schema test 2>&1 | grep -E "Tests" | tail -1
pnpm --filter @commonpub/server test 2>&1 | grep -E "Tests" | tail -1
pnpm typecheck 2>&1 | tail -3
```

**Expected**: all 3 sites health=200, DOM markers `3 cpub-layout-row` + `5 cpub-layout-section`, `--editable` ABSENT from public DOM, `/admin/layouts=302`, state="published", BOTH `--sidebar-width: 12.5rem` AND `--sidebar-width-collapsed: 3.5rem` present, `grid-layout-plus@1.1.1` + `@vue-dnd-kit/core@2.4.6` in package.json, **layer 298**, **schema 470**, **server 1126 + 3 skipped**, typecheck 26/26. If anything diverges: STOP and investigate.

## Pick your path (ask the user up front)

After session 161 closed all P1s + addressed the user's screenshot complaint, the natural next moves are:

**Path A — Phase 3b drag-drop (the big architectural arc, 2 sessions)**
Wires `grid-layout-plus@1.1.1` (already installed) + `@vue-dnd-kit/core@2.4.6` (already installed) for canvas drag/resize + palette → canvas drop + within-row reorder + selection model + Inspector dispatcher finally activating (currently selects only page-meta). Now that the editor canvas no longer squishes (session 161), drag interactions have room to feel right.

Session A/1: palette → canvas drag + within-row reorder + drop indicators + save-on-drop + selection model (Inspector finally swaps to row/section forms)
Session A/2: cross-zone drag + FLIP animations + Pinia undo/redo + tests

Hard a11y requirements: `@vue-dnd-kit/core` keyboard sensor, `aria-live="assertive"` for position-based narration ("Hero moved to position 3 of 5"), Move Up/Down keyboard buttons on every section (WCAG 2.1.1 Level A), test against NVDA + Firefox. NEVER `aria-grabbed`/`aria-dropeffect` (deprecated), NEVER `role="application"`.

Hard cursor rule: `cursor: grab` only when the drag handler is wired (per `feedback-visual-editor-ux-patterns` — the #1 "UI lies" pattern).

**Path B — P2 sweep (clear smaller items, 1 session)**
Remaining P2 from the deferred queue (5-8 items):
- `LayoutRecord → LayoutPayload` type narrow
- Inspector storm + dirty cost at N=50+ sections
- `pagehide` + `navigator.sendBeacon` for tab close
- Conflict cascade throttle
- `listLayouts` N+1 in admin list page (medium effort — perf fix via `inArray` batch query)
- Partial publish-chain failure UX (separate try/catch per step + nuanced toasts)
- Dashboard Quick Actions tile for `/admin/layouts`
- **Figma-style viewport zoom controls** — complements session 161's collapse fix for users who want full chrome AND zoomed preview. Bigger lift (transform-origin math + scrollable canvas + zoom-to-cursor)

**Path C — Stale-docs sweep (R5 doc audit unfinished items)**
- `packages/learning/README.md` MISSING
- `apps/reference/README.md` MISSING
- `packages/schema/src/openapi.ts` doesn't include layout endpoints
- `packages/ui/README.md` doesn't have a section-registry section
- `packages/config/README.md` feature-flag list may need `layoutEngine`
- `layers/base/README.md` "What's Included" tables are stale

Path A is the obvious next big push. B is good if the user wants a clearing session. C is good if they want documentation parity for an upcoming public moment.

## Deferred queue (post-session 161 — all P1s closed)

**P2 (UX + perf)** — none closed since 161 wrap; canvas zoom is the user-flagged follow-up:
- `LayoutRecord → LayoutPayload` type narrow
- Inspector storm + dirty cost at N=50+ sections
- `pagehide` + `navigator.sendBeacon` for tab close (covers a unique edge case the visibilitychange flush misses)
- Conflict cascade throttle
- `listLayouts` N+1
- Partial publish-chain failure UX
- Dashboard Quick Actions tile for `/admin/layouts`
- Figma-style viewport zoom controls (complementary to today's collapse)

**P3 (trivia)**:
- 30s setInterval pause on tab hidden (R2)
- `useLayoutEditor` provide/inject (R2)
- Drop `idx_layouts_scope` (redundant with UNIQUE) (R4)
- Separate operator runbook `docs/guides/operator-layout-engine.md` for non-technical operators

**Doc-side (R5)**: see Path C above.

## Hard rules (re-pinned from CLAUDE.md + audit memories)

- **No AI attribution** in any commit / PR / git artifact (CLAUDE.md #15)
- **`pnpm publish:layer`** for layer publishes — never `npm publish`
- **Caret semver on 0.x.y excludes minor bumps** — hand-edit consumer package.json
- **Pre-push hook runs typecheck**; bypass only with `SKIP_SIMPLE_GIT_HOOKS=1` when intentional
- **NEVER trust `gh run list`** for deploys — always curl `/api/health` after
- **Don't duplicate existing components** (layout engine is an ARRANGER)
- **Test-driven** — tests alongside or before code
- **`var(--*)` only** for any new styles
- **WCAG 2.1 AA** on every interactive element
- **Editor admin-only** — gate `/admin/layouts/*` on `requireFeature('admin')` + `requireFeature('layoutEngine')` (locked by contract test)
- **commonpub.io ONLY** as test bed — heatsync + deveco stay on layer 0.24.0 dormant unless user explicitly directs otherwise
- **Layouts are local-only** — don't add to `@commonpub/protocol` without an ADR superseding 027
- **Cursor as contract** — `cursor: grab` only when drag is wired (`feedback-visual-editor-ux-patterns`)
- **Single-flight save** stays in place — any new save-triggering surface routes through `useLayoutEditor.save()`
- **`useCookie` over `useState` + `localStorage`** for any new persistent UI state — matches `useTheme` / `useAdminSidebar` / `useEditorChrome` pattern; no SSR/CSR hydration flash
- **Server-side state from `@commonpub/schema`** — if you need a Zod schema in a server handler, it MUST come from `@commonpub/schema` (never from `layers/base/sections/builtin/*` or any file that transitively imports `.vue`)

## End state (session 161 close, verified live)

- commonpub.io: workspace `main` (`b1e6ccf`). Editor live at `/admin/layouts` + `/[id]` with collapsible palette + inspector + collapsible admin sidebar. Public homepage DOM byte-pattern unchanged (3 rows + 5 sections, no `--editable` leak). All 3 sites health=200.
- Tests: layer **298**, schema **470**, server **1126** + 3 skipped, repo typecheck 26/26 fresh.
- All session 160 audit P1s closed. R4 P2 AbortController also closed.
- 4 new memories captured. All indexed in `MEMORY.md`.
- Docs: README + CHANGELOG + CLAUDE.md + ADR 027 + layout-engine guide all current as of session 160 close; codebase-analysis files 02 + 05 + 10 + 11 bumped with session 161 changes; session log + handoff queue current.

## One quirk for next session — deploy timing

Session 161's first push took **~25 min** to deploy (vs the usual 6-7 min) because `pnpm-lock.yaml` changed (added `@img/sharp-wasm32` as a devDep to work around a local Mac Nitro-build ENOENT error). That invalidated the Docker `install deps` layer cache. The LAST deploy of session 161 was already back to ~7 min — cache is rebuilt. **Watch the first deploy of session 162; it should be normal speed. If it's still slow, investigate.**

## First action

Confirm you've read the priority docs (one paragraph max). Then ask the user **"Phase 3b drag-drop, P2 sweep, or stale-docs sweep?"** Don't start coding until they pick.

**If 3b**: spawn an Explore agent for current best-practice patterns on Vue 3 grid-layout-plus + @vue-dnd-kit/core integration before coding. The libraries are mature but integration patterns matter — and the a11y bar is high.

**If P2 sweep**: start with `listLayouts` N+1 (highest impact for ops) and the Dashboard Quick Actions tile (highest UX visibility). Save the Figma-style zoom controls for a dedicated session if you don't get to them.

**If docs sweep**: start with the missing READMEs (`packages/learning`, `apps/reference`) — they're conspicuously absent. The other items are cleanup/freshness.

Don't accumulate debt. Finish what's started before adding scope. If you find another bug while doing the picked work: log it in the audit queue, fix immediately if P0/P1, otherwise defer.

---

## How this prompt was assembled (notes for future-Claude)

Session 161 closed every outstanding P1 from the prior audit rounds. The natural next inflection point is whether to take on the next big architectural arc (Phase 3b) or sweep the smaller queue. The user has demonstrated they value: thorough audits, no redundant work (always check what's implemented), updating codebase-analysis in lockstep, no AI co-author attribution, and verifying deploys via `curl /api/health` rather than `gh run list`.

If updating this prompt for a future session, re-check: `MEMORY.md`, `docs/sessions/161-session-close.md`, `docs/sessions/161-handoff-prompt.md`'s deferred-queue strikethroughs, `docs/plans/phase-3-editor.md`, `docs/plans/layout-engine-rollout.md`. The deferred queue should mirror what's actually in the codebase + audit docs.
