# Kickoff prompt — Phase 3b/B (cross-zone + FLIP + undo/redo)

Paste everything between the `---` rules as the FIRST message of a fresh Claude Code session. **Prerequisite: Phase 3b/A (palette drag + within-row reorder) MUST have shipped first** — verify the editor canvas has drag wired before starting this session.

---

Fresh Claude Code session on the CommonPub monorepo. **Task: Phase 3b/B — cross-zone drag + FLIP animations + Pinia undo/redo.**

**Predecessor**: session N-1 shipped Phase 3b/A — palette → canvas drop, within-row reorder, drop indicators, save-on-drop, keyboard sensor, Move Up/Down a11y buttons, selection model. Section drag works WITHIN a row + WITHIN a zone. Cross-zone drag does NOT work yet.

Before doing anything else, **verify 3b/A actually shipped** (don't trust the handoff; per `feedback-verify-loadbearing-values` + session 162's audit pattern):

```bash
# Confirm drag fixtures exist + are wired (not stubs)
grep -rE "makeDraggable|makeDroppable|DnDProvider" layers/base/components/admin/layouts --include="*.vue" | head -5
# Confirm a11y Move Up/Down buttons present in palette OR canvas
grep -rE "Move up|Move down|move-up|move-down" layers/base/components/admin/layouts --include="*.vue" | head -5
# Confirm tests
pnpm --filter @commonpub/layer test 2>&1 | grep "Tests" | tail -1
# Editor still loads
curl -s -o /dev/null -w '/admin/layouts = %{http_code} (302 expected)\n' https://commonpub.io/admin/layouts
```

If 3b/A wasn't shipped: STOP, ask the user, restart with `162-kickoff-3b-A.md` instead.

## Mandatory reads

1. **`CLAUDE.md`** — rules #2 (flag), #3 (`var(--*)`), #11 (test-driven), #12 (WCAG 2.1 AA), #15 (NO AI co-author)

2. **MEMORY.md priority memories** (same set as 3b/A — they're still load-bearing here):
   - `feedback-visual-editor-ux-patterns` — drag-drop a11y patterns. **Reread §position-based wording** before writing announcement strings.
   - `feedback-phase-3-hybrid-libraries` — library boundary (dnd-kit OUTER, grid-layout-plus INNER)
   - `feedback-match-established-pattern` — undo/redo UX should match Notion / Linear conventions; don't invent
   - `feedback-editor-security-patterns` — single-flight save guard (undo must NOT race with auto-save)
   - `feedback-vue-tsc-strict-vs-vitest` — Pinia store will likely surface this; vue-tsc strict catches.

3. **Session N-1 log** + audit doc — read what Phase 3b/A shipped + what its self-audit caught. Patterns from there bias what this session likely re-introduces.

4. **Plan docs**:
   - `docs/plans/phase-3-editor.md` §Phase 3b — 3b.6 through 3b.9 (this session's 4 sub-tasks)
   - `docs/plans/layout-and-pages.md` §7.14 — undo/redo spec
   - `docs/plans/layout-and-pages.md` §7.6 — state machine, including new states for cross-zone + undo

## Scope (4 sub-tasks)

- [ ] **3b.6 Cross-zone drag** — drag a section from a row in `zone=main` → drop into a row in `zone=sidebar`. The layout JSON updates correctly (section moves between `zones[i].rows[j].sections` arrays + position renumbered). Auto-save fires. dnd-kit's drop-target detection on each zone container's row gaps.
- [ ] **3b.7 FLIP animations** — `<TransitionGroup>` on the canvas section list. Animations respect `prefers-reduced-motion: reduce` (per CLAUDE.md #12 + WCAG 2.3.3).
- [ ] **3b.8 Undo/redo stack** — Pinia store with command pattern:
  - `useLayoutHistory` store with `past: Command[]`, `future: Command[]`
  - `Command` interface: `{ apply: (draft) => void, invert: (draft) => void, label: string }`
  - Drag operations call `history.record(cmd)` after mutating draft
  - `history.undo()` pops `past`, applies `invert`, pushes to `future`
  - `history.redo()` pops `future`, applies `apply`, pushes to `past`
  - Hotkeys: Cmd+Z (Mac) / Ctrl+Z (Win+Linux) → undo; Cmd+Shift+Z / Ctrl+Shift+Z → redo (NOT Cmd+Y; matches Notion + Linear + Figma)
  - Reset on `refresh()` (server state changed → history meaningless)
  - Track size cap (e.g. 50 commands; older drop) to prevent runaway memory
  - Skip when an input/textarea has focus (browser-native undo handles those)
- [ ] **3b.9 Tests + visual regression**:
  - Command stack: record / undo / redo / cap behavior / refresh clears
  - Cross-zone integration: drag from main → sidebar → JSON shape correct
  - FLIP `prefers-reduced-motion` honored
  - Visual diff regression: starting layout → 3 drags → expected layout JSON match (snapshot OR explicit shape assertion)

## a11y for cross-zone

- Cross-zone drag must work via keyboard too. Per `@vue-dnd-kit/core` patterns from 3b/A's research — verify the keyboard sensor handles cross-container drops without extra wiring.
- Live region narration: "Hero moved from main, position 3 to sidebar, position 1 of 2".
- Move Up / Move Down keyboard buttons stay row-local; cross-zone keyboard access goes through "Move to zone…" submenu OR Tab + Enter pattern. Pick ONE; document the decision.

## a11y for undo/redo

- Cmd+Z is a global shortcut. ARIA: emit `aria-live="polite"` announcement of the operation just undone ("Undid: move Hero to position 3"). Don't interrupt with `assertive`.
- Visually: brief toolbar flash showing "Undid" / "Redid" label (matches the existing `useToast` pattern but distinct semantic — undo is informational, not error/success).

## Hard rules (re-pinned)

- **No AI attribution** (CLAUDE.md #15)
- **0 npm publishes** — workspace-only on commonpub.io
- **heatsync + deveco UNTOUCHED** on dormant 0.24.0
- **var(--*) only** — no hardcoded colors/fonts
- **Pre-push hook runs typecheck** — vue-tsc strict catches what vitest's esbuild lets pass
- **NEVER trust `gh run list`** — curl /api/health after deploy
- **Single-flight save stays** — undo/redo mutations route through `editor.draft.value` + the existing auto-save composable picks up dirty
- **No commands that bypass the dirty tracker** — every command must mutate `editor.draft.value` reactively so the version counter + auto-save fire
- **Verify load-bearing claims** against source (session 162 pattern)

## Self-audit after coding

Apply R1-R4 lens per session 160's pattern:

- **R1 (UX)**: cursor-as-contract during cross-zone drag; FLIP duration not jarring; reduced-motion path; undo announcement timing.
- **R2 (correctness)**: undo of an in-flight save (race); refresh clears history (verified); commands don't bypass single-flight; auto-save inflight + undo → both promises resolved correctly; cap behavior with N=51+; Pinia hydration on SSR.
- **R3 (operational)**: hotkey conflicts with browser shortcuts in input fields; mobile (where there's no keyboard) — drag still reachable; banner / toolbar reflects undo state if relevant.
- **R4 (perf/edges)**: command memory cost at cap; FLIP animation frame budget at N=50+ sections; Pinia store re-renders consumers correctly without re-rendering the canvas every command.

Expect 3-5 findings per session 162's recursion data (P2: 7 / audit-1: 5 / audit-2: 3 / audit-of-docs: 3 + 2 + 1). Schedule a polish commit before the close.

## First action

1. Confirm priority docs read (one paragraph max).
2. Confirm 3b/A is actually shipped (run the verification grep + endpoint check above).
3. Pick the smallest sub-task first (probably 3b.7 FLIP since it's mostly CSS + TransitionGroup) OR start the Pinia store scaffold so 3b.6 can call into it.
4. Atomic commits per discipline.
5. After all 4 ship, run R1-R4 audit. Then update the session log + write the next-session handoff.

Don't accumulate debt. After this ships, Phase 3c (resize) is the next arc — but write the kickoff prompt for it AT THE END of this session, not now.

---
