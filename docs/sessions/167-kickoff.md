# Kickoff prompt — session 167 (path-pick: Phase 3e config inspector OR polish batch OR adoption blockers)

Paste everything between the `---` rules as the FIRST message of a fresh Claude Code session. **Prerequisite: session 166 shipped — commits `7e4dcd5` (foundation) + `b73e064` (LayoutSection handle) + `2a20e1b` (LayoutRow + plumbing) + `5cf0201` (keyboard + R1-R4 audit fixes) + `6a43a7b` (round-2 audit P0 + P1 fixes), plus the docs commits.**

---

Fresh Claude Code session on the CommonPub monorepo. **Two tasks this session, in order:**

1. **Path-pick** — three options below. Ask the user at session start.
2. **Execute + R1-R4 self-audit + audit-of-audit at close.**

**Predecessor**: session 166 shipped Phase 3c **resize** end-to-end on commonpub.io (workspace `main`). Right-edge handle on each LayoutSection with pointer-drag + snap-to-12 + neighbour absorption + LAST-in-row trailing extend + 12-col guideline overlay + live span pill + constraint-snap label + Shift+Arrow keyboard a11y + per-press narration + Cmd+Z undo of both section AND absorbed neighbour. **PATH Y** (vanilla pointer events) over PATH X (`grid-layout-plus@1.1.1`) per the explore-agent's collision-boundary research + the CSS Grid incompatibility — session 163's deferred risk stays closed. Layer **567 → 622** tests (+55). Typecheck 12/12 FULL TURBO. **5 atomic commits**; 11 audit findings across R1-R4 + audit-of-audit + sweep + round-2 ultrathink (all fixed including a P0 the round-1 sweep missed — see 166-3c.md Round-2 audit section). Last code commit `6a43a7b`. heatsync + deveco UNTOUCHED on npm 0.24.0. **Audit recursion**: 11 findings across 7 rounds (R1=3, R2=1, R3=1, R4=0, audit-of-audit=1, sweep=0, round-2-fresh-eyes=3 incl 1 P0); diminishing-returns claim from round-1 sweep was premature — CSS-cascade specificity bug surfaced only on a slower fresh-eyes re-read.

## Verify session 166 actually shipped

Per `feedback-verify-loadbearing-values` + the audit pattern.

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
  echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
done
# Confirm Phase 3c symbols present across all 4 commits
grep -rE "useLayoutResize|resizeSectionCommand|clampResize|computeSnappedColSpan|narrateResize|narrateResizeBlocked|applyKeyboardResize" layers/base/composables 2>/dev/null | head -20
grep -rE "cpub-layout-section-resize-handle|cpub-layout-section-span-pill|cpub-layout-section-constraint-label|cpub-layout-row-resize-overlay|onResizeStart|hasResizeHandle" layers/base/components 2>/dev/null | head -20
# Confirm the R2-4 blur watchdog
grep -nE "onWindowBlur|onDocVisibilityChange|visibilitychange" layers/base/composables/useLayoutResize.ts
# Confirm the R3-6 unmount cancel
grep -n "useLayoutResize().cancelResize()" layers/base/pages/admin/layouts/\[id\].vue
# Confirm the lookupResizeBounds wiring
grep -n "lookupResizeBounds" layers/base/composables/useLayoutHotkeys.ts layers/base/pages/admin/layouts/\[id\].vue
# Confirm the PointerEvent shim
grep -n "PolyfillPointerEvent" layers/base/test-setup.ts
# Confirm help-overlay rows
grep -n "Shift', '←'\|Shift', '→'" layers/base/components/admin/layouts/AdminLayoutsHelpOverlay.vue
# Round-2 audit fixes (must be present)
grep -n ":not(.cpub-layout-section-resize-handle)" layers/base/components/LayoutSection.vue
grep -n "neighbourFixed\|effectiveNeighbourMin" layers/base/components/LayoutRow.vue "layers/base/pages/admin/layouts/[id].vue"
# Test count + typecheck
pnpm --filter @commonpub/layer test 2>&1 | grep "Tests" | tail -1     # expect: 622 passed
pnpm typecheck 2>&1 | tail -3                                          # expect: 26 cached, 26 total
curl -s -o /dev/null -w '/admin/layouts = %{http_code} (302 expected)\n' https://commonpub.io/admin/layouts
curl -sS https://commonpub.io/ | grep -oE 'class="[^"]*cpub-layout-(row|section)[^"]*"' | grep -oE 'cpub-layout-(row|section)(--editable)?' | sort | uniq -c
```

**Expected**: all 3 sites health=200; all named symbols present; layer **621 tests**; typecheck 26/26 FULL TURBO; `/admin/layouts=302`; **3 layout-row + 5 layout-section** + NO `--editable` on public byte-pattern. Any divergence: STOP + investigate.

## Mandatory reads (in order)

1. **`CLAUDE.md`** — rules #2 (flag), #3 (`var(--*)`), #11 (test-driven), #12 (WCAG 2.1 AA), #15 (**NEVER add Claude as co-author**)

2. **MEMORY.md priority memories**:
   - `feedback-no-coauthor` — re-pinned
   - `feedback-visual-editor-ux-patterns` — load-bearing for editor work
   - `feedback-match-established-pattern` — toolbar + modal precedents
   - `feedback-vue-tsc-strict-vs-vitest` — pre-push typecheck habit
   - `feedback-vi-restoreallmocks-wipes-vifn-impls` — `vi.clearAllMocks()` in afterEach
   - `feedback-vitest-import-meta-client-undefined` — composable browser guards
   - `feedback-reuse-existing-components` — DON'T fork section components for editor behavior
   - `feedback-phase-3-hybrid-libraries` — Path A picks FormKit + `@formkit/zod` per the prescribed library track
   - `feedback-aria-selected-needs-role` — ARIA attributes have role prerequisites

3. **Session 166 log**: `docs/sessions/166-3c.md` — what shipped + audit findings + decision log.

4. **Plan docs** (THE source of truth):
   - `docs/plans/phase-3-editor.md` — Phase 3e (config inspector) defined
   - `docs/plans/layout-and-pages.md` §7.9 (auto-generated form rules), §7.10 (per-section schema), §7.12 (toolbar / preview / publish)
   - `docs/adr/027-layout-engine-architecture.md` — architecture ratified

## Path-pick (ask the user at session start)

### Path A — Phase 3e Config Inspector / Auto-form from Zod [§7.9, §7.10]

**Why pick**:
- The biggest remaining feature ticket period — once 3e ships, the editor can actually edit section content (today's inspector only edits page-meta).
- Unlocks Phase 3d.4 (`Cmd+/` palette search), the FULL editor-shell axe scan, per-breakpoint editing wiring, AND the mobile inspector slider (closes the plan §7.5 gap left open by Phase 3c).
- 3e's schema-from-Zod pattern is a multiplier: every new section gets its inspector form for free.
- The schema-package refactor from session 161 (`packages/schema/src/sectionConfigs.ts`) already moved the schemas — 3e is the consumer side.

**Why NOT pick yet**:
- Biggest scope — 2-3 sessions, not one.
- Needs a library decision at session start: FormKit + `@formkit/zod` (per `feedback-phase-3-hybrid-libraries`) is the prescribed direction but install + integration is non-trivial.
- Commits to a multi-session arc.

**Sub-tasks** (per phase-3-editor.md §3e.1–§3e.6):
1. Install FormKit + `@formkit/zod`; decide on the FormKit theme integration with the CommonPub design system.
2. Build `<AdminLayoutsInspectorSection>` — reads selected section's def, looks up `configSchema` from `SECTION_CONFIG_SCHEMAS`, generates form via `createNode` or `<FormKit type='form'>`.
3. Each form field mutates the live section.config via the existing editor.draft → dirty → auto-save path.
4. Inspector dispatcher: page-meta vs section.config vs row.config (3-way switch).
5. colSpan slider on mobile (inspector path per plan §7.5).
6. Add resize-via-slider routes through `useLayoutResize.applyKeyboardResize` so all four input paths (pointer / keyboard / slider / future inline) share one history-record + narration code path.

### Path B — Polish batch (small wins from the roadmap)

**Why pick**:
- Faster cycle time — 3-5 small wins in one session.
- Each is well-defined; no library decisions.
- Surfaces several admin pain points that have been deferred for sessions.

**Candidates** (pick 3-4):
1. **Empty-zone droppable target** — true zone-level drop affordance ("Drop a section to begin"); complements Add Row.
2. **Preview button** — `?previewLayoutId=<draftId>` + 15min token; toolbar opens in new tab.
3. **Publish dropdown ▾** — Publish / Revert to last published / Version history (Phase 7 versioning prep).
4. **Per-breakpoint editing wiring** — Tablet viewport edits `responsive.md`, not base `colSpan`. Phase 3c set the base path; this wires up the responsive override per viewport.
5. **Section type pill on hover verify; grab handle on row hover** [§7.11]
6. **Selection restored on Cmd+Z** — when undo brings back a removed section, restore selection to it (capture selection in command record at time-of-record).
7. **`{center: true}` placement** — drop indicator returns null but `computeInsertIndex` returns 'after'. Indicator UX mismatch; 3-line fix.
8. **axe scan expansion** — extend `editor-axe.test.ts` to `AdminLayoutsToolbar`, `AdminLayoutsPalette`, `AdminLayoutsInspector`.
9. **Resize handle dim during dnd-kit drag** — prevent visual confusion when a section is mid-drag + the handle is also visible. CSS-only.

**Why NOT pick yet**:
- No architectural progress — pure polish.

### Path C — Adoption blockers (before non-homepage layout use)

**Why pick**:
- Phase 3a-3d (and now 3c) is editor-ready; the BLOCKER for using layouts on non-homepage routes is the CRUD + scope filter UI.
- Closes the gap between "we can edit layouts" and "operators can deploy layouts to their actual pages".

**Sub-tasks**:
1. **Custom page CRUD UI** — Create new layout (name + slug + initial frame). Slug conflict check against reserved route prefixes.
2. **Layout scope filter on /admin/layouts list** — homepage vs custom pages.
3. **Version history viewer + revert UI** — Phase 7 dependency.
4. **Schema migration runtime UI** — silent migration in useLayout + banner when migration applied.
5. **Audit log surfacing UI** — `cpub.audit.layout.*` already structured-logged; needs a viewer.

**Why NOT pick yet**:
- Heavy server-side surface area; less leverage per hour than Phase 3e.
- Less user-visible than 3e (which lights up section content editing).

**Default if no user preference**: **Path A (Phase 3e config inspector)**. Phase 3c just landed and the natural arc is "now make sections actually editable". The multi-session scope is the cost; the multiplier effect (every section gets its form for free) is the payoff. Skip 3e and the editor remains a layout-shaping tool with no content editing.

## Hard rules (load-bearing across every session)

- **No AI attribution** in any commit / PR / git artifact (CLAUDE.md #15)
- **0 npm publishes** — workspace-only on commonpub.io
- **heatsync + deveco UNTOUCHED** on dormant 0.24.0
- **`var(--*)` only** for any new styles
- **Pre-push hook runs typecheck** — vue-tsc strict catches what vitest's esbuild lets pass
- **NEVER trust `gh run list`** — always curl `/api/health` after deploy
- **Single-flight save stays** — every new mutation routes through `editor.draft.value`
- **Verify load-bearing claims against source** — re-check actual library APIs / Vue lifecycle details, not memory

## Self-audit after coding

Apply R1-R4 lens per session 160/162/163/164/165/166 pattern. Expect 2-5 findings per round. Recursion: R1-R4 → audit-of-audit. Stop when the curve diminishes.

If you add new components / composables: extend `editor-axe.test.ts` to scan them. Phase 3e is exactly the case for cranking the axe coverage (form fields, labels, error states).

## Session-close discipline

1. Update `docs/sessions/167-XXX.md` with what shipped + audit findings + 1-line recursion-pattern data
2. Write the next-session handoff (`167-kickoff-XXX.md`)
3. Don't accumulate debt. Finish what's started before adding scope.

## At-a-glance roadmap (post-session-166)

**Architectural** (own-session focus):
- **Phase 3e — Config inspector / auto-form from Zod** [§7.9, §7.10] — biggest remaining feature
- **Phase 6a mobile — bottom-sheet palette + inspector + pinch-zoom** [§7.7] — deferred until Phase 3 done

**Small wins** (could batch — see Path B):
- Per-breakpoint editing wiring (uses Phase 3c's foundation)
- Preview button + Publish dropdown
- Empty-zone droppable target
- Selection restored on Cmd+Z
- axe scan expansion to Toolbar/Palette/Inspector

**Adoption blockers** (before non-homepage use — see Path C):
- Custom page CRUD UI + slug picker
- Version history viewer
- Schema migration runtime UI
- Audit log surfacing UI

**Federation** — out of editor scope, separate plan ([[project-federation-plan]]).

## First action

1. Confirm priority docs read (one paragraph max)
2. Run the verification grep + endpoint check above. If session 166 wasn't shipped: STOP, ask the user, restart with `166-3c.md` review
3. **Ask the user**: TASK path-pick — Path A (Phase 3e config inspector) / Path B (polish batch) / Path C (adoption blockers)?
4. Execute the picked path
5. R1-R4 audit + at least one audit-of-audit round
6. Update `docs/sessions/167-XXX.md` with what shipped
7. Write `167-kickoff-XXX.md` for the next session

---
