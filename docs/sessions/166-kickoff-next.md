# Kickoff prompt — session 166 (path-pick: Phase 3c resize OR Phase 3e config inspector OR polish batch)

Paste everything between the `---` rules as the FIRST message of a fresh Claude Code session. **Prerequisite: session 165 shipped (commits `569c0e2` + `810c08d` + `4e030f2` + `15a0fb0` + `e7b10f3`, plus 3 docs commits).**

---

Fresh Claude Code session on the CommonPub monorepo. **Two tasks this session, in order:**

1. **Path-pick** — three roughly-equal-leverage options below. Ask the user at session start.
2. **Execute the picked path with R1-R4 self-audit + audit-of-audit at close.**

**Predecessor**: session 165 shipped session-164 audit fixes + Phase 3d a11y completion + three ultrathink audit rounds (deep audit / continuation / nit pass). Backspace/Delete remove section, Cmd+D duplicate, `?` opens the new `<AdminLayoutsHelpOverlay>`, axe-core regression. axe scan caught + fixed a latent `aria-allowed-attr` violation from session 163. Round 3 added: modal-open suppresses global section hotkeys, HelpOverlay focus trap, dropped misleading Move group, `isRemoveLike` excludes Shift. Round 5 added: ConflictModal axe scan + focus trap (mirrors HelpOverlay), topmost-only guard on BOTH modal traps, parent watcher in `[id].vue` closes HelpOverlay when ConflictModal opens. Round 7 added explicit `aria-modal="true"` on ConflictModal for spec consistency. Layer 489 → **567** tests (+78), typecheck 26/26 FULL TURBO. Last code commit `e7b10f3`. heatsync + deveco UNTOUCHED on npm 0.24.0. commonpub.io workspace `main`. **Audit recursion**: 14 findings across 7 rounds; three consecutive 0-finding rounds (4/6/end-of-7) marked diminishing-returns floor.

## Verify session 165 actually shipped

Per `feedback-verify-loadbearing-values` + the audit pattern.

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
  echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
done
# Confirm full Phase 3d wiring
grep -rE "removeSectionCommand|duplicateSectionCommand|findSectionLocation|narrateSectionRemoved|narrateSectionDuplicated|AdminLayoutsHelpOverlay|onShowHelp|getSelection" layers/base/composables layers/base/components 2>/dev/null | head -20
# Confirm the aria-selected → aria-label state-in-name fix
grep -nE "aria-selected|Selected: " layers/base/components/LayoutSection.vue
# Confirm deep-audit fixes (modal suppression, focus trap, Move-group drop, Shift exclude)
grep -nE "isAnyDialogOpen|e.shiftKey" layers/base/composables/useLayoutHotkeys.ts
grep -nE "onFocusIn|dialogEl|isTopmostDialog" layers/base/components/admin/layouts/AdminLayoutsHelpOverlay.vue layers/base/components/admin/layouts/AdminLayoutsConflictModal.vue
# Round 5: dual-modal coordination — helpOpen=false when conflict opens
grep -n "helpOpen.value = false" layers/base/pages/admin/layouts/\[id\].vue
# Round 7: explicit aria-modal on both modals
grep -nE 'aria-modal="true"' layers/base/components/admin/layouts/AdminLayoutsHelpOverlay.vue layers/base/components/admin/layouts/AdminLayoutsConflictModal.vue
# Confirm axe-core install + regression file
grep -nE "axe-core" layers/base/package.json
ls layers/base/components/admin/layouts/__tests__/editor-axe.test.ts
# Confirm test count
pnpm --filter @commonpub/layer test 2>&1 | grep "Tests" | tail -1     # expect: 567 passed
pnpm typecheck 2>&1 | tail -3                                          # expect: 26 successful, 26 total
curl -s -o /dev/null -w '/admin/layouts = %{http_code} (302 expected)\n' https://commonpub.io/admin/layouts
curl -sS https://commonpub.io/ | grep -oE 'class="[^"]*cpub-layout-(row|section)[^"]*"' | grep -oE 'cpub-layout-(row|section)(--editable)?' | sort | uniq -c
```

**Expected**: all 3 sites health=200; all the named symbols present; layer 567 tests; typecheck 26/26; `/admin/layouts=302`; **3 layout-row + 5 layout-section** + NO `--editable` (public byte-pattern). Any divergence: STOP + investigate.

## Mandatory reads (in order)

1. **`CLAUDE.md`** — rules #2 (flag), #3 (`var(--*)`), #11 (test-driven), #12 (WCAG 2.1 AA), #15 (**NEVER add Claude as co-author**)

2. **MEMORY.md priority memories** (load-bearing for likely surfaces):
   - `feedback-no-coauthor` — re-pinned (most-violated default)
   - `feedback-visual-editor-ux-patterns` — for ANY editor UX work
   - `feedback-match-established-pattern` — toolbar buttons + conflict-modal precedents are load-bearing
   - `feedback-vue-tsc-strict-vs-vitest` — keep pre-push typecheck habit
   - `feedback-vi-restoreallmocks-wipes-vifn-impls` — `vi.clearAllMocks()` not `restoreAllMocks` in afterEach
   - `feedback-vitest-import-meta-client-undefined` — composable browser guards need `typeof window` not `import.meta.client`
   - `feedback-reuse-existing-components` — DON'T fork section components for editor behavior; use CSS + propMap
   - `feedback-phase-3-hybrid-libraries` — if you take Path A (3c): `grid-layout-plus@1.1.x` is installed; verify dnd-kit pointer-event collision boundary FIRST
   - `feedback-aria-selected-needs-role` — NEW from session 165: ARIA attributes have role prerequisites; axe regression caught it

3. **Session 165 log**: `docs/sessions/165-phase-3d.md` — full record of TASK 1 + TASK 2 + audit findings + this kickoff's roadmap.

4. **Plan docs** (THE source of truth):
   - `docs/plans/phase-3-editor.md` — Phase 3c (resize), 3e (config inspector) defined
   - `docs/plans/layout-and-pages.md` §7.5 (resize), §7.9 (auto-generated form rules), §7.10 (per-section schema), §7.12 (toolbar / preview / publish)
   - `docs/adr/027-layout-engine-architecture.md` — architecture ratified

## Path-pick (ask the user at session start)

### Path A — Phase 3c Resize [§7.5]

**Why pick**:
- Biggest visible feature ticket remaining for v1 editor.
- Closes the v1 "users need to resize columns" gap.
- Pairs naturally with Phase 3b's drag/drop — completes the column-manipulation story.

**Why NOT pick yet**:
- Requires a design decision at session start: `grid-layout-plus@1.1.x` (installed, but pointer-event collision with dnd-kit needs verification) vs roll-your-own resize (more code but no library risk).
- Session 163's 6-agent audit flagged the dnd-kit pointer-event boundary at `grid-item.vue:720` — re-verify BEFORE committing to integration path.
- 1-2 focused sessions.

**Kickoff reference**: `docs/sessions/164-kickoff-3c.md` (session 164's deferred plan).

### Path B — Phase 3e Config Inspector / Auto-form from Zod [§7.9, §7.10]

**Why pick**:
- The biggest remaining feature ticket period — once 3e ships, the editor can actually edit section content (today's inspector only edits page-meta).
- Unlocks Phase 3d.4 (`Cmd+/` palette search), the FULL editor-shell axe scan, and the per-breakpoint editing wiring.
- 3e's schema-from-Zod pattern is a multiplier: every new section gets its inspector form for free.

**Why NOT pick yet**:
- Biggest scope — 2-3 sessions, not one.
- Needs a library decision at session start: FormKit + `@formkit/zod` (per [[feedback-phase-3-hybrid-libraries]]) is the prescribed direction but install + integration is non-trivial.
- The schema-package refactor from session 161 (`packages/schema/src/sectionConfigs.ts`) already moved the schemas — 3e is the consumer side.

**Kickoff reference**: skim `docs/plans/phase-3-editor.md` §7.9 + §7.10 + the [[feedback-phase-3-hybrid-libraries]] memory entry.

### Path C — Polish batch (small wins from the roadmap)

**Why pick**:
- Faster cycle time — 4-5 small wins in one session.
- Each is well-defined; no library decisions.
- Surfaces several admin pain points that have been deferred for sessions.

**Candidates** (pick 3-4):
1. **Empty-zone droppable target** — true zone-level drop affordance ("Drop a section to begin"); complements Add Row.
2. **Preview button** — `?previewLayoutId=<draftId>` + 15min token; toolbar opens in new tab.
3. **Publish dropdown ▾** — Publish / Revert to last published / Version history (Phase 7 versioning prep).
4. **Per-breakpoint editing wiring** — Tablet viewport edits `responsive.md`, not base `colSpan`.
5. **Section type pill on hover verify; grab handle on row hover** [§7.11]
6. **Selection restored on Cmd+Z** — when undo brings back a removed section, restore selection to it (capture selection in command record at time-of-record). Power-feature UX.
7. **`{center: true}` placement** — drop indicator returns null but `computeInsertIndex` returns 'after'. Indicator UX mismatch; 3-line fix.
8. **axe scan expansion** — extend `editor-axe.test.ts` to `AdminLayoutsToolbar`, `AdminLayoutsPalette`, `AdminLayoutsInspector`. Likely surfaces more findings.

**Why NOT pick yet**:
- No architectural progress — pure polish.
- Each is small enough to batch into a future session as side-quests.

**Default if no user preference**: **Path A (Phase 3c resize)**. Bigger feature, well-defined kickoff already drafted, only one design decision at start. Phase 3e is the bigger arc — better to tackle when there's a clean session boundary to start it.

## Hard rules (load-bearing across every session)

- **No AI attribution** in any commit / PR / git artifact (CLAUDE.md #15)
- **0 npm publishes** — workspace-only on commonpub.io
- **heatsync + deveco UNTOUCHED** on dormant 0.24.0
- **`var(--*)` only** for any new styles
- **Pre-push hook runs typecheck** — vue-tsc strict catches what vitest's esbuild lets pass
- **NEVER trust `gh run list`** — always curl `/api/health` after deploy
- **Single-flight save stays** — every new mutation routes through `editor.draft.value`
- **Verify load-bearing claims against source** — when documenting a library API or Vue lifecycle detail, re-check the actual implementation/spec, not memory

## Self-audit after coding

Apply R1-R4 lens per session 160/162/163/164/165 pattern. Expect 2-5 findings per round. Recursion: R1-R4 → audit-of-audit. Stop when the curve diminishes.

If you add new components / composables: consider extending `editor-axe.test.ts` to scan them. The axe pass is the cheapest insurance policy you can buy at this stage of the editor.

## Session-close discipline

1. Update `docs/sessions/166-XXX.md` with what shipped + audit findings + 1-line recursion-pattern data
2. Write the next-session handoff (`166-kickoff-XXX.md`)
3. Don't accumulate debt. Finish what's started before adding scope.

## At-a-glance roadmap (post-session-165)

What's left, ordered by leverage:

**Architectural** (own-session focus):
- **Phase 3c — Resize** [§7.5] — `164-kickoff-3c.md` ready
- **Phase 3e — Config inspector / auto-form from Zod** [§7.9, §7.10] — biggest remaining feature

**Small wins** (could batch — see Path C):
- Per-breakpoint editing wiring
- Preview button + Publish dropdown
- Empty-zone droppable target
- Section type pill / grab handle visual polish

**Adoption blockers** (before non-homepage use):
- Custom page CRUD UI + slug picker + version history viewer
- Schema migration runtime UI
- Audit log surfacing UI

**Phase 6a mobile** — deferred until Phase 3 ships
**Section registry expansion** — Spacer / Embed / Tabs / Accordion as needed
**Federation** — out of editor scope, separate plan

## First action

1. Confirm priority docs read (one paragraph max)
2. Run the verification grep + endpoint check above. If session 165 wasn't shipped: STOP, ask the user, restart with `165-phase-3d.md` review
3. **Ask the user**: TASK path-pick — Path A (Phase 3c resize) / Path B (Phase 3e config inspector) / Path C (polish batch)?
4. Execute the picked path
5. R1-R4 audit + at least one audit-of-audit round
6. Update `docs/sessions/166-XXX.md` with what shipped
7. Write `166-kickoff-XXX.md` for the next session

---
