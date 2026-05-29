# Session 168 — layout-engine foundational audit + consolidation (Stage 1) + explore UI fix

**Date**: 2026-05-29
**Branch**: `main` (workspace-only; 0 npm publishes)
**Sites**: commonpub.io (workspace main) ONLY — heatsync + deveco UNTOUCHED on dormant 0.24.0
**Layer tests**: 658 → **664** (+6)
**Typecheck**: 12/12 (vue-tsc strict)
**Commits**: `8216345` (explore grids) · `30045e5` (PageFrame) · `b627ead` (custom-page adoption)

## Foundational audit (the "is this the right approach" review)

A bottom-to-top audit of the layout engine / custom pages / thin-app model (4 parallel Explore agents + direct source verification) found three real architectural problems — two verified against source:

1. **WYSIWYG broken — FOUR divergent "page frames."** Frame arrangement+sizing is hand-duplicated per page. Homepage `.cpub-main-layout` = 1280px / `1fr 300px` (`index.vue:681-689`, shared by all 3 homepage branches). Custom-page `.cpub-custom-page-grid` = `minmax(0,1fr) 320px`, `max-width: var(--container-wide,1280px)` — **320 vs 300, and `--container-wide` was undefined → silent fallback** (`[...customPath].vue`). Editor canvas stacks zones in bordered boxes with **no main+sidebar grid at all** (`AdminLayoutsCanvas.vue`) → the editor preview is structurally wrong vs the live homepage. `LayoutSlot.vue:4-16` confirms "the page is the FRAME" — the duplication was by design.

2. **Component-shadowing bypass.** Registry builtins use explicit relative imports → resolve to the **layer's** component. A thin app (deveco/heatsync) that customizes by shadowing a homepage component gets it on the legacy/file-route path (auto-import) but **silently loses it under the layout engine**.

3. **Three coexisting homepage models** (hardcoded `.vue` shadow / legacy `homepage.sections` / layout engine) with a bidirectional-sync seam — conceptual debt (Stage 3 ADR; not code this pass).

Strategic read: the engine is well-built internally but is a large (~12k LOC) bet on **non-technical operators**, while today's operators (deveco/heatsync) are **developer-operators who customize via code/shadowing** — which the engine partly fights (#2). Verdict: consolidate the foundation (de-risk #1/#2) before more editor features. User approved "consolidation pass first."

## Explore UI fix (user-reported) — `8216345`

commonpub's `/explore` used **fixed** `repeat(3,1fr)` content/path grids + `repeat(2,1fr)` hub/people grids → the 2-col hub/people grid rendered ~470px "large cards"; nothing adapted to the container. `feed.vue` already used `repeat(auto-fill, minmax(280px,1fr))` (the deveco/heatsync-correct pattern); explore never got it. Brought explore in line: content/path → `auto-fill minmax(280px,1fr)`, hub/people → `auto-fill minmax(300px,1fr)`, ≤768 → `minmax(240px,1fr)`, ≤480 → `1fr`. Container stays 960px (matches feed). CSS-only. **Eyeball on next commonpub.io deploy** (jsdom can't verify cascade).

## Consolidation Stage 1 (shipped)

### `30045e5` — shared `<PageFrame>` (1A)
`layers/base/components/PageFrame.vue` — the ONE canonical frame. Slot API (`#full-width`/`#main`/`#sidebar`) so callers keep bespoke zone content (homepage's mobile-hoist/powered-badge); renders each region only when its slot has content. Uniquely-named `cpub-page-frame-*` classes (per `feedback-view-identity-classes`); tokenized `--cpub-frame-max: 80rem` / `--cpub-frame-sidebar: 320px`; `editable` flag forwarded to zone scoped-slots for the Stage-2 editor adoption. 6 slot-gating tests.

### `b627ead` — custom-page adopts PageFrame (1B)
`[...customPath].vue` now renders via `<PageFrame>` + zone slots; removed the dead `.cpub-custom-page*` CSS + the dangling `--container-wide`. Reference adoption, lowest-risk public surface.

### 1C — component-shadowing fix: INVESTIGATED + REVERTED (deliberately not shipped)
Built `componentName?: string` on `SectionDefinition` + a `resolveComponent(def.componentName)`-with-fallback in `LayoutSection` + populated all 17 builtins. Then **verified the load-bearing assumption and it failed**:

- Nuxt component auto-import is a **build-time template transform that only handles STATIC string literals** (confirmed vs `edit.vue:133` which uses `resolveComponent('EditorsArticleEditor')` literals). My call passes a **variable** (`def.componentName`) → Nuxt can't statically transform it → falls to runtime resolution, which Nuxt doesn't back for auto-imports → returns the string → **always falls back to the explicit import (shadow fix never fires)** AND emits `[Vue warn] Failed to resolve component` for every section in tests.

Shipping that = a broken-but-passing mechanism + test noise. **Reverted fully** (tree clean; `LayoutSection`/`sections.ts`/builtins back to baseline). The bypass is real but needs a verified approach (literal-keyed resolver map or a Nuxt plugin that registers section components shadow-aware) and can only be truly verified **with a thin app** (deveco/heatsync, not in this repo). New memory: [[feedback-nuxt-resolvecomponent-static-only]].

**Verified auto-import name mapping** (derived from `apps/shell/.nuxt/components.d.ts` — the pathPrefix dedupe is non-obvious, e.g. `blocks/BlockHeadingView.vue` → `BlocksBlockHeadingView`), preserved for the future fix in `168-kickoff-next.md`.

## Stage 2 — editor canvas SHIPPED (continued session); homepage dedup remains

**Shipped** (`816c6fd` + `ba01ab4`):
- **PageFrame audit + homepage alignment** — fixed a slot-staleness bug (`computed` over `useSlots()` → `$slots` in template) and aligned the `--cpub-frame-*` tokens to the LIVE homepage's exact `.cpub-main-layout` values (max 1280, sidebar **300** [was 320], gap 32, pad 28/32/48, collapse 1024). PageFrame is now a faithful homepage replica, so the editor previewing the homepage layout through it is WYSIWYG-correct. (Custom-page, already on PageFrame, inherits the canonical frame.)
- **Editor canvas → PageFrame** — the canvas previewed zones as stacked equal-width labeled boxes (NOT the production main+sidebar split). It now renders through `<PageFrame>` via dynamic slots (`#[zoneSlug]`), keeping per-zone label + add-row chrome; the `<LayoutSlot>` section DOM is UNCHANGED so drag/resize bindings are unaffected. 5 tests lock the zone→region mapping.

**Verified** (jsdom): zone→region mapping, PageFrame slot logic, compilation/typecheck. **NOT verified (deploy smoke needed):** the actual side-by-side visual split + cross-zone drag feel.

**Known limitation** (documented, not a regression): the viewport toggle (375/768/100%) shrinks the *stage*, but PageFrame's collapse uses `@media (max-width:1024px)` = **viewport**-based, so "tablet"/"mobile" sim won't collapse the sidebar (it still sees the desktop viewport). Desktop preview is accurate (the old canvas never showed the split at all). True breakpoint sim needs CSS container queries (`@container`) — a future enhancement; not done blind here because it'd also change the public custom-page surface.

**Remaining Stage 2 (browser-gated):** migrate the live `index.vue` homepage (all 3 branches **together**, to avoid orphaning the shared `.cpub-main-layout` scoped rule) to `<PageFrame>`. This is now a **code-dedup cleanup**, not a WYSIWYG prerequisite — the editor already faithfully replicates the homepage's values via PageFrame. Still needs a real-browser smoke on a commonpub.io build (touching live public legacy markup). Steps in `168-kickoff-next.md`.

## Stage 3 (deferred — decision/doc)
ADR: *code-override for devs* + *layout engine for operators*; deprecate legacy `homepage.sections` once the engine is proven; remove the bidirectional-sync seam.

## Hard rules honored
0 npm publishes · heatsync/deveco untouched · `var(--*)` only · vue-tsc strict 12/12 · no AI attribution · **verified load-bearing claims against source** (caught the resolveComponent build-transform issue before shipping a broken mechanism — same discipline that caught the FormKit pivot in session 167).

## Files
- `layers/base/pages/explore.vue` (grids)
- NEW `layers/base/components/PageFrame.vue` (+ test)
- `layers/base/pages/[...customPath].vue` (PageFrame adoption)
- (1C reverted: `LayoutSection.vue`, `packages/ui/src/sections.ts`, `sections/builtin/*` unchanged from baseline)
