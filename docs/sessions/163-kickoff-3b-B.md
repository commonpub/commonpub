# Kickoff prompt — Phase 3b/B (cross-zone + FLIP + undo/redo)

Paste everything between the `---` rules as the FIRST message of a fresh Claude Code session. **Prerequisite: Phase 3b/A (session 163) shipped successfully — verify before starting.**

---

Fresh Claude Code session on the CommonPub monorepo. **Task: Phase 3b/B — cross-zone drag + FLIP animations + Pinia undo/redo.**

**Predecessor**: session 163 shipped Phase 3b/A — palette → row drop, within-row reorder, drop dispatcher, DnDProvider boundary, selection model, ARIA live narration, Move Up / Move Down WCAG path, R1-R4 + audit-of-audit polish. **10 commits on `main`**, layer 318 → **401** tests (+83), schema 470, server 1129+3skip, typecheck 26/26 FULL TURBO. Last commit `f3f53a2`. heatsync + deveco UNTOUCHED on npm 0.24.0. commonpub.io workspace `main` — public byte-pattern unchanged (3 rows + 5 sections, no `--editable` leak).

Before doing anything else, **verify 3b/A actually shipped** (don't trust the handoff per `feedback-verify-loadbearing-values` + session 162 + 163's audit pattern):

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
  echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
done
# Confirm 3b/A wiring exists (not stubs)
grep -rE "makeDraggable|makeDroppable|DnDProvider" layers/base/components/admin/layouts layers/base/components/LayoutSection.vue layers/base/components/LayoutRow.vue 2>/dev/null | head -10
# Confirm a11y Move Up/Down buttons present
grep -rE "Move .* up|Move .* down|aria-label=.Move" layers/base/components/LayoutSection.vue | head -3
# Confirm dispatcher + announcer + section instance envelope wired
grep -rE "dispatchSectionDrop|useLayoutAnnouncer|section-instance" layers/base/composables layers/base/components 2>/dev/null | head -5
# Confirm 3b/A tests pass
pnpm --filter @commonpub/layer test 2>&1 | grep "Tests" | tail -1
# Editor still loads
curl -s -o /dev/null -w '/admin/layouts = %{http_code} (302 expected)\n' https://commonpub.io/admin/layouts
# Public byte-pattern unchanged
curl -sS https://commonpub.io/ | grep -oE 'class="[^"]*cpub-layout-(row|section)[^"]*"' | grep -oE 'cpub-layout-(row|section)(--editable)?' | sort | uniq -c
```

**Expected**: all 3 sites health=200; makeDraggable + makeDroppable + DnDProvider all present; `aria-label="Move {type} up|down"` present; dispatcher + announcer wired; **layer 401 tests passing**; `/admin/layouts=302`; 3 layout-row + 5 layout-section + NO `--editable`. Any divergence: STOP + investigate.

## Mandatory reads (in order)

1. **`CLAUDE.md`** — rules #2 (flag), #3 (`var(--*)`), #11 (test-driven), #12 (WCAG 2.1 AA), #15 (**NEVER add Claude as co-author**)

2. **MEMORY.md priority memories** (same set as 3b/A; still load-bearing):
   - `feedback-no-coauthor` — re-pinned (most-violated default)
   - `feedback-visual-editor-ux-patterns` — drag-drop a11y. **Reread §position-based wording** before writing announcement strings. Undo announcements go through `aria-live="polite"` (NOT assertive — undo is informational).
   - `feedback-phase-3-hybrid-libraries` — library boundary (dnd-kit OUTER; grid-layout-plus deferred to 3c per session 163's verified decision)
   - `feedback-match-established-pattern` — undo/redo UX should match Notion/Linear/Figma conventions (Cmd+Shift+Z NOT Cmd+Y; toast on undo NOT silent)
   - `feedback-editor-security-patterns` — single-flight save guard (undo must NOT race auto-save)
   - `feedback-reuse-existing-components` — layout engine = arranger. Don't write parallel command-system frameworks; Pinia + plain functions are enough
   - `feedback-vue-tsc-strict-vs-vitest` — Pinia store + command pattern will surface this; vue-tsc strict catches what vitest's esbuild doesn't. Pre-push hook is the safety net.
   - `feedback-vitest-import-meta-client-undefined` — composable browser guards (Pinia undo store has setTimeout/keydown listeners — needs `typeof window` guard)
   - `feedback-vi-restoreallmocks-wipes-vifn-impls` — `vi.clearAllMocks()` not `restoreAllMocks` when vi.fn impls need preserving

3. **Session 163 log**: `docs/sessions/163-3b-A.md` — what shipped + the audit findings + the architecture diagram. Patterns from there bias what 3b/B is likely to re-introduce.

4. **Plan docs** (THE source of truth):
   - `docs/plans/phase-3-editor.md` §Phase 3b — sub-tasks **3b.6 through 3b.9** are this session's scope
   - `docs/plans/layout-and-pages.md` §7.14 — undo/redo spec (operation types, command pattern, hotkeys, 50-cap, reset on Save)
   - `docs/plans/layout-and-pages.md` §7.6 — state machine including states for cross-zone + undo
   - `docs/plans/layout-and-pages.md` §7.11 — FLIP animation discipline (150ms cubic ease-out, reverse on remove, respect prefers-reduced-motion)
   - `docs/adr/027-layout-engine-architecture.md` — architecture ratified

5. **Existing surfaces you'll touch** (3b/A established the foundation):
   - `layers/base/composables/useLayoutDrag.ts` — `dispatchSectionDrop` currently returns `noop 'cross-row-deferred-to-3b-B'` for cross-row drops. THIS SESSION CASHES THAT RESERVATION.
   - `layers/base/composables/useLayoutEditor.ts` — `selectedId` + `draft` + `save` already plumbed; the undo store hooks here.
   - `layers/base/components/LayoutRow.vue` — owns `handleDrop` that delegates to the dispatcher. Cross-zone routing happens HERE if you keep the per-row droppable model (an alternative: zone-level droppable for cross-zone, row-level for within-row — design decision below).
   - `layers/base/components/LayoutSection.vue` — section instance draggable. Already carries `fromRowId` in payload.
   - `layers/base/composables/useLayoutAnnouncer.ts` — extend with `narrateMovedToZone` for cross-zone narration; add a `politeMessage` ref for undo announcements.

## Scope (4 sub-tasks)

Per `docs/plans/phase-3-editor.md` §Phase 3b:

- [ ] **3b.6 Cross-zone drag** — drag a section from a row in `zone=main` → drop into a row in `zone=sidebar`. Layout JSON updates correctly: section moves between `zones[i].rows[j].sections` arrays + position renumbered. Auto-save fires through the existing single-flight path. The dispatcher's `'cross-row-deferred-to-3b-B'` noop becomes a real branch.
  - **Design decision before coding**: do you keep per-row droppables + use the editor's `draft` to find the destination row's parent zone, OR do you add a zone-level droppable that LayoutSlot/AdminLayoutsCanvas mounts per zone? Per-row is simpler (just looks up `fromRowId` and the drop event's row); zone-level is closer to plan §7.4 ("Between-rows gap" target). Ask the user.
  - The dispatcher needs access to the EDITOR's full draft (not just one row) to mutate cross-row. Either pass the editor's draft to the dispatcher OR provide/inject the editor at the page level (overlaps with deferred T.2 P3 trivia — discuss with user).

- [ ] **3b.7 FLIP animations** — `<TransitionGroup>` on the canvas section list (inside `<LayoutRow>`). Animations respect `prefers-reduced-motion: reduce` (per CLAUDE.md #12 + WCAG 2.3.3). 150ms cubic ease-out per plan §7.11. Insertion: `transform: scale(0.96) → 1` + `opacity 0 → 1`. Reorder: FLIP (record positions before move, animate via transform from delta). Test the `prefers-reduced-motion` path explicitly — the audit-of-audit lens caught this kind of gap in session 162.

- [ ] **3b.8 Undo/redo stack** — Pinia store `useLayoutHistory` with command pattern.
  - `Command` interface: `{ apply: (draft) => void, invert: (draft) => void, label: string, timestamp: number }`
  - `past: Command[]` + `future: Command[]`
  - Drag operations + Move Up/Down call `history.record(cmd)` after mutating draft
  - `history.undo()`: pop `past`, apply `invert`, push to `future`; announce `'Undid: <label>'` via the announcer's polite channel
  - `history.redo()`: pop `future`, apply `apply`, push to `past`; announce `'Redid: <label>'`
  - Hotkeys: Cmd+Z (Mac) / Ctrl+Z (Win+Linux) → undo; Cmd+Shift+Z / Ctrl+Shift+Z → redo (NOT Cmd+Y — matches Notion + Linear + Figma + VS Code)
  - Reset on `refresh()` AND on `editor.save()` success (saved draft = new baseline; redo across save is hostile per plan §7.14)
  - Cap at 50; drop oldest when exceeded
  - Skip when an input/textarea has focus (browser-native undo handles input)
  - Plays well with the single-flight save guard: undo mutates `draft.value`, auto-save's watcher fires, save schedules. If a save is in-flight, the next save runs after with the post-undo state — exactly the existing contract.

- [ ] **3b.9 Tests + visual regression**:
  - Command stack: record / undo / redo / cap behavior / refresh + save clear past+future
  - Cross-row + cross-zone: drag from main row → sidebar row → JSON shape correct + position renumbered
  - FLIP `prefers-reduced-motion` honored (mock `matchMedia`)
  - Visual diff regression: starting layout → 3 drags → expected layout JSON match (snapshot OR explicit shape assertion)
  - Pinia store on SSR: hydration without crash (the layer's other Pinia surfaces are SSR-safe; mirror their pattern)

## a11y discipline

- **Cross-zone live region narration**: position-based, name the zones explicitly. "Hero moved from main, position 3 of 5 to sidebar, position 1 of 2." Use `narrateMovedToZone(type, fromZone, fromIdx, fromTotal, toZone, toIdx, toTotal)` helper added to useLayoutAnnouncer.
- **Move Up / Move Down stay row-local**. Cross-zone keyboard access goes through one of:
  1. New "Move to zone…" submenu on each section (popover with the zones list)
  2. Tab + Enter pattern with focusable zone droppable headers
  3. Cmd+Shift+Arrow (Up/Down moves up/down within row; Cmd+Shift+Left/Right moves to next zone)

  Pick ONE; document the decision in a code comment AND the session log + add a test. Discoverability matters more than economy — the FAQ "how do I move a section to the sidebar with the keyboard?" needs a single answer.
- **Undo/redo announcements**: `aria-live="polite"` (NOT assertive — undo is informational, not time-critical). Add a `politeMessage` ref + a separate `<div role="status" aria-live="polite">` element. Don't mix into the existing assertive region.
- **Hotkey conflicts**: input/textarea focus skips undo (browser handles `<input>` undo natively). Use `(e.target as HTMLElement)?.matches('input, textarea, [contenteditable]')` check.

## Hard rules (load-bearing across every session)

- **No AI attribution** in any commit / PR / git artifact (CLAUDE.md #15)
- **0 npm publishes** — workspace-only on commonpub.io
- **heatsync + deveco UNTOUCHED** on dormant 0.24.0
- **`var(--*)` only** for any new styles
- **Pre-push hook runs typecheck** — vue-tsc strict catches what vitest's esbuild lets pass. Pinia stores + command pattern interfaces are typical sites for the strict catch.
- **NEVER trust `gh run list`** — always curl `/api/health` after deploy
- **Single-flight save stays** — undo/redo mutations route through `editor.draft.value` reactively; auto-save picks up the dirty change. No new save call sites.
- **No commands that bypass the dirty tracker** — every command must mutate `editor.draft.value` so the version counter + auto-save fire.
- **Don't write parallel renderers** — FLIP animations bind to existing components; don't extract a new section renderer for animation. `<TransitionGroup>` on the row's section list is enough.
- **Match the established announcer pattern** — `useLayoutAnnouncer` is a singleton with `message` + `announce()`. Adding `politeMessage` + `announcePolite()` follows the SAME pattern verbatim (per `feedback-match-established-pattern`).
- **Verify load-bearing claims against source** — when documenting a Pinia hydration behavior, a `prefers-reduced-motion` matchMedia detail, or a dnd-kit cross-list semantic, re-check the actual implementation/spec, not memory. Session 163 found 8 wrong things this way; same risk here.
- **WCAG 2.1 AA** on every interactive element. Keyboard cross-zone path is NON-OPTIONAL.

## Self-audit after coding

Apply R1-R4 lens per session 160/163's pattern. Expected yield 3-7 findings per round (session 163: 5 + 2 = 7 total across two rounds).

- **R1 (UX)**: cursor-as-contract during cross-zone drag; FLIP duration not jarring; reduced-motion path; undo announcement timing; cross-zone keyboard discoverability.
- **R2 (correctness)**: undo of an in-flight save (race); refresh + save clear history (verified); commands don't bypass single-flight; auto-save inflight + undo → both promises resolve correctly; cap behavior with N=51+; Pinia hydration on SSR; FLIP animation duplicate-key risk; dispatcher returns `'cross-row-deferred-to-3b-B'` only for genuinely-unhandled cases (i.e., none in 3b/B).
- **R3 (operational)**: hotkey conflicts with browser shortcuts in input fields; mobile (no keyboard) — drag still reachable; thrashing banner reflects undo state if relevant.
- **R4 (perf/edges)**: command memory cost at cap (~50 × LayoutSection JSON); FLIP animation frame budget at N=50+ sections; Pinia store re-renders consumers correctly without re-rendering the canvas every command.

Expect a polish commit between the audit + the close. Schedule deliberately.

## First action

1. Confirm priority docs read (one paragraph max).
2. Run the verification grep + endpoint check above. If 3b/A wasn't shipped: STOP, ask the user, restart with `162-kickoff-3b-A.md`.
3. **Ask the user**: keyboard cross-zone path — submenu / focusable zone droppable / Cmd+Shift+Arrow? Pick before coding.
4. **Ask the user**: drop target shape — keep per-row droppables (simpler) or add per-zone droppable (closer to plan §7.4)? Pick before coding.
5. Pick the smallest sub-task first (probably 3b.7 FLIP since it's mostly CSS + `<TransitionGroup>`) OR start the Pinia store scaffold so 3b.6's cross-zone mutations can plug into it. Either works; document the choice.
6. Atomic commits per session 163's discipline (one logical change per commit, co-located tests, `pnpm typecheck` + targeted tests before push).
7. After all 4 ship, run R1-R4 audit + at least one audit-of-audit round.
8. Update `docs/sessions/164-3b-B.md` (or your session number) with what shipped + what audit caught.
9. Write the next-session handoff (`164-kickoff-3c.md`) for Phase 3c — resize via grid-layout-plus.

Don't accumulate debt. Finish what's started before adding scope. Phase 3c (resize) is the next arc — but write its kickoff at the END of this session, not now (per session 162/163 close discipline).

---
