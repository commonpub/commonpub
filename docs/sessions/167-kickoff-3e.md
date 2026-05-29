# Kickoff — session 167 (Phase 3e: config inspector / auto-form from Zod)

Paste everything between the `---` rules as the FIRST message of a fresh Claude Code session. **Prerequisite: session 166 shipped (final commit `0b08c39`)**.

This is the **streamlined** kickoff: NO path-pick. Session 166 closed with three audit rounds + a recommended next path; this kickoff commits directly to **Phase 3e config inspector** so a fresh-context session can start coding without the path-pick step. (The 3-path version lives at `167-kickoff.md` if you change your mind.)

---

Fresh Claude Code session on the CommonPub monorepo. **Task: Phase 3e — section config inspector with auto-generated forms from Zod schemas.** This is the **biggest remaining v1 editor feature**: once it ships, the editor can actually edit section CONTENT (today's inspector only edits page-meta).

**Predecessor**: session 166 shipped Phase 3c **resize** end-to-end on commonpub.io (workspace `main`). Right-edge handle + pointer drag + snap-to-12 + neighbour absorption + 12-col overlay + Shift+Arrow keyboard a11y + per-press narration + Cmd+Z undo. **PATH Y** (vanilla pointer events) over `grid-layout-plus@1.1.1` per the explore-agent's collision research. Layer **567 → 624** tests (+57). **5 atomic feature commits + 4 docs**; 11 audit findings across 7 rounds (R1-R4 + audit-of-audit + sweep + round-2 fresh-eyes [1 P0] + round-3 distance [4 polish, 0 P0/P1]). heatsync + deveco UNTOUCHED on npm 0.24.0. Last code commit `91848dc`.

**Phase 3e is the biggest scope on the v1 roadmap** — 2-3 sessions. This kickoff is for session 1 of that arc.

## Verify session 166 shipped

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do
  echo "  $u/api/health = $(curl -s -o /dev/null -w "%{http_code}" $u/api/health)"
done
# Phase 3c symbols
grep -rE "useLayoutResize|resizeSectionCommand|clampResize|narrateResize|applyKeyboardResize" layers/base/composables 2>/dev/null | head -10
grep -rE "cpub-layout-section-resize-handle|cpub-layout-row-resize-overlay" layers/base/components 2>/dev/null | head -5
# Round-2 audit fixes (P0 + P1)
grep -n ":not(.cpub-layout-section-resize-handle)" layers/base/components/LayoutSection.vue
grep -n "neighbourFixed\|effectiveNeighbourMin" layers/base/components/LayoutRow.vue "layers/base/pages/admin/layouts/[id].vue"
# Path B #9 polish
grep -nE "cpub-layout-section-resize-handle--hidden-during-drag|isSectionDragging" layers/base/components/LayoutSection.vue
# Tests + typecheck
pnpm --filter @commonpub/layer test 2>&1 | grep "Tests" | tail -1     # expect: 624 passed
pnpm typecheck 2>&1 | tail -3                                          # expect: 26 cached / 12 total
curl -s -o /dev/null -w '/admin/layouts = %{http_code} (302 expected)\n' https://commonpub.io/admin/layouts
curl -sS https://commonpub.io/ | grep -oE 'class="[^"]*cpub-layout-(row|section)[^"]*"' | grep -oE 'cpub-layout-(row|section)(--editable)?' | sort | uniq -c
```

**Expected**: all 3 sites health=200; symbols present; layer **624 tests**; typecheck green; `/admin/layouts=302`; 3 row + 5 section + NO `--editable`. Any divergence: STOP + read `docs/sessions/166-3c.md`.

## Decision pre-made: FormKit + @formkit/zod

Per [[feedback-phase-3-hybrid-libraries]]: **FormKit + `@formkit/zod`** is the prescribed library track for the auto-form. NO further library evaluation needed. The schema package's `packages/schema/src/sectionConfigs.ts` (session 161 refactor) already houses Zod schemas per section type; this kickoff is the consumer side.

**Library expectations to verify on install**:
- `@formkit/vue` (FormKit's Vue 3 component): runtime form engine.
- `@formkit/zod`: schema→form generator. Takes a Zod schema, emits a FormKit form definition.
- Theme integration: FormKit's "Genesis" theme uses pill rounded corners + soft borders — **incompatible** with CommonPub's design system (sharp corners, 2px borders, JetBrains Mono uppercase labels). Custom FormKit theme via `@formkit/themes` overrides; OR build a thin headless wrapper.
- Tree-shake: ensure unused FormKit input types don't bloat the bundle.

## Mandatory reads (in order)

1. **`CLAUDE.md`** — rules #2 (flag), #3 (`var(--*)`), #11 (test-driven), #12 (WCAG 2.1 AA), **#15 (NEVER add Claude as co-author)**
2. **MEMORY priorities**:
   - `feedback-no-coauthor` — re-pinned
   - `feedback-phase-3-hybrid-libraries` — library track committed
   - `feedback-visual-editor-ux-patterns` — load-bearing for form UX (especially: empty states, conflict UI, save-trust signals)
   - `feedback-match-established-pattern` — toolbar + modal precedents
   - `feedback-vue-tsc-strict-vs-vitest` — pre-push typecheck habit
   - `feedback-vi-restoreallmocks-wipes-vifn-impls` — `vi.clearAllMocks()` in afterEach
   - `feedback-vitest-import-meta-client-undefined` — `typeof window` not `import.meta.client`
   - `feedback-css-cascade-unit-test-blind-spot` — **new from session 166**: rapid R1-R4 misses CSS cascade bugs; real-browser verification or fresh-eyes pass required
   - `feedback-jsdom-pointerevent-missing` — PointerEvent shim already in test-setup.ts
3. **Session 166 log**: `docs/sessions/166-3c.md` — full audit history + the 2 polish items (R3-10 + R3-12) deferred to this session.
4. **Plan docs**:
   - `docs/plans/phase-3-editor.md` §3e — sub-tasks defined
   - `docs/plans/layout-and-pages.md` §7.9 (auto-form rules) + §7.10 (per-section schema dispatch) + §7.12 (toolbar/preview/publish)
   - `docs/adr/027-layout-engine-architecture.md` — ratified
5. **Existing surfaces you'll touch**:
   - `packages/schema/src/sectionConfigs.ts` — `SECTION_CONFIG_SCHEMAS` lookup map (already moved per session 161)
   - `layers/base/components/admin/layouts/AdminLayoutsInspector.vue` — currently dispatches to page-meta form only; will add section + row branches
   - `layers/base/composables/useLayoutEditor.ts` — `selectedId` drives the dispatch
   - `layers/base/sections/registry.ts` — `def.configSchema` is the source of truth per section type

## Scope (6 sub-tasks)

### 3e.1 — Install FormKit + decide theme integration
- `pnpm --filter @commonpub/layer add @formkit/vue @formkit/zod @formkit/themes`
- Add the Nuxt module: FormKit ships `@formkit/nuxt`; OR plug via `defineNuxtPlugin` if module-load semantics conflict with the existing setup.
- Theme decision: write a custom FormKit theme (CSS-only via `@formkit/themes` slots) using `var(--*)` tokens from `packages/ui/theme/`. Per CLAUDE.md rule #3, **zero hardcoded colors/fonts**.
- Verify bundle impact: check `nuxt build` size delta; gate behind `features.layoutEngine` if it's significant (already-gated for the broader editor).

### 3e.2 — `<AdminLayoutsInspectorSection>` — auto-form from Zod
- New component: reads `props.section` + looks up `def = sectionRegistry.get(section.type)` + retrieves `schema = SECTION_CONFIG_SCHEMAS[section.type]`.
- Use `@formkit/zod` to convert the Zod schema to FormKit definition: `createZodPlugin(schema)`.
- Render `<FormKit type="form" :value="section.config" @input="onConfigUpdate" />`.
- onConfigUpdate mutates `section.config` directly — flows through `editor.draft` → `dirty` → existing auto-save 1.5s debounce. **Single-flight save stays** (kickoff hard rule).
- Per-field validation surfaces inline via FormKit's built-in error display; the Zod schema's `.refine()` rules become field errors.

### 3e.3 — Inspector dispatcher (3-way switch)
- `<AdminLayoutsInspector>` reads `editor.selectedId.value.kind`:
  - `null` (no selection) → render the existing page-meta form
  - `'section'` → render `<AdminLayoutsInspectorSection>`
  - `'row'` → render `<AdminLayoutsInspectorRow>` (config: gap, align, paddingY, background)
- The dispatch is the editor's natural single-point-of-truth for "what's selected".

### 3e.4 — colSpan slider on mobile + integration with `useLayoutResize`
- Per plan §7.5: on `< 768px` viewport, the resize handle is hidden; the inspector form has a colSpan slider (range input or FormKit's slider type).
- Slider routes through `useLayoutResize.applyKeyboardResize` so the four input paths (pointer drag, keyboard Shift+Arrow, mobile slider, future inline) share one history-record + narration code path.
- WAI-ARIA: slider uses `role="slider"` (FormKit's built-in) — aligns with the polish item R3-10 from session 166 (resize handle should also move to `role="separator"`).

### 3e.5 — Opportunistic Phase 3c polish (R3-10 + R3-12)
- **R3-10**: convert resize handle from `<button>` to `<div role="separator" aria-orientation="vertical" aria-valuemin/max/now>` for canonical WAI-ARIA separator semantics. Slider's `role="slider"` + handle's `role="separator"` align cognitively. Test: extend `editor-axe.test.ts` to verify the new role.
- **R3-12**: fix the 12-col overlay snap-line gap misalignment. The lines should land at `(col / 12) * (rowWidth - 11*gap) + col*gap` instead of `(col/12)*100%`. Test: visual regression via a snapshot test OR a unit test that compares computed `left` offsets.

### 3e.6 — Tests + axe expansion
- Full editor-shell axe scan via `@nuxt/test-utils` + Playwright if not already infra'd; otherwise expand `editor-axe.test.ts` to cover `AdminLayoutsInspectorSection`, `AdminLayoutsInspectorRow`, AdminLayoutsToolbar, AdminLayoutsPalette.
- Per-field validation surfaces: write tests that feed invalid Zod-shaped configs and assert the form blocks submit + surfaces error messages.
- Per-section config: spot-check 3-4 builtin sections (hero, heading, image, content-feed) render their forms correctly. Don't aim for 100% builtin coverage — registry-driven means one form code path serves them all; the schema is the test surface.

## Hard rules (load-bearing across every session)

- **No AI attribution** in any commit / PR / git artifact (CLAUDE.md #15)
- **0 npm publishes** — workspace-only on commonpub.io
- **heatsync + deveco UNTOUCHED** on dormant 0.24.0
- **`var(--*)` only** for any new styles — including the FormKit theme overrides
- **Pre-push hook runs typecheck** — vue-tsc strict catches what vitest's esbuild lets pass
- **NEVER trust `gh run list`** — always curl `/api/health` after deploy
- **Single-flight save stays** — every section.config mutation routes through `editor.draft.value`
- **Verify load-bearing claims against source** — re-check FormKit API + theme integration against the actual installed package, not memory

## Self-audit after coding

R1-R4 + at least one audit-of-audit + **at least one fresh-eyes pass** per [[feedback-css-cascade-unit-test-blind-spot]]. The round-2 P0 in session 166 was a CSS-cascade bug invisible to the rapid sweep; Phase 3e introduces a NEW design system layer (FormKit theme) where the same class of bug can land. **Expected yield**: 5-10 findings per round, scaling with the larger surface.

- R1 (UX): empty states (no schema vs empty schema), error states, save-trust signals during typing (debounce visible feedback), tablet/phone behavior.
- R2 (correctness): partial submit, schema mid-edit (server hotswap), config mutation race during in-flight save, Zod refinement evaluation order.
- R3 (operational): per-section schema migrations (`migrations` field on def), unregistered section type, schema version drift between client + server.
- R4 (perf/edges): form re-render frequency, FormKit's reactivity overhead vs Vue's native, large config objects (e.g. content-feed with many filters), bundle impact.

## Session-close discipline

1. Update `docs/sessions/167-XXX.md` with what shipped + audit findings + recursion-curve data
2. Write `167-kickoff-next.md` for session 168 (likely Phase 3e session 2 or 3)
3. Don't accumulate debt. Finish what's started before adding scope.

## First action

1. Confirm priority docs read (one paragraph)
2. Run verification grep + endpoint check above. If session 166 wasn't shipped: STOP + investigate
3. **NO path-pick** — proceed directly to 3e.1 (install)
4. Sub-tasks 3e.1 → 3e.6 in order, atomic commits per sub-task
5. R1-R4 audit + audit-of-audit + fresh-eyes pass at session close
6. Update `docs/sessions/167-XXX.md` + write next handoff

Phase 3e session 1 realistic scope: 3e.1 + 3e.2 + 3e.3 (install + section form + dispatcher). 3e.4-6 carry into sessions 2-3.

---
