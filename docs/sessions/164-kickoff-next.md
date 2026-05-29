# Kickoff prompt — session 165 (audit fixes + path-pick: 3d a11y OR 3c resize)

Paste everything between the `---` rules as the FIRST message of a fresh Claude Code session. **Prerequisite: session 164 polish rounds 1 + 2 shipped (commits `c7156d1` through `632fd31`).**

---

Fresh Claude Code session on the CommonPub monorepo. **Two tasks this session, in order:**

1. **Apply 3 audit findings from session 164's polish rounds** (small CSS/logic fixes; ~30 min)
2. **Path-pick + execute** — either Phase 3d a11y completion (recommended; smaller scope, lands keyboard parity) OR start Phase 3c resize (needs grid-layout-plus vs roll-your-own design decision first)

**Predecessor**: session 164 shipped Phase 3b/B + 2 polish rounds. Cross-row/cross-zone drag, FLIP animations, undo/redo (Pinia → singleton deviation documented), "Move to zone…" WCAG keyboard path, edge-tab panel collapses, ContentGridSection responsive cap, savedVersion monotonic guard, Add Row + Remove Row + commands, Hero CTA inert content (one CSS rule), placement-aware drop indicators. **19 commits on `main`**, layer 411 → **489** tests (+78), typecheck 26/26 FULL TURBO. Last commit `632fd31`. heatsync + deveco UNTOUCHED on npm 0.24.0. commonpub.io workspace `main`.

## Verify session 164 actually shipped

Per `feedback-verify-loadbearing-values` + session 162/163/164 audit pattern — never trust a handoff.

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
  echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
done
# Confirm full 3b/B + both polish rounds wiring
grep -rE "useLayoutHistory|useLayoutHotkeys|moveSectionCommand|addRowCommand|removeRowCommand|cpub-flip-move" layers/base/composables layers/base/components 2>/dev/null | head -12
grep -rE "narrateMovedToZone|narrateRowAdded|narrateRowRemoved|politeMessage|onMoveToZone|cpub-admin-layouts-canvas-add-row|cpub-admin-layouts-editor-edge-tab|cpub-layout-row-remove|cpub-layout-section--drop-before" layers/base 2>/dev/null | head -15
grep -nE "savingVersion > savedVersion" layers/base/composables/useLayoutEditor.ts
grep -nE "pointer-events: none" layers/base/components/LayoutSection.vue
pnpm --filter @commonpub/layer test 2>&1 | grep "Tests" | tail -1     # expect: 489 passed
pnpm typecheck 2>&1 | tail -3                                          # expect: 26 successful, 26 total
curl -s -o /dev/null -w '/admin/layouts = %{http_code} (302 expected)\n' https://commonpub.io/admin/layouts
curl -sS https://commonpub.io/ | grep -oE 'class="[^"]*cpub-layout-(row|section)[^"]*"' | grep -oE 'cpub-layout-(row|section)(--editable)?' | sort | uniq -c
```

**Expected**: all 3 sites health=200; all the named symbols present; layer 489 tests; typecheck 26/26; `/admin/layouts=302`; **3 layout-row + 5 layout-section** + NO `--editable` (public byte-pattern). Any divergence: STOP + investigate.

## Mandatory reads (in order)

1. **`CLAUDE.md`** — rules #2 (flag), #3 (`var(--*)`), #11 (test-driven), #12 (WCAG 2.1 AA), #15 (**NEVER add Claude as co-author**)

2. **MEMORY.md priority memories** (load-bearing across this session's likely surface):
   - `feedback-no-coauthor` — re-pinned (most-violated default)
   - `feedback-visual-editor-ux-patterns` — for ANY a11y / keyboard / focus work; reread §position-based wording + §28×28 targets
   - `feedback-match-established-pattern` — hotkey conventions, button hierarchies, narration channels
   - `feedback-vue-tsc-strict-vs-vitest` — keep pre-push typecheck habit; new hotkey handlers + composable signatures are typical strict-catch sites
   - `feedback-vi-restoreallmocks-wipes-vifn-impls` — `vi.clearAllMocks()` not `restoreAllMocks` in afterEach
   - `feedback-vitest-import-meta-client-undefined` — composable browser guards need `typeof window` not `import.meta.client`
   - `feedback-reuse-existing-components` — DON'T fork section components for editor behavior; use CSS + propMap (the inert-content fix at `d4f7b18` is the gold-standard application)
   - `feedback-phase-3-hybrid-libraries` — if you take the 3c path: `grid-layout-plus@1.1.x` is installed but the dnd-kit pointer-event collision boundary needs verification

3. **Session 164 log**: `docs/sessions/164-3b-B.md` — full record of what shipped + the 3 audit findings to fix FIRST + the post-session roadmap.

4. **Plan docs** (THE source of truth):
   - `docs/plans/phase-3-editor.md` — Phase 3c (resize), 3d (a11y), 3e (config inspector) all defined
   - `docs/plans/layout-and-pages.md` §7.5 (resize), §7.8 (keyboard model + SR narration), §7.10 (auto-generated form rules)
   - `docs/adr/027-layout-engine-architecture.md` — architecture ratified

## TASK 1 (do FIRST, before any path-pick): Apply 3 audit findings from session 164

Per the audit at the bottom of `164-3b-B.md`. Each is a small, isolated fix. One commit per fix OR one consolidated polish commit — your call (consolidated is fine if all 3 are well-tested).

### Finding R1-1 — Edge tabs below WCAG 2.5.8 AA minimum

**File**: `layers/base/pages/admin/layouts/[id].vue` (the `<style>` block at the bottom)

**Current**:
```css
.cpub-admin-layouts-editor-edge-tab { width: 18px; height: 56px; ... }
```

**Fix**: bump `width` to `24px` (or `28px` for design buffer — match the existing 28×28 button convention from `feedback-visual-editor-ux-patterns`). Verify the chevron icon stays centered (font-size: 10px should still fit).

**Also**: adjust the `--left` and `--right` position math accordingly:
```css
.cpub-admin-layouts-editor-edge-tab--left { left: calc(280px - 12px); } /* was 9px for 18-wide */
```
At 24px width, offset is `-12px` to keep the tab centered ON the boundary. At 28px width, `-14px`.

### Finding R2-2 — `dropIndicatorSide` symmetry with `computeInsertIndex`

**File**: `layers/base/components/LayoutSection.vue`

**Current**:
```ts
const dropIndicatorSide = computed<'before' | 'after' | null>(() => {
  const placement = isDragOver.value;
  if (!placement) return null;
  if (placement.left) return 'before';
  if (placement.right) return 'after';
  return null;
});
```

`useLayoutDrag.ts` `computeInsertIndex` ALSO honors `top`/`bottom`:
```ts
const insertBefore = hovered.placement.left || hovered.placement.top;
```

**Fix**: mirror that for symmetry:
```ts
if (placement.left || placement.top) return 'before';
if (placement.right || placement.bottom) return 'after';
```

**Test**: extend `LayoutSection.test.ts` "drop-indicator class binding" describe with 2 new tests — `placement.top → --drop-before`, `placement.bottom → --drop-after`. (The test fixture currently mounts with `top: true` and expects neither class; FLIP it to expect `--drop-before` after the fix.)

### Finding R3-3 — Panels stuck hidden on tablet

**File**: `layers/base/pages/admin/layouts/[id].vue` (the `<style>` block)

**Cause**: removed toolbar toggles + hid edge tabs at `<=1024px`. Cookie state from desktop persists. Tablet admin has no way to re-show a panel hidden in a prior desktop session.

**Fix**: CSS override at `@media (max-width: 1024px)`:
```css
@media (max-width: 1024px) {
  /* At tablet/phone, force panels visible regardless of cookie state.
     The body falls back to single-column DOM stack here; the desktop
     'collapsed' state has no useful meaning when there's no grid
     column to remove. Overrides v-show's display:none. */
  .cpub-admin-layouts-palette,
  .cpub-admin-layouts-inspector {
    display: block !important;
  }
}
```

**Verify**: existing tests don't cover this transition (it's a media-query state). Consider adding a layout-shell test that mounts at viewport=mobile + verifies the panels are visible despite cookie. Or skip the test if jsdom matchMedia mocking is painful — trust the CSS.

### Audit-of-audit pass after applying the 3 fixes

Quick walk: do the fixes introduce new edge cases?
- Bumping edge-tab width: does the wider button at `28px` overlap with neighboring DOM at any breakpoint? The position calculation `calc(280px - 14px)` keeps it centered on the boundary. Should be fine.
- Top/bottom placement: does dnd-kit ever set BOTH top + bottom or NEITHER but with another field? Check the IPlacement type from the `.d.ts` (per `feedback-verify-loadbearing-values` — never trust memory, re-check the source).
- Tablet display override: does `!important` cascade clash with future tablet-specific hiding? Unlikely — there's no other rule wanting to hide these panels on tablet.

Expected: 0 audit-of-audit findings. If you catch some, ship a small follow-up.

## TASK 2 (path-pick): Phase 3d a11y completion OR Phase 3c resize

**Recommended: Phase 3d.** Reasons:
- Smaller, well-defined scope (5 sub-tasks, plan §7.8 keyboard model)
- Closes the WCAG 2.1 AA story for the keyboard model BEFORE more complex gestures (resize) land
- Doesn't need a design decision at session start
- `useLayoutHotkeys` foundation already exists; this extends it
- 1 focused session

**Alternative: Phase 3c resize.** Reasons to pick:
- Bigger feature ticket (gets us closer to feature-complete)
- BUT requires asking the user about grid-layout-plus vs roll-your-own at session start (the dnd-kit pointer-event collision boundary noted in session 163's Explore-agent research)
- Likely 1-2 sessions

**Ask the user at session start** which path they want. Default to 3d if no preference.

### Phase 3d scope (if picked)

Per plan §7.8:

- [ ] **3d.1 Backspace / Delete = remove section** when a section is selected. Confirm if section has rich content (text/image). Records `removeSectionCommand` for undo. Skip when input/textarea/contenteditable has focus.
- [ ] **3d.2 Cmd/Ctrl+D = duplicate section** when a section is selected. Clones section with new id, splices in after original, records `duplicateSectionCommand`. Same input-skip rule.
- [ ] **3d.3 `?` (Shift+/) = help overlay** — modal dialog listing all hotkeys. Categories: navigation, drag, undo/redo, edit (delete/duplicate), save. Plan §7.8 keyboard table is the source.
- [ ] **3d.4 Cmd/Ctrl+/ = focus palette search** (Phase 3e dependency — the palette doesn't have a search input yet; skip this sub-task OR add a minimal search input first).
- [ ] **3d.5 axe-core regression test** for the editor surface. Mount the editor at each state (idle / dragging / selection-section / selection-row / palette-open / inspector-open) + assert axe.run() reports zero violations at AA. Touches @testing-library/vue + axe-core (may need a small testing-utility addition).

**Architecture for 3d.1 + 3d.2**: extend `useLayoutHotkeys` with an optional `getSelection: () => EditorSelection` callback. The handler reads selection at keydown-time + branches on `sel.kind`. New command factories `removeSectionCommand` + `duplicateSectionCommand` in `useLayoutHistory.ts` (mirror the addRow/removeRow pattern).

### Phase 3c scope (if picked)

Per plan §7.5 + kickoff at `docs/sessions/164-kickoff-3c.md` (note: I left a separate kickoff for 3c; you can reuse its scope verbatim).

**FIRST design decision**: spawn an Explore-agent on `grid-layout-plus@1.1.1` vs `@vue-dnd-kit/core@2.4.6` pointer-event collision boundary. Session 163's research is in `docs/sessions/163-3b-A.md` post-session 6-agent audit. Verify against the actual `grid-item.vue:720` interactjs handler before committing to an integration path.

## Hard rules (load-bearing across every session)

- **No AI attribution** in any commit / PR / git artifact (CLAUDE.md #15)
- **0 npm publishes** — workspace-only on commonpub.io
- **heatsync + deveco UNTOUCHED** on dormant 0.24.0
- **`var(--*)` only** for any new styles
- **Pre-push hook runs typecheck** — vue-tsc strict catches what vitest's esbuild lets pass. New hotkey handlers + composable signatures are typical strict-catch sites.
- **NEVER trust `gh run list`** — always curl `/api/health` after deploy
- **Single-flight save stays** — every new mutation routes through `editor.draft.value`; auto-save picks up the dirty change.
- **Verify load-bearing claims against source** — when documenting a `dnd-kit IPlacement` shape, a `grid-layout-plus` API, or a Vue 3 lifecycle detail, re-check the actual implementation/spec, not memory. Session 163 + 164 each found things this way.

## Self-audit after coding

Apply R1-R4 lens per session 160/162/163/164 pattern.

- **R1 (UX)**: hotkey discoverability (does the help overlay surface them?); confirm-dialog copy quality on destructive actions; SR narration timing
- **R2 (correctness)**: hotkey behavior when section selection is stale (the section was removed by drag mid-keydown); duplicate-section's new id collision (use `crypto.randomUUID()`); axe-core assertion failures actually point at fixable issues
- **R3 (operational)**: hotkey conflicts with browser-native (Backspace navigates back on macOS without focus); help overlay focus trap; modal Esc handling
- **R4 (perf/edges)**: axe scan time on the editor surface; many sections + many hotkey events; selection lookup cost (`findRowInDraft` is O(zones × rows) — fine at v1 N=10 but worth noting)

Expect 2-5 findings per round. Recursion: R1-R4 → audit-of-audit. Stop when curve diminishes.

## Session-close discipline

1. Update `docs/sessions/165-XXX.md` with what shipped + audit findings + 1-line recursion-pattern data
2. Write the next-session handoff (`165-kickoff-XXX.md`)
3. Don't accumulate debt. Finish what's started before adding scope.

## At-a-glance roadmap (post-session-164)

What's left, ordered by leverage:

**Architectural** (own-session focus):
- **Phase 3c — Resize** [§7.5] — `164-kickoff-3c.md` ready
- **Phase 3e — Config inspector / auto-form from Zod** [§7.9, §7.10] — biggest remaining feature, 2-3 sessions

**Small wins** (could batch):
- This session's TASK 2 (Phase 3d hotkeys + axe regression)
- Per-breakpoint editing wiring (Tablet viewport → `responsive.md`, not base `colSpan`) [§7.12]
- Preview button (`?previewLayoutId=<draftId>` + 15min token) [§7.12]
- Publish dropdown ▾ (Publish / Revert to last published / Version history) [§7.12]
- Empty-zone "Drop a section to begin" target (true zone-level droppable; complements Add Row) [§7.4]
- Section type pill on hover verify; grab handle on row hover [§7.11]

**Mobile / Phase 6a** (defer until Phase 3 done):
- Tablet bottom-sheet palette + inspector [§7.7]
- Pinch-to-zoom canvas
- 44×44 drag handles on touch

**Custom pages** [§8 — needed before non-homepage adoption]:
- Create new custom-page UI (name + slug + initial frame)
- Slug conflict check against reserved route prefixes
- Version history viewer + revert UI
- Layout scope filter on `/admin/layouts` list

**Server / operational**:
- Schema migration runtime UI (silent migration in `useLayout` + banner)
- Audit log surfacing UI (`cpub.audit.layout.*` already structured-logged)

**Section registry expansion** (as needed):
- Spacer, Embed (YouTube/Vimeo + iframe allowlist), Tabs, Accordion

**Federation / future phases** (out of editor scope):
- Phase 4 layout migration to heatsync + deveco (uptake on dormant 0.24.0)
- Federation work per `project_federation_plan` memory

## First action

1. Confirm priority docs read (one paragraph max)
2. Run the verification grep + endpoint check above. If session 164 wasn't shipped: STOP, ask the user, restart with `164-3b-B.md` review
3. **Apply the 3 audit findings** from TASK 1. Atomic commits or one consolidated polish commit. Pre-push: `pnpm typecheck` + targeted tests
4. **Ask the user**: TASK 2 path — Phase 3d a11y completion (recommended) OR Phase 3c resize start?
5. Execute the picked path
6. R1-R4 audit + at least one audit-of-audit round
7. Update `docs/sessions/165-XXX.md` with what shipped
8. Write `165-kickoff-XXX.md` for the next session

---
