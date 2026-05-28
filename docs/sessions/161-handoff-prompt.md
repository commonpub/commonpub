# Session 161 — fresh-context kickoff prompt

Paste the prompt block below (everything between the `---` rules) as the FIRST message of the new Claude Code session. Designed for a cold-start session with no prior context.

---

Fresh Claude Code session on the CommonPub monorepo.

**Predecessor**: session 160 SHIPPED Phase 3a layout editor + 4 audit rounds end-to-end on commonpub.io. Final commit `76c1090` on `main`. Editor is live at `https://commonpub.io/admin/layouts` (gated on `features.layoutEngine`). 264 layer tests + schema 431 + server 1125 + repo typecheck 26/26 fresh. heatsync + deveco UNTOUCHED on npm 0.24.0 (standing user direction — DO NOT publish or modify without explicit user approval).

## Session 160 in two paragraphs

Phase 3a sub-tasks 3a.1-3a.8 shipped the editor shell — list page + 3-column editor with palette/canvas/inspector + page-meta form + viewport segmented control + auto-save (1.5s debounce) with `If-Match` optimistic concurrency + 3-option conflict modal. Then **four post-shipping audit rounds caught + fixed 20 real bugs** before the session closed: R1 UX polish (cursor lie, conflict modal redesign, WCAG yellow contrast, Modified state pill, save timestamp, visibility flush), R2 security + correctness (P0 draft leak pre-existing from Phase 1c, ogImage scheme bypass, save race → single-flight guard, array `.max()` bounds, structured audit logs), R3 operational (user-reported `/admin/layouts` invisible in sidebar nav, misleading Migrate CTA, frame UI lie, server-side `pageMeta.access` enforcement via 3-tier cache bifurcation, 5 missing audit logs, mobile editor order), R4 DB + perf + edge cases (P0 `assembleLayout` full table scan, P0 legacy `/admin/homepage` save destroying layout-engine edits, bounded LRU cache, `beforeunload` + `onBeforeRouteLeave` guards, homepage-DELETE confirm header, Discard button wiring).

Three feedback memories captured for future editor work: `feedback-visual-editor-ux-patterns` (R1), `feedback-editor-security-patterns` (R2), `feedback-editor-db-perf-patterns` (R4). All indexed in `MEMORY.md`. Per-section configSchema enforcement is the only remaining significant deferral — implemented + tested but un-wired because the registry pulls Vue components into the server bundle. Proper fix is a schema-package refactor (move section Zod schemas to `@commonpub/schema`).

## Mandatory reads before any code (in order)

1. **`CLAUDE.md`** at the repo root — standing rules. Critical ones for this work:
   - #2 No feature without a flag (in `commonpub.config.ts`)
   - #3 `var(--*)` only in any component styles
   - #11 Test-driven (tests first or alongside)
   - #12 Accessibility-first — WCAG 2.1 AA minimum
   - #14 Research before building — web research for each major system
   - **#15 NEVER add Claude as co-author** — no `Co-Authored-By`, `Signed-off-by`, or any AI attribution in git commits, in any repo

2. **`MEMORY.md`** index, then these priority memories:
   - `feedback-no-coauthor` — re-pinned because rule #15 is the most violated default
   - `feedback-visual-editor-ux-patterns` (R1) — cursor as contract, save-trust signals, 3-option conflict modal, Strapi 3-state, 28×28 touch targets (WCAG AA = 24×24 min not 44), drag-drop a11y, 10 anti-patterns
   - `feedback-editor-security-patterns` (R2) — draft-leak guard with cache-key bifurcation, per-section schema enforcement at API boundary, URL scheme refinement, single-flight save guard, array `.max()` bounds, structured stdout audit logs, 5 anti-patterns
   - `feedback-editor-db-perf-patterns` (R4) — Drizzle indexes only used if WHERE clause references them, force-replace destroys cascade history, bounded LRU one Map's worth of code, beforeunload + onBeforeRouteLeave together, homepage scope is special, implementing ≠ wiring
   - `feedback-reuse-existing-components` — Layout engine is an ARRANGER for existing components; never write parallel renderers
   - `feedback-phase-3-hybrid-libraries` — `grid-layout-plus@1.1.1` + `@vue-dnd-kit/core@2.4.6` installed; FormKit deferred to 3e
   - `feedback-vue-tsc-strict-vs-vitest` — vitest is loose; vue-tsc is strict. Pre-push hook runs typecheck
   - `feedback-deploy-health-check-warn-not-fail` — NEVER trust `gh run list` for deploys; ALWAYS curl `/api/health`
   - `feedback-pnpm-publish-layer` — Never `npm publish` the layer; use `pnpm publish:layer`
   - `feedback-caret-semver-0x-minor-bump` — `^0.21.22` = `>=0.21.22 <0.22.0`; hand-edit consumer package.json
   - `project-session-160-phase-3a` — accurate session summary

3. **Session log + 4 audit docs**:
   - `docs/sessions/160-phase-3a-editor-shell.md` — main session log (post-script section enumerates R1-R4)
   - `docs/sessions/160-audit-godmode.md` — R1 (UX polish)
   - `docs/sessions/160-audit-round2-deep.md` — R2 (security + correctness)
   - `docs/sessions/160-audit-round3-ops.md` — R3 (operational, written retroactively in R5)
   - `docs/sessions/160-audit-round4-deep.md` — R4 (DB + perf + edge cases)

4. **Plan docs** (in priority):
   - `docs/plans/phase-3-editor.md` — Phase 3a checklist all ✅; 3b-3f remain. Hybrid library choices documented in decision log.
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

# Libraries installed (Phase 3b deps)
grep -E 'grid-layout-plus|@vue-dnd-kit' layers/base/package.json

# Test counts
pnpm --filter @commonpub/layer test 2>&1 | grep -E "Tests" | tail -1
pnpm --filter @commonpub/schema test 2>&1 | grep -E "Tests" | tail -1
pnpm typecheck 2>&1 | tail -3
```

**Expected**: all 3 sites health=200, DOM markers `3 cpub-layout-row` + `5 cpub-layout-section`, `--editable` ABSENT from public DOM, `/admin/layouts=302`, state="published", `grid-layout-plus@1.1.1` + `@vue-dnd-kit/core@2.4.6` in package.json, **264** layer tests, schema tests passing, typecheck 26/26. If anything diverges: STOP and investigate.

## Pick your path (ask the user up front)

**"Phase 3b drag-drop (the big feature, 2 sessions) or schema-package refactor (1 session, closes R2's deferred per-section validation)?"**

### Path A — Phase 3b drag-drop

Two-session arc per `docs/plans/phase-3-editor.md` §Phase 3b:

**Session A/1 — palette → canvas drag + within-row reorder**:
- 3b.1: Wire `grid-layout-plus@1.1.1` into LayoutSlot's editable mode — sections become draggable+resizable grid items
- 3b.2: Section palette uses `@vue-dnd-kit/core@2.4.6` `useDraggable` — drag a palette tile; `useDroppable` on each row/zone accepts the drop + creates a section via auto-save
- 3b.3: Drop indicator (between-row line, between-section gap) using dnd-kit's collision detection
- 3b.4: Save-on-drop via existing auto-save scaffolding — single-flight guard handles concurrent drops
- 3b.5: Tests
- **Selection model lands for free** with click handlers — Inspector dispatcher (3a.3) can finally swap between page-meta / row / section forms

**Session A/2 — cross-zone + reorder polish + undo/redo**:
- 3b.6: Cross-zone drag (full-width → sidebar)
- 3b.7: FLIP animations via `<TransitionGroup>`
- 3b.8: Undo/redo stack — Pinia store with command pattern + Cmd+Z/Cmd+Shift+Z
- 3b.9: Tests + visual regression on a known starting layout

**Hard a11y requirements** (per [[feedback-visual-editor-ux-patterns]]):
- `@vue-dnd-kit/core` keyboard sensor (Space pick up, arrows move, Space drop, Esc cancel)
- `aria-live="assertive" aria-atomic="true"` for drag state narration
- **Position-based wording**, NOT index: "Hero moved to position 3 of 5"
- Move Up / Move Down keyboard buttons on every section as the non-drag path (WCAG 2.1.1 Level A)
- Test against NVDA + Firefox specifically (most ARIA-strict)
- NEVER `aria-grabbed` / `aria-dropeffect` (deprecated)
- NEVER `role="application"` to absorb keyboard events

**Hard cursor rule** (per R1 lesson):
- `cursor: grab` only when the drag handler is wired; until then `cursor: default`. The session 160 R1 audit caught `cursor: grab` on inert tiles — the #1 "UI lies" pattern. Match this discipline in 3b for every state.

### Path B — schema-package refactor (1 session)

Closes R2's deferred P1. Validator (`layers/base/server/utils/validateSectionConfigs.ts`) is implemented + 5 tests passing but DORMANT — wiring it caused a Nitro build break in R2 because the registry transitively imports `.vue`. Proper fix:

1. Create `packages/schema/src/sectionConfigs.ts` — export all 17 section Zod schemas (currently inline in `layers/base/sections/builtin/*.ts`)
2. Update each `builtin/*.ts` to import its schema from there (instead of inline `const configSchema = z.object({...})`)
3. Update `validateSectionConfigs.ts` to build a schema-map from `@commonpub/schema` (no registry import → no transitive `.vue` deps)
4. Re-wire the validator into POST + PUT handlers
5. **Confirm Nitro build succeeds locally** (`pnpm --filter @commonpub/reference build`) BEFORE pushing — R2 lesson: vitest passes don't mean Nitro builds pass
6. The 5 dormant tests + the round-2 wiring should work end-to-end

**Win**: closes R2's only deferred P1. Restores per-section URL guards / size caps / sandbox enforcement at the API boundary. Bonus: cleans the foundation for Phase 3b drag-drop (selection model + section-config inspector will need clean schemas).

## Deferred queue (from all 4 audit rounds + R5 doc audit)

**Doc-side (R5)**:
- `packages/learning/README.md` MISSING
- `apps/reference/README.md` MISSING
- `packages/schema/src/openapi.ts` doesn't include layout endpoints
- `packages/ui/README.md` doesn't have a section-registry section
- `packages/config/README.md` feature-flag list may need `layoutEngine`
- `layers/base/README.md` "What's Included" tables are stale

**P1 (security/correctness)**:
- Per-section configSchema enforcement (R2 — Path B above)
- `migrate-homepage` with `force: true` still destroys layout versions (R4 — fix path: use `saveLayout(... { id })` instead of delete+create)

**P2 (UX + perf)**:
- ~~Admin sidebar collapsible on desktop~~ — **DONE in session 161** (see `docs/sessions/161-admin-sidebar-collapse.md`). Layer 264 → 281 tests. Composable `useAdminSidebar` + `--sidebar-width-collapsed` CSS token + topbar chevron toggle + editor-route auto-collapse + session override.
- **Editor canvas squish — palette/inspector collapse OR zoom controls** (user-reported 2026-05-28 follow-up screenshot, AFTER sidebar collapse shipped): on `/admin/layouts/[id]` the canvas is still squished because the editor's OWN 3-column shell (palette ~280px / canvas / inspector ~320px) eats space — even with the admin sidebar collapsed, canvas content cards still clip mid-word ("VIDEO/AYBACK SYSTE"). Two paths:
  - **(A) Independently-collapsible palette + inspector** — icons-only ~48px when collapsed, same `useAdminSidebar`-style pattern but scoped to the editor shell. Each can collapse independently; toolbar gains two chevron buttons. Probably the simpler win.
  - **(B) Viewport control with zoom** — like Figma/Webflow/Framer/Webstudio. Canvas becomes a zoomable preview (fit-width / 100% / fit-all / zoom in/out). Palette + inspector keep their full width; canvas viewport scales independently. More powerful but a bigger lift (transform-origin math + scrollable canvas pane + zoom-to-cursor).
  - Probably want both eventually. Files affected: `AdminLayoutsToolbar.vue` (viewport+zoom controls), `AdminLayoutsPalette.vue`, `AdminLayoutsInspector.vue`, `AdminLayoutsCanvas.vue`.
- LayoutRecord → LayoutPayload type narrow (R2)
- Inspector storm + dirty cost at N=50+ sections (R2)
- `pagehide` + `navigator.sendBeacon` for tab close (R2)
- Conflict cascade throttle (R2)
- `listLayouts` N+1 (R4)
- Partial publish-chain failure UX (R4)
- `AbortController` on save fetch (R4)
- Dashboard Quick Actions tile for `/admin/layouts` (R3)

**P3 (trivia)**:
- 30s setInterval pause on tab hidden (R2)
- `useLayoutEditor` provide/inject (R2)
- Drop `idx_layouts_scope` (redundant with UNIQUE) (R4)
- Operator runbook for `layoutEngine` setup — already in `docs/reference/guides/layout-engine.md` after R5, but a separate `docs/guides/operator-layout-engine.md` for non-technical operators would be cleaner

## Hard rules (re-pinned from CLAUDE.md + audit memories)

- **No AI attribution** in any commit / PR / git artifact (CLAUDE.md #15)
- **`pnpm publish:layer`** for layer publishes — never `npm publish` ([[feedback-pnpm-publish-layer]])
- **Caret semver on 0.x.y excludes minor bumps** — hand-edit consumer package.json ([[feedback-caret-semver-0x-minor-bump]])
- **Pre-push hook runs typecheck**; bypass only with `SKIP_SIMPLE_GIT_HOOKS=1` when intentional
- **NEVER trust `gh run list`** for deploys — always curl `/api/health` after ([[feedback-deploy-health-check-warn-not-fail]])
- **Don't duplicate existing components** ([[feedback-reuse-existing-components]])
- **Test-driven** — tests alongside or before code (CLAUDE.md #11)
- **`var(--*)` only** for any new styles (CLAUDE.md #3)
- **WCAG 2.1 AA** on every interactive element (CLAUDE.md #12)
- **Editor admin-only** — gate `/admin/layouts/*` on `requireFeature('admin')` + `requireFeature('layoutEngine')` (locked by contract test)
- **commonpub.io ONLY** as test bed — heatsync + deveco stay on npm 0.24.0 dormant unless user explicitly directs otherwise
- **Layouts are local-only** (CLAUDE.md Federation Scope table, R5 addition) — don't add to `@commonpub/protocol` without an ADR superseding 027
- **Cursor as contract** — `cursor: grab` only when drag is wired ([[feedback-visual-editor-ux-patterns]])
- **Single-flight save** stays in place — any new save-triggering surface goes through `useLayoutEditor.save()` ([[feedback-editor-security-patterns]])

## End state (session 160 close, final)

- commonpub.io: workspace `main` (`76c1090`). Editor live at `/admin/layouts` + `/[id]`. Public homepage byte-pattern unchanged. heatsync + deveco UNTOUCHED.
- Tests: layer **264**, schema 431, server 1125 + 3 skipped, repo typecheck 26/26 fresh.
- Memories: 4 new feedback memories captured (UX, security, DB/perf + the project-session-160 entry). All indexed in `MEMORY.md`.
- Docs: README + CHANGELOG + CLAUDE.md + ADR 027 + layout-engine guide all updated and current as of session 160 close.

## First action

Confirm you've read the priority docs (one paragraph max). Then ask the user **"Phase 3b drag-drop (the big feature, 2 sessions) or schema-package refactor (1 session, closes R2's deferred per-section validation)?"**. Don't start coding until they pick.

**If 3b**: spawn an Explore agent for current best-practice patterns on Vue 3 grid-layout-plus + @vue-dnd-kit/core integration before coding. The libraries are mature but the integration patterns matter — and the a11y bar is high.

**If schema refactor**: start with the simplest section (`divider.ts`), port its schema to `packages/schema/src/sectionConfigs.ts`, verify the Nitro build succeeds locally (`pnpm --filter @commonpub/reference build`), then batch the other 16. The 5 dormant tests in `validateSectionConfigs.test.ts` validate the wire-up.

Don't accumulate debt. Finish what's started before adding scope. If you find another bug while doing the picked work: log it in the audit queue, fix immediately if P0/P1, otherwise defer.

---

## How this prompt was assembled (R5 audit summary)

This prompt is the output of session 160 round-5 audit: a parallel-agent doc-staleness sweep + cumulative findings from all 4 prior rounds. It is designed to bring a fresh context window up to speed faster than re-reading 5 session docs in order.

If you want to update this prompt for a future session, the relevant files to re-check are: `MEMORY.md`, `docs/sessions/160-*.md`, `docs/plans/phase-3-editor.md`, `docs/plans/layout-engine-rollout.md`, `docs/adr/027-layout-engine-architecture.md`. The deferred queue should mirror what's in those audit docs.
