# Session 162 — fresh-context kickoff prompt for next session

Paste everything between the `---` rules as the first message of session 163. Designed for cold-start; assumes no prior context.

---

Fresh Claude Code session on the CommonPub monorepo.

**Predecessor**: session 162 shipped 9 commits on `main` closing the layout-editor P2 deferred queue from session 160's R2/R3/R4 audits, plus a self-audit polish round on the P2 work itself. All session 160 audit P1+P2s are now closed. Editor lives at https://commonpub.io/admin/layouts. **Layer 318 tests + schema 470 + server 1129+3skip + repo typecheck 26/26.** heatsync + deveco UNTOUCHED on npm 0.24.0. Final commit `16ccfd2` on `main`.

## Session 162 in two paragraphs

User said "pick whatever thing to do first makes sense". I picked Path B (P2 sweep) over Path A (Phase 3b drag-drop) because the predecessor handoff said "Don't accumulate debt; finish what's started before adding scope" — a 2-session drag-drop arc on top of 8 deferred P2s inverts that. Seven P2 commits landed in priority order (smallest-visibility-win first → perf → correctness): Dashboard tile, listLayouts N+1 → 3 queries flat, pagehide-flushBeacon (fetch keepalive:true), LayoutPayload = Pick<LayoutRecord,…>, conflict-cascade throttle (3-in-60s), O(1) version-counter dirty (replaces O(N) per-keystroke walk), and step-typed PublishStepError.

After "ultrathink audit and continue", a self-audit round caught 5 real bugs in the just-shipped work: conflict-thrash banner missing inline CTAs, wrong CSS var token (--warning didn't exist), dashboard tile label mismatch with sidebar, modal + banner showing simultaneously during thrashing, and Refresh/Force Save not clearing the thrash window. All five closed in `16ccfd2` "self-audit polish". No new memories added — every change was already covered by existing feedback memories.

## Mandatory reads (in order)

1. **`CLAUDE.md`** — critical rules #2 (flags), #3 (`var(--*)` only), #11 (test-driven), #12 (WCAG 2.1 AA), #14 (research first), #15 (**NEVER add Claude as co-author**)

2. **`MEMORY.md`** index, then these priority memories:
   - `feedback-no-coauthor` — most-violated default, re-pinned
   - `feedback-visual-editor-ux-patterns` — cursor-as-contract, save-trust signals, 3-option conflict modal, drag-drop a11y, 10 anti-patterns
   - `feedback-editor-security-patterns` — draft-leak guard, per-section schema enforcement at API boundary, URL scheme refinement, single-flight save, array `.max()` bounds, structured audit logs
   - `feedback-editor-db-perf-patterns` — Drizzle indexes only used if WHERE clause references them, force-replace destroys cascade history, bounded LRU caches, beforeunload + onBeforeRouteLeave together, homepage-scope is special
   - `feedback-reuse-existing-components` — Layout engine is an ARRANGER; never write parallel renderers (16 duplicate Section*.vue files were the cautionary tale in session 158-159)
   - `feedback-phase-3-hybrid-libraries` — `grid-layout-plus@1.1.1` + `@vue-dnd-kit/core@2.4.6` installed; integration patterns matter; FormKit deferred to 3e
   - `feedback-vitest-import-meta-client-undefined` — use `typeof window` not `import.meta.client` for browser guards in composables
   - `feedback-vi-restoreallmocks-wipes-vifn-impls` — use `vi.clearAllMocks()` not `restoreAllMocks` when vi.fn impls need preserving
   - `feedback-deploy-health-check-warn-not-fail` — NEVER trust `gh run list` status; ALWAYS curl `/api/health` after a deploy
   - `feedback-pnpm-publish-layer` — `pnpm publish:layer` not `npm publish`
   - `feedback-caret-semver-0x-minor-bump` — `^0.21.22` excludes 0.22.x; hand-edit consumer package.json for minor bumps
   - `project-session-162` — accurate session summary (if I remembered to write the project memory entry — verify in MEMORY.md before reading)

3. **`docs/sessions/162-p2-sweep.md`** ← single-page summary of session 162. Read this first.

4. **`docs/sessions/161-handoff-prompt.md`** — many of its rules still apply; the deferred queue is now strikethrough up through P2 but the architectural arcs + Phase 3b sketches remain accurate.

5. **Plan docs**:
   - `docs/plans/phase-3-editor.md` — Phase 3a ✅ + 3b-3f remain. Hybrid library choices documented.
   - `docs/plans/layout-engine-rollout.md` — Stages D ✅; Stage E (3b drag-drop) is next.
   - `docs/plans/layout-and-pages.md` §7 — Editor UX spec. Specifically §7.3 (eight gestures), §7.4 (drop targets), §7.5 (resize), §7.6 (state machine), §7.8 (a11y), §7.14 (undo/redo).
   - `docs/adr/027-layout-engine-architecture.md` — architecture ratified.

## Verify current state (read-only)

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
  echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
done
curl -sS https://commonpub.io/ | grep -oE 'class="[^"]*cpub-layout-(row|section)[^"]*"' | grep -oE 'cpub-layout-(row|section)(--editable)?' | sort | uniq -c
curl -s -o /dev/null -w '/admin/layouts = %{http_code} (302 expected)\n' https://commonpub.io/admin/layouts
curl -sS 'https://commonpub.io/api/layouts/by-route?path=/' | grep -oE '"state":"[^"]+"' | head -1
grep -E 'grid-layout-plus|@vue-dnd-kit' layers/base/package.json
pnpm --filter @commonpub/layer test 2>&1 | grep "Tests" | tail -1
pnpm --filter @commonpub/schema test 2>&1 | grep "Tests" | tail -1
pnpm --filter @commonpub/server test 2>&1 | grep "Tests" | tail -1
pnpm typecheck 2>&1 | tail -3
```

**Expected**: all 3 sites health=200; 3 cpub-layout-row + 5 cpub-layout-section (no `--editable` leak); `/admin/layouts=302`; `state="published"`; both drag libs present; **layer 318**, **schema 470**, **server 1129+3skip**; typecheck 26/26. If anything diverges: STOP and investigate.

## Pick your path (ask the user up front)

**"Phase 3b drag-drop (the big arc, 2 sessions), Figma viewport zoom (1 session, complements 161 collapse fix), or stale-docs sweep (0.5 session)?"**

### Path A — Phase 3b drag-drop (2 sessions)

Now the right time: editor canvas no longer squishes (session 161 chrome collapse), debt queue is clear (session 162), libraries pre-installed.

**Session A/1 — palette → canvas drag + within-row reorder**:
- 3b.1: Wire `grid-layout-plus@1.1.1` into LayoutSlot editable mode — sections become draggable+resizable grid items
- 3b.2: Section palette uses `@vue-dnd-kit/core@2.4.6` `useDraggable`; `useDroppable` on each row/zone accepts the drop + creates a section via auto-save
- 3b.3: Drop indicator (between-row line, between-section gap) via dnd-kit collision detection
- 3b.4: Save-on-drop via the existing auto-save scaffolding
- 3b.5: Tests
- Selection model lands as a free side-effect (click handlers) → Inspector dispatcher (3a.3) finally activates

**Session A/2 — cross-zone + reorder polish + undo/redo**:
- 3b.6 cross-zone drag, 3b.7 FLIP animations, 3b.8 Pinia undo/redo with Cmd+Z/Cmd+Shift+Z, 3b.9 tests

**Hard a11y bar** (per `feedback-visual-editor-ux-patterns`): keyboard sensor (Space pick up, arrows move, Space drop, Esc cancel); `aria-live=assertive` position narration ("Hero moved to position 3 of 5", NOT index); Move Up / Move Down keyboard buttons on every section (WCAG 2.1.1 Level A); NEVER `aria-grabbed` / `aria-dropeffect` (deprecated); NEVER `role=application`.

**Hard cursor rule**: `cursor: grab` only when the handler is wired; until then `cursor: default`. The session 160 R1 audit caught `cursor: grab` on inert tiles — the #1 "UI lies" pattern.

**Before coding**: spawn an Explore agent for current best-practice Vue 3 `grid-layout-plus` + `@vue-dnd-kit/core` integration patterns. The libraries are mature but the boundary between them (dnd-kit owns OUTER drag — palette → canvas, cross-zone; grid-layout-plus owns INNER drag — within-row reorder + resize) needs verification.

### Path B — Figma viewport zoom controls (1 session)

Complementary to session 161's palette/inspector collapse fix. Users who want full chrome AND a zoomed preview (vs. one-or-the-other) need this. Bigger lift than the collapse: transform-origin math + scrollable canvas pane + zoom-to-cursor + persist via cookie like collapse state.

Useful Phase 3b feature too — being able to zoom OUT to see a long layout while dragging is a real workflow.

### Path C — Stale docs sweep (0.5 session)

`packages/learning/README.md` MISSING, `apps/reference/README.md` MISSING, `packages/schema/src/openapi.ts` doesn't include layout endpoints, `packages/ui/README.md` no section-registry section, `packages/config/README.md` flag list stale, `layers/base/README.md` "What's Included" tables stale.

## Deferred queue (after session 162)

**P3 (trivia)**:
- 30s setInterval pause on tab hidden (R2 P3)
- `useLayoutEditor` provide/inject (R2 P3)
- Drop `idx_layouts_scope` (redundant with UNIQUE) (R4 P3)
- Separate operator runbook for `layoutEngine` setup
- (P2 → P3 reclassified) Figma viewport zoom controls — complementary to 161 collapse

**Big architectural arcs**:
- Phase 3b drag-drop (2 sessions) — described above
- Phase 3c resize (1 session)
- Phase 3d keyboard + a11y (1 session)
- Phase 3e auto-form from Zod (1 session)
- Phase 3f section inspectors per type (1 session)

## Hard rules (re-pinned)

- **No AI attribution** in any commit / PR / git artifact (CLAUDE.md #15)
- **`pnpm publish:layer`** for layer publishes — never `npm publish`
- **Caret semver on 0.x.y excludes minor bumps** — hand-edit consumer package.json
- **Pre-push hook runs typecheck**; bypass only with `SKIP_SIMPLE_GIT_HOOKS=1` if intentional
- **NEVER trust `gh run list`** for deploys — always curl `/api/health` after
- **Don't duplicate existing components** — layout engine is an ARRANGER
- **Test-driven** — tests alongside or before code
- **`var(--*)` only** for any new styles — no hardcoded colors/fonts
- **WCAG 2.1 AA** on every interactive element (28×28 touch target minimum; 24×24 is the bare WCAG floor, not the design target)
- **Editor admin-only** — `/admin/layouts/*` gated on `requireFeature('admin')` + `requireFeature('layoutEngine')`
- **commonpub.io ONLY** as test bed — heatsync + deveco stay on npm 0.24.0 dormant unless user explicitly directs otherwise
- **Layouts are local-only** — don't add to `@commonpub/protocol` without an ADR superseding 027
- **Cursor as contract** — `cursor: grab` only when drag is wired
- **Single-flight save** — any save-triggering surface routes through `useLayoutEditor.save()`
- **useCookie over useState + localStorage** for persistent UI state — matches `useTheme` / `useAdminSidebar` / `useEditorChrome` pattern; no SSR/CSR flash
- **Server-side Zod schemas come from `@commonpub/schema`** — if you need a Zod schema in a server handler, it MUST come from `@commonpub/schema` (never from `layers/base/sections/builtin/*` or any file that transitively imports `.vue`)

## First action

Confirm you've read the priority docs (one paragraph max). Then ask the user **"Phase 3b drag-drop (2 sessions), Figma viewport zoom (1 session), or stale-docs sweep (0.5 session)?"**. Don't start coding until they pick.

**If 3b**: spawn an Explore agent for current best-practice Vue 3 grid-layout-plus + @vue-dnd-kit/core integration patterns before coding. The integration boundary (dnd-kit OUTER, grid-layout-plus INNER) needs verification.

**If zoom**: research transform-origin + scrollable-canvas + zoom-to-cursor patterns from Figma/Webflow/Framer; then sketch the API for the `useEditorViewport` composable that owns the zoom state (matching the `useEditorChrome` precedent).

**If docs sweep**: missing READMEs first (`packages/learning`, `apps/reference`), then openapi.ts layout endpoints, then the "What's Included" tables in `layers/base/README.md`.

Don't accumulate debt. Finish what's started before adding scope.
