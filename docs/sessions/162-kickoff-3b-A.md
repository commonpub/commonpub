# Kickoff prompt — Phase 3b/A (palette drag + within-row reorder)

Paste everything between the `---` rules as the FIRST message of a fresh Claude Code session. Designed for cold-start with no prior context. This is **session 1 of the 2-session Phase 3b drag-drop arc**.

---

Fresh Claude Code session on the CommonPub monorepo. **Task: Phase 3b/A — wire drag-drop into the layout editor.**

**Predecessor**: session 162 closed every P2 from session 160's audit rounds + ran TWO recursive audits + completed Path C (stale-docs sweep) with 3 audit-of-docs rounds. **19 commits on `main`**. Layout-editor deferred queue is empty of P1/P2s — debt-zero baseline for this drag-drop work. Editor live at https://commonpub.io/admin/layouts. **Layer 318 + schema 470 + server 1129+3skip + repo typecheck 26/26 FULL TURBO.** heatsync + deveco UNTOUCHED on npm 0.24.0. Last commit `7b8f7c2`.

## Why now

The editor canvas no longer squishes (session 161 chrome collapse), debt is zero (session 162), and both libraries are already installed: `grid-layout-plus@1.1.1` + `@vue-dnd-kit/core@2.4.6`. Editor at /admin/layouts can list + create + delete layouts and edit page-meta — but the palette tiles are inert and `cursor: default` (session 160 R1 audit caught + fixed the `cursor: grab` "UI lies" pattern). This session lights up drag.

## Mandatory reads (in order)

1. **`CLAUDE.md`** — rules #2 (flag), #3 (`var(--*)`), #11 (test-driven), #12 (WCAG 2.1 AA), #15 (**NEVER add Claude as co-author**)

2. **`MEMORY.md`** index, then these priority memories:
   - `feedback-no-coauthor` — re-pinned (most-violated default)
   - `feedback-phase-3-hybrid-libraries` — library choices + integration boundary
   - `feedback-visual-editor-ux-patterns` — cursor-as-contract, save-trust signals, drag-drop a11y, 10 anti-patterns
   - `feedback-editor-security-patterns` — single-flight save, URL schemes, array bounds
   - `feedback-editor-db-perf-patterns` — bounded LRU, beforeunload + onBeforeRouteLeave together
   - `feedback-match-established-pattern` — when reusing existing handlers, MATCH the established labels/hierarchy/styling
   - `feedback-reuse-existing-components` — layout engine is an ARRANGER; never write parallel renderers
   - `feedback-verify-loadbearing-values` — verify load-bearing claims against the source, not against memory
   - `feedback-vitest-import-meta-client-undefined` — use `typeof window` for browser guards in composables
   - `feedback-vi-restoreallmocks-wipes-vifn-impls` — `vi.clearAllMocks()` not `restoreAllMocks` when vi.fn impls need preserving
   - `feedback-deploy-health-check-warn-not-fail` — NEVER trust `gh run list`; always curl `/api/health`
   - `feedback-vue-tsc-strict-vs-vitest` — pre-push hook catches; CI's `pnpm typecheck` uses vue-tsc strict
   - `project-session-162` — the session that left this debt-zero baseline

3. **Session 162 log**: `docs/sessions/162-p2-sweep.md` — recent context (P2 sweep + audits + docs sweep)

4. **Plan docs (THE source of truth for this session)**:
   - `docs/plans/phase-3-editor.md` §Phase 3b — the 5 sub-tasks for this session
   - `docs/plans/layout-and-pages.md` §7 — Editor UX spec. Specifically:
     - §7.3 eight gestures (drag, drop, resize, etc.)
     - §7.4 drop targets (between-row gap, between-section gap, zone)
     - §7.6 state machine (idle → dragging → dropping → committed/cancelled)
     - §7.8 accessibility (keyboard sensor, ARIA live regions)
   - `docs/adr/027-layout-engine-architecture.md` — architecture ratified

5. **Existing surfaces you'll touch**:
   - `layers/base/components/admin/layouts/AdminLayoutsCanvas.vue` — the canvas wrapping LayoutSlot
   - `layers/base/components/admin/layouts/AdminLayoutsPalette.vue` — the draggable source
   - `layers/base/components/LayoutSlot.vue` — the section renderer (`:editable` prop already exists)
   - `layers/base/composables/useLayoutEditor.ts` — owns draft + save; new drag operations call into `draft.value.zones[].rows[].sections`
   - `layers/base/sections/registry.ts` — section types + propMap

## Verify current state (read-only)

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
  echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
done
curl -sS https://commonpub.io/ | grep -oE 'class="[^"]*cpub-layout-(row|section)[^"]*"' | grep -oE 'cpub-layout-(row|section)(--editable)?' | sort | uniq -c
curl -s -o /dev/null -w '/admin/layouts = %{http_code} (302 expected)\n' https://commonpub.io/admin/layouts
grep -E 'grid-layout-plus|@vue-dnd-kit' layers/base/package.json
pnpm --filter @commonpub/layer test 2>&1 | grep "Tests" | tail -1
pnpm typecheck 2>&1 | tail -3
```

**Expected**: all 3 sites health=200; 3 cpub-layout-row + 5 cpub-layout-section (no `--editable` leak); `/admin/layouts=302`; both libs present; **layer 318**; typecheck 26/26. Any divergence: STOP + investigate.

## Before coding — REQUIRED research step

Spawn an Explore agent for current best-practice Vue 3 `grid-layout-plus` + `@vue-dnd-kit/core` integration patterns. The libraries are mature individually but their interaction needs verification.

**API reference (verified at session 162 close)** — `@vue-dnd-kit/core@2.4.6` exports:
- `DnDProvider` (component — wraps the canvas/palette boundary)
- `DragPreview` (component — visual during drag)
- `makeDraggable` (composable — attaches draggable behavior; NOT `useDraggable`)
- `makeDroppable` (composable — attaches drop-target behavior; NOT `useDroppable`)
- `makeSelectionArea`, `makeConstraintArea`, `makeAutoScroll`
- `useDnDProvider` (composable — accesses provider context from children)

Confirm against `node_modules/.pnpm/@vue-dnd-kit+core@2.4.6_*/node_modules/@vue-dnd-kit/core/dist/external/index.d.ts` before writing imports.

```
Prompt the Explore agent for:
1. Vue 3 grid-layout-plus integration pattern: how to bind `:layout`/`@layout-updated` to a reactive ref of items (where items = layout sections); how to enable drag without resize for 3b (resize is Phase 3c).
2. @vue-dnd-kit/core pattern: makeDraggable on the palette tiles + makeDroppable on each row/zone; DnDProvider boundary; collision detection between palette source + canvas targets.
3. CRITICAL — the boundary: dnd-kit owns the OUTER drag (palette → canvas, cross-zone drag); grid-layout-plus owns the INNER drag (within-row reorder + resize). What's the integration: do they conflict on pointer events? Is one nested in the other?
4. a11y posture in @vue-dnd-kit/core: keyboard sensor, screen reader narration. Does it ship aria-live announcements OOTB or do we wire them?
5. Any known issues with grid-layout-plus + Vue 3.5 reactivity, especially with `setup()` ref bindings.
```

The agent should return canonical patterns + code samples. Don't start coding until you've reviewed its output.

## Scope of this session (5 sub-tasks)

Per `docs/plans/phase-3-editor.md` §Phase 3b/A:

- [ ] **3b.1** Wire `grid-layout-plus` into LayoutSlot's editable mode — each section becomes a draggable grid item. **Resize disabled** for this session (Phase 3c).
- [ ] **3b.2** Section palette uses `@vue-dnd-kit/core` `makeDraggable`; `makeDroppable` on each row (or zone) accepts the drop, creates a section in the layout via `editor.draft.value.zones[].rows[].sections.push(...)`. The auto-save composable picks up the dirty change + saves within 1.5s.
- [ ] **3b.3** Drop indicator using dnd-kit collision detection — between-row line + between-section gap (per `layout-and-pages.md` §7.4).
- [ ] **3b.4** Save-on-drop via the EXISTING auto-save scaffolding (3a.6). The `useLayoutEditor.save()` single-flight guard handles concurrent drops. **DON'T add a parallel save path.**
- [ ] **3b.5** Tests — at minimum: palette makeDraggable wired; makeDroppable accepts drop + invokes registry helper; drag start → drop → draft mutated; cursor states; keyboard sensor reachable.

**Selection model lands as a side-effect** — click handlers on sections set `editor.selectedId` (new state on the composable). The Inspector dispatcher (which currently only renders the page-meta form) gets unblocked: when `selectedId` points at a section, render a section-config form (placeholder for 3f); when it points at a row, render a row-config form (placeholder for 3f); when nothing selected, render the page-meta form.

## Hard a11y bar (NON-NEGOTIABLE)

Per [[feedback-visual-editor-ux-patterns]]:

1. **Keyboard sensor**: Space pick up → Arrow keys move → Space drop → Esc cancel. `@vue-dnd-kit/core` ships a keyboard sensor — verify in research step.
2. **`aria-live="assertive"` + `aria-atomic="true"`** in a SR-only region that narrates drag state. Position-based wording: "Hero moved to position 3 of 5", **NOT index-based** ("Hero moved to index 2").
3. **Move Up / Move Down keyboard buttons** on every section as the non-drag accessibility path (WCAG 2.1.1 Level A). Reuse the existing single-flight save.
4. **NEVER** `aria-grabbed` / `aria-dropeffect` (deprecated by ARIA 1.1).
5. **NEVER** `role="application"` to absorb keyboard events.
6. Test against NVDA + Firefox (most ARIA-strict) before declaring done.
7. **Cursor as contract**: `cursor: grab` only when the drag handler is wired AND draggable; `cursor: grabbing` only during active drag. Until wired: `cursor: default`. (Session 160 R1 caught `cursor: grab` on inert tiles — the #1 "UI lies" anti-pattern.)

## Hard rules

- **No AI attribution** in any commit / PR / git artifact (CLAUDE.md #15)
- **commonpub.io ONLY** as test bed — heatsync + deveco stay on npm 0.24.0 dormant unless explicitly directed
- **0 npm publishes** — workspace-only session
- **Layouts are local-only** — don't add to `@commonpub/protocol` without an ADR superseding 027
- **Don't write parallel renderers** — drag UI calls into existing components per `feedback-reuse-existing-components`
- **Match established patterns** — when extending the conflict-resolution UX or the toolbar, MATCH the labels/hierarchy/styling already audited in (session 160 R1 + session 162 audit-of-audit) per `feedback-match-established-pattern`
- **Verify load-bearing claims** against source, not memory (session 162 docs audit caught 8 wrong env-var names + 1 wrong composable home + count mismatches — same root cause as drag-drop's "I think dnd-kit does this" risk)
- **NEVER trust `gh run list`** — always curl `/api/health` after deploy
- **Pre-push hook runs typecheck** — `pnpm typecheck` must pass (vue-tsc strict catches what vitest doesn't)
- **Single-flight save stays** — any new save-triggering surface routes through `useLayoutEditor.save()`
- **No hardcoded colors/fonts** — `var(--*)` only

## First action

1. Confirm you've read the priority docs (one paragraph max).
2. **Spawn the Explore agent** with the prompt above.
3. After the agent returns, summarise the key integration patterns + ask the user to confirm before coding.
4. Then ship the 5 sub-tasks as atomic commits per session 162's discipline (one logical change per commit, co-located tests, `pnpm typecheck` + targeted tests before push).
5. **After all 5 ship**, run an R1-R4 self-audit per session 160's pattern. The audit found 5 bugs in session 162's P2 sweep + 3 more in the polish; expect similar yield here. Drag-drop has high a11y + visual surface, so R1 (UX + a11y) is likely the densest finding lens.
6. Update `docs/sessions/163-3b-A.md` (or whatever session number you land in) with what shipped + what audit caught.

Don't accumulate debt. Finish what's started before adding scope. Phase 3b/B (cross-zone + undo/redo) is a SEPARATE session — don't try to do both in one.

---
