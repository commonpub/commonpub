# Kickoff prompt — Phase 3c (resize via grid-layout-plus)

Paste everything between the `---` rules as the FIRST message of a fresh Claude Code session. **Prerequisite: Phase 3b/B (session 164) shipped successfully — verify before starting.**

---

Fresh Claude Code session on the CommonPub monorepo. **Task: Phase 3c — resize sections via `grid-layout-plus`.**

**Predecessor**: session 164 shipped Phase 3b/B — cross-row + cross-zone drag, FLIP animations (150ms cubic ease-out, prefers-reduced-motion honored), `useLayoutHistory` undo/redo singleton with command pattern + 50-cap, `useLayoutHotkeys` (Cmd+Z / Cmd+Shift+Z, NOT Cmd+Y), "Move to zone…" keyboard cross-zone path, toolbar undo/redo buttons. **9 commits on `main`**, layer 411 → **464** tests (+53), typecheck 26/26 FULL TURBO. Last commit `139d704`. heatsync + deveco UNTOUCHED on npm 0.24.0. commonpub.io workspace `main` — public byte-pattern unchanged (3 rows + 5 sections, no `--editable` leak).

Before doing anything else, **verify 3b/B actually shipped** (don't trust the handoff per `feedback-verify-loadbearing-values` + session 162/163's audit pattern):

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
  echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
done
# Confirm 3b/B wiring exists
grep -rE "useLayoutHistory|useLayoutHotkeys|moveSectionCommand|cpub-flip-move" layers/base/composables layers/base/components 2>/dev/null | head -10
grep -rE "narrateMovedToZone|politeMessage|onMoveToZone|cpub-layout-section-move-menu" layers/base 2>/dev/null | head -5
# Confirm dispatcher's cross-row branch landed (no more 'cross-row-deferred-to-3b-B' noop)
grep -rE "cross-row-deferred|no-find-row|source-row-not-found" layers/base/composables/useLayoutDrag.ts
# Confirm layer tests pass
pnpm --filter @commonpub/layer test 2>&1 | grep "Tests" | tail -1
# Editor still loads + public byte-pattern unchanged
curl -s -o /dev/null -w '/admin/layouts = %{http_code} (302 expected)\n' https://commonpub.io/admin/layouts
curl -sS https://commonpub.io/ | grep -oE 'class="[^"]*cpub-layout-(row|section)[^"]*"' | grep -oE 'cpub-layout-(row|section)(--editable)?' | sort | uniq -c
```

**Expected**: all 3 sites health=200; useLayoutHistory + useLayoutHotkeys + moveSectionCommand + cpub-flip-move all present; narrateMovedToZone + politeMessage + onMoveToZone + move-menu CSS present; dispatcher has `no-find-row` + `source-row-not-found` (NO `cross-row-deferred-to-3b-B`); **layer 464 tests passing**; `/admin/layouts=302`; 3 layout-row + 5 layout-section + NO `--editable`. Any divergence: STOP + investigate.

## Mandatory reads (in order)

1. **`CLAUDE.md`** — rules #2 (flag), #3 (`var(--*)`), #11 (test-driven), #12 (WCAG 2.1 AA), #15 (**NEVER add Claude as co-author**)

2. **MEMORY.md priority memories**:
   - `feedback-no-coauthor` — re-pinned (most-violated default)
   - `feedback-phase-3-hybrid-libraries` — `grid-layout-plus@1.1.1` already in `layers/base/package.json` for this exact phase
   - `feedback-visual-editor-ux-patterns` — §resize semantics; constraint snap visual + position-based narration
   - `feedback-match-established-pattern` — col-span pill UX should match Webflow/Framer/Figma resize conventions
   - `feedback-vue-tsc-strict-vs-vitest` — grid math + Vue refs will surface this
   - `feedback-vi-restoreallmocks-wipes-vifn-impls` — `vi.clearAllMocks()` not `restoreAllMocks` when vi.fn impls need preserving
   - `feedback-vitest-import-meta-client-undefined` — composable browser guards need `typeof window`

3. **Session 163 + 164 logs**: `docs/sessions/163-3b-A.md` + `164-3b-B.md` — established patterns + the recursion-curve data + the kickoff design picks the user has standing on.

4. **Plan docs** (THE source of truth):
   - `docs/plans/phase-3-editor.md` §Phase 3c — sub-tasks 3c.1 through 3c.6
   - `docs/plans/layout-and-pages.md` §7.5 — resize semantics (snap-to-12, neighbour absorption, 12-col guideline overlay, snap pills, constraint snap)
   - `docs/adr/027-layout-engine-architecture.md` — architecture ratified

5. **Existing surfaces you'll touch**:
   - `layers/base/composables/useLayoutDrag.ts` — section-instance drag is established; resize is a DIFFERENT gesture (Right-edge handle drag). Decide: extend useLayoutDrag with a `resize` branch, OR a new `useLayoutResize.ts` composable?
   - `layers/base/composables/useLayoutHistory.ts` — add a `resizeSectionCommand` factory (apply: set colSpan + neighbour's colSpan to absorbed delta; invert: restore both)
   - `layers/base/components/LayoutSection.vue` — add a right-edge resize handle (28×28 minimum, plan §7.5). Cursor `col-resize`. Only visible on `--editable`.
   - `packages/ui/sections/registry.ts` — `minColSpan` / `maxColSpan` / `resizable` already in `SectionDefinition` (used per-section); enforce both.

## Scope (6 sub-tasks)

Per `docs/plans/phase-3-editor.md` §Phase 3c:

- [ ] **3c.1** Wire `grid-layout-plus` resize handles — OR if its pointer-event collision with `@vue-dnd-kit/core` is unsolved (session 163's Explore-agent boundary analysis flagged this), implement resize from scratch with pointer events + the existing CSS grid. Pick before coding. Run an Explore-agent against `grid-layout-plus@1.1.1` vs `@vue-dnd-kit/core@2.4.6` if the collision question isn't already settled.
- [ ] **3c.2** Snap-to-12 (cols=12; row-resize disabled — sections are auto-height). `deltaCols = round((pointerDX / containerWidth) * 12)`. 12 vertical guide lines fade in during resize (`opacity: 0.25`); current snap line bolds (`opacity: 0.7`).
- [ ] **3c.3** Neighbour absorption — when section grows past row's 12-col capacity, the right neighbour shrinks by the same delta; clamps at its own `minColSpan`. When section is LAST in row, growing extends to row's right edge.
- [ ] **3c.4** Visual feedback during resize: pill near cursor showing `8/12` updates realtime; neighbour's pill `4/12` dimmed; constraint snap label "🔒 min 3/12" when limits hit.
- [ ] **3c.5** Per-section `minColSpan` / `maxColSpan` enforced from `SectionDefinition`.
- [ ] **3c.6** Tests + visual regression. Resize on mobile/tablet disabled per plan §7.5 (handles invisible, inspector slider instead). Reduced-motion: snap-bounce animations off.

## Wire to history

Each resize commits ONE `resizeSectionCommand` to history on pointer-release. Cmd+Z reverts BOTH the resized section AND the absorbed neighbour. apply/invert symmetry per the existing factory pattern.

```ts
// Sketch — add to useLayoutHistory.ts
export function resizeSectionCommand(params: {
  rowId: string;
  sectionId: string;
  fromColSpan: number;
  toColSpan: number;
  neighbourId: string | null;       // null when section is LAST in row
  neighbourFromColSpan?: number;
  neighbourToColSpan?: number;
  label?: string;
}): LayoutCommand
```

## a11y discipline

- **Keyboard resize**: Shift+← / Shift+→ on focused section changes colSpan by 1 (plan §7.8 keyboard model). Bounds-check + narrate via assertive channel ("Hero now spans 8 of 12 columns" / "Constraint reached: minimum 3 columns").
- **No color-only indicators**: snap-limit hit shows BOTH outline color change AND lock icon AND text ("🔒 min 3/12") so colorblind users have three independent signals.
- **prefers-reduced-motion**: snap-bounce + guide-line fade-ins disabled.

## Hard rules (load-bearing across every session)

- **No AI attribution** in any commit / PR / git artifact (CLAUDE.md #15)
- **0 npm publishes** — workspace-only on commonpub.io
- **heatsync + deveco UNTOUCHED** on dormant 0.24.0
- **`var(--*)` only** for any new styles
- **Pre-push hook runs typecheck** — vue-tsc strict catches what vitest's esbuild lets pass. Resize math + closures are typical strict-catch sites.
- **NEVER trust `gh run list`** — always curl `/api/health` after deploy
- **Single-flight save stays** — resize mutations route through `editor.draft.value`; auto-save picks up the dirty change.
- **No commands that bypass the dirty tracker** — every resize must mutate draft so the version counter + auto-save fire.
- **Verify load-bearing claims against source** — when documenting a `grid-layout-plus` API, an `interactjs` collision, or a Vue 3 pointer-event handling detail, re-check the actual implementation/spec, not memory. Session 163 + 164 each found things this way.

## Self-audit after coding

Apply R1-R4 lens per session 160/163/164's pattern. Expected yield 2-5 findings per round.

- **R1 (UX)**: cursor-as-contract during resize (`col-resize` continuously); snap pill placement when row is narrow; constraint-snap visual; reduced-motion path; the resize handle as a visual anchor.
- **R2 (correctness)**: resize during in-flight save; resize crossing a min/max neighbour; resize a section AT its max (no-op); undo of a resize when neighbour was simultaneously deleted; pointer-up outside the window.
- **R3 (operational)**: keyboard resize Shift+Arrow at boundary; resize on mobile (should be invisible); inspector colSpan input + handle resize same state.
- **R4 (perf/edges)**: 60+ pointermove events per second — throttle via `requestAnimationFrame`; resize while FLIP animation is mid-flight; column-12 layouts with N>10 sections.

## First action

1. Confirm priority docs read (one paragraph max).
2. Run the verification grep + endpoint check above. If 3b/B wasn't shipped: STOP, ask the user, restart with `163-kickoff-3b-B.md`.
3. **Ask the user**: grid-layout-plus integration vs. roll-your-own resize? Explore-agent against the dnd-kit collision boundary FIRST if not yet decided.
4. Atomic commits per session 163/164 discipline (one logical change per commit, co-located tests, `pnpm typecheck` + targeted tests before push).
5. After all 6 ship, run R1-R4 audit + at least one audit-of-audit round.
6. Update `docs/sessions/165-3c.md` with what shipped + what audit caught.
7. Write the next-session handoff (`165-kickoff-3d.md`) for Phase 3d — keyboard a11y completion + axe scan.

Don't accumulate debt. Finish what's started before adding scope.

---
