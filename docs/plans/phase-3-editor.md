# Phase 3 — Layout Editor (Hybrid: 3 primitives + build the shell)

> **Living document.** Updated as each phase ships. Source of truth for the layout editor work.

**Decided 2026-05-27 (session 159 close)**: HYBRID approach. Adopt 3 mature MIT-licensed Vue 3 primitives instead of writing drag-drop/resize/grid math from scratch OR adopting a full-fledged editor (none of which fit our zone-keyed section-registry-with-Zod model — full audit in [the agent research output linked from `docs/plans/stage-e-unification.md`]).

**Installed** (commit pending): `grid-layout-plus@1.1.1` + `@vue-dnd-kit/core@2.4.6` in `layers/base/package.json`. FormKit deferred to Phase 3e when we'd actually use it.

---

## Library choices + WHY

### 1. `grid-layout-plus@1.1.1` (MIT, Vue 3, TypeScript)

The 12-column responsive drag/resize grid. By `qmhc` (also author of Vexip UI). Clean port of React-Grid-Layout's mature behavior.

**Used for**: Phase 3b (drag-drop within layout rows) + Phase 3c (resize with snap-to-12 + neighbour absorption). Replaces hand-rolled grid math.

**What it gives**:
- Responsive breakpoint columns (12/8/4 typical)
- Drag-to-reorder + drag-to-move-between-rows
- Resize handle on each item with snap
- `:cols-num`, `:items` reactive props
- `@layout-updated` emit fires on each interaction

**What it does NOT give**:
- Keyboard equivalents (Phase 3d builds on top)
- Multi-select / group drag (Phase 8)
- Layout-level undo/redo (we own this — Pinia store)

**Bundle**: ~25KB minified (manageable).

### 2. `@vue-dnd-kit/core@2.4.6` (MIT, Vue 3, by `zizigy`)

Dnd-kit-inspired composables for Vue 3. Strong a11y posture (keyboard + screen reader narration baked in).

**Used for**: Phase 3b (sections palette → canvas drop) + cross-zone drag (move section between full-width / main / sidebar). Phase 3d a11y leans on its existing keyboard support.

**Why over `vue-draggable-plus`** (the safer 4k-star option): WCAG 2.1 AA is a hard requirement per CLAUDE.md. vue-dnd-kit ships keyboard nav OOTB; vue-draggable-plus would need it built. Mature enough (active maintenance, composable API matches our setup-script convention).

**Used in combo with grid-layout-plus**: dnd-kit handles the cross-grid drops (palette → grid, grid → grid across zones). grid-layout-plus handles within-row drag/resize. Clear boundary: dnd-kit owns the OUTER drag, grid-layout-plus owns the INNER drag.

### 3. FormKit + @formkit/zod *(DEFERRED — install at Phase 3e)*

For auto-form generation from per-section Zod configSchemas. Each section in the registry has a configSchema; the inspector pane reads it + renders the form.

**Why deferred**: Phase 3a-3d don't need it. By Phase 3e, we'll have iterated enough on the section configs to know exactly which Zod kinds we need to map. FormKit (or shadcn-vue AutoForm) is the candidate; final pick at Phase 3e.

**Custom pickers** still needed (content/hub/image/color) — those wrap FormKit's input plugin API.

---

## Execution sequence

Each phase: small commits, run tests, push, verify on commonpub.io (editor pages are admin-only — won't affect public homepage rendering).

### Phase 3a — Editor shell read-only (1 session)

- [ ] **3a.1** Add `:editable` prop to `LayoutSlot.vue` (default false). When true, wraps each section in a selection overlay div (no behavior change yet — just visual affordance).
- [ ] **3a.2** Page list — `layers/base/pages/admin/layouts/index.vue`. Table: scope, name, state, updated_at, actions (edit/delete). Uses `GET /api/admin/layouts` (already exists from session 158).
- [ ] **3a.3** Editor shell — `layers/base/pages/admin/layouts/[id].vue`. Three columns: section palette (left, registered-from-registry list), canvas (LayoutSlot :editable=true, previewOverride=draft), inspector (right).
- [ ] **3a.4** Page-meta inspector form — title/description/ogImage/access/frame fields (hardcoded inspector, not yet Zod-driven). Uses `PUT /api/admin/layouts/[id]` (already exists).
- [ ] **3a.5** Toolbar — viewport toggle (mobile/tablet/desktop preview width), save indicator, publish button.
- [ ] **3a.6** Auto-save scaffolding — debounced PUT (5s after last edit), `etag`/version conflict detection (409 → modal).
- [ ] **3a.7** Tests — page render tests + smoke test of layout fetch path.
- [ ] **3a.8** Commit + push + verify `/admin/layouts/[id]` page loads on commonpub.io with a real layout.

### Phase 3b — Drag-drop (2 sessions; split at the half-way mark)

**Session 3b/A — palette drag + within-row reorder**:
- [ ] **3b.1** Wire `grid-layout-plus` into LayoutSlot's editable mode — each section becomes a draggable+resizable grid item
- [ ] **3b.2** Section palette uses `@vue-dnd-kit/core` `useDraggable` — drag a palette item; `@vue-dnd-kit/core` `useDroppable` on each row (or zone) accepts the drop, creates a section in the layout
- [ ] **3b.3** Drop indicator (between-row line, between-section gap) using dnd-kit's collision detection
- [ ] **3b.4** Save-on-drop via auto-save scaffolding (3a.6)
- [ ] **3b.5** Tests

**Session 3b/B — cross-zone drag + reorder polish + undo/redo**:
- [ ] **3b.6** Drag section from row in zone A → drop into zone B (full-width → sidebar). Layout JSON updates correctly.
- [ ] **3b.7** FLIP animations on reorder (Vue's `<TransitionGroup>` is enough).
- [ ] **3b.8** Undo/redo stack — Pinia store with command pattern. Hotkeys Cmd+Z/Shift+Cmd+Z.
- [ ] **3b.9** Tests for the command stack + visual diff regression on a known starting layout

### Phase 3c — Resize (1 session)

- [ ] **3c.1** Enable `grid-layout-plus` resize handles
- [ ] **3c.2** Snap-to-12 (cols=12; row-resize disabled — sections are auto-height)
- [ ] **3c.3** Neighbour absorption rule when a section grows past the row's capacity
- [ ] **3c.4** Visual feedback — 12-col guideline overlay during resize, snap pills showing target colSpan
- [ ] **3c.5** Per-section `minColSpan`/`maxColSpan` from the registry enforced
- [ ] **3c.6** Tests

### Phase 3d — Keyboard + a11y (1 session)

- [ ] **3d.1** Every gesture reachable via Tab + Space + Arrow per the plan doc §7.8
- [ ] **3d.2** `@vue-dnd-kit/core`'s built-in keyboard nav already covers palette → canvas; verify + extend for cross-zone
- [ ] **3d.3** ARIA live region narrates drag start/end/reposition
- [ ] **3d.4** axe-core scan clean for the editor surface
- [ ] **3d.5** Tests with `@testing-library/vue` + axe assertion helper

### Phase 3e — Auto-form from Zod (1 session)

- [ ] **3e.1** Install `@formkit/vue` + `@formkit/zod` (or evaluate `shadcn-vue/auto-form` if FormKit feels heavy)
- [ ] **3e.2** 14 Zod kind → form-field mappings per docs/plans/layout-and-pages.md §7.10
- [ ] **3e.3** Custom pickers (content/hub/image/color) — wrap as FormKit input plugins
- [ ] **3e.4** Replace inspector's hardcoded form (3a.4) with the auto-form
- [ ] **3e.5** Tests for each Zod kind mapping

### Phase 3f — Inspector polish (1 session)

- [ ] **3f.1** Row config form (gap, align, background, paddingY)
- [ ] **3f.2** Per-section per-breakpoint colSpan slider (sm/md/lg overrides)
- [ ] **3f.3** Per-section visibility rules form (roles, features, hideAt)
- [ ] **3f.4** Duplicate section (clones config + appends to row)
- [ ] **3f.5** Delete section with confirm
- [ ] **3f.6** Tests

### Phase 3 wrap (1 session — split for safety)

- [ ] **3.wrap.1** Mobile editor adaptation (Phase 6a per the plan): bottom sheets for palette + inspector, long-press drag, FAB
- [ ] **3.wrap.2** E2E test of the full editor flow: create layout, drag 3 sections, resize, set page-meta, publish, verify on the live route
- [ ] **3.wrap.3** Session log + handoff for the next phase

---

## Risk register

| Risk | Mitigation |
|---|---|
| `grid-layout-plus` doesn't handle MULTI-ZONE layouts (it's a single grid per instance) | One `<GridLayout>` per zone; `@vue-dnd-kit/core` handles cross-zone drag separately. The grid-layout-plus instance per zone only knows about its own items. |
| `@vue-dnd-kit/core` API churn (newer library) | Pin exact version. Re-evaluate at every minor bump. |
| FormKit's plugin system may not match our custom-picker needs | If FormKit is too rigid, fall back to a hand-rolled `<AutoForm>` component (just a switch on Zod kind) — Phase 3e decision. |
| Touch interactions on tablet — grid-layout-plus uses pointer events; mobile editor in 6a needs verification | Spike before 6a; if broken, swap in `vue-draggable-plus` for the touch path. |
| Existing legacy admin homepage form (`/admin/homepage`) overlaps with new layout editor | Keep both. Auto-sync hook (D3) propagates legacy edits → layout. Eventually deprecate legacy form once layout editor is feature-complete. |
| `grid-layout-plus` uses `vue-grid-layout`'s CSS — may conflict with our existing `var(--*)` tokens | Scope it to a wrapper class (`.cpub-layout-editor`); audit + override any hardcoded styles. |
| Bundle-size creep — both libs add ~30-40KB combined | Acceptable for admin-only editor surface. Lazy-load behind the /admin/layouts route. |

---

## Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-05-27 | Adopt grid-layout-plus + @vue-dnd-kit/core; defer FormKit | Saves the hardest CSS/math work (grid drag/resize) + a11y-strong drag primitive without buying a full editor framework |
| 2026-05-27 | NOT adopting blökkli, GrapesJS, Reka.js, Webstudio | See agent research in [project-session-159-canary] memory + stage-e-unification plan. blökkli's tree-of-blocks model doesn't fit zone+12-col; others are React-only / abandoned / proprietary / wrong scope. |
| 2026-05-27 | One GridLayout per zone (full-width / main / sidebar) | Avoids fighting grid-layout-plus's single-grid model; @vue-dnd-kit/core spans the boundary |
| 2026-05-27 | Auto-save is debounced PUT, NOT live websocket | Simpler; conflict detection on 409 is enough for v1. WebSocket can come in Phase 10. |
| 2026-05-27 | Lazy-load editor bundle behind /admin/layouts route | Public homepage shouldn't pay the editor JS cost |

---

## What's already built (don't redo)

- `LayoutSlot` (renders zones from layout) — Phase 1c
- `useLayout(path)` composable — Phase 1c
- Section registry with `propMap` (Stage E) — Phase 1c+E
- Server CRUD: `saveLayout`, `publishLayout`, `revertToVersion`, `listLayoutVersions` — Phase 1
- Admin endpoints: `POST/GET/PUT/DELETE /api/admin/layouts*` — Phase 1c (session 158)
- `migrateHomepageSectionsToLayout` + auto-sync hook — Phase 1c + Stage D
- Catch-all custom-page route `pages/[...customPath].vue` — Phase 2
- Existing components mapped to 14 of 17 section types via Stage E — heading/paragraph/image/divider/gallery/video/embed/markdown via Block*View; hero/editorial/stats/hubs/contests/custom-html/content-feed via Homepage components
- Hero customization wiring (config.customTitle/Subtitle/eyebrow/ctas) — session 159 end

---

## Net delta when Phase 3 completes

- **Files added**: ~10-15 (editor pages, palette component, inspector, FormKit field components, Pinia undo store)
- **Files modified**: ~3-5 (LayoutSlot for editable mode, registry comment updates)
- **Sessions estimate**: 5-6 (vs 7 if building from scratch — saved by primitives)
- **Bundle delta**: ~80KB (grid-layout-plus ~25KB + @vue-dnd-kit/core ~20KB + FormKit core ~35KB), lazy-loaded behind /admin/layouts

---

## Linked artifacts

- `docs/plans/layout-and-pages.md` — original architectural design (1342 lines)
- `docs/plans/layout-engine-rollout.md` — overall rollout tracker (Stages A-D)
- `docs/plans/stage-e-unification.md` — section unification plan
- [[feedback-reuse-existing-components]] — the lesson that drove Stage E + the hybrid library choice
- [[feedback-no-coauthor]] — standing git rule
- [[feedback-pnpm-publish-layer]] — standing publish rule
- [[feedback-caret-semver-0x-minor-bump]] — standing version-bump rule
