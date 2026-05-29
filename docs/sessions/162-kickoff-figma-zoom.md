# Kickoff prompt — Figma-style viewport zoom controls

Paste everything between the `---` rules as the FIRST message of a fresh Claude Code session. **Self-contained — does NOT depend on Phase 3b.** Can run in parallel with or before Phase 3b at the user's choice.

---

Fresh Claude Code session on the CommonPub monorepo. **Task: Figma-style viewport zoom for the layout editor.**

**Predecessor**: session 162 closed every P2 from session 160's audit + ran TWO recursive audits + completed Path C (stale-docs sweep). Editor canvas no longer squishes (session 161 chrome collapse + session 162 banner improvements). **19 commits on `main`.** Layer 318 + schema 470 + server 1129+3skip + repo typecheck 26/26. heatsync + deveco UNTOUCHED on npm 0.24.0. Last commit `7b8f7c2`.

## Why this session

Session 161 shipped two ways to give the editor canvas more room: collapse the admin sidebar (`useAdminSidebar`) + collapse the editor palette/inspector (`useEditorChrome`). The remaining ask in the deferred queue is **viewport zoom** — for users who want FULL chrome (palette + inspector visible) but a zoomed view of a long layout. Figma + Webflow + Framer all ship this pattern. Estimated 1 session; self-contained (no library dependencies; pure CSS transform + math).

## Mandatory reads

1. **`CLAUDE.md`** — rules #2 (flag), #3 (`var(--*)`), #11 (test-driven), #12 (WCAG 2.1 AA), #15 (NO AI co-author)

2. **MEMORY.md priority memories**:
   - `feedback-visual-editor-ux-patterns` — cursor-as-contract for zoom hand/cursor; trackpad gestures; pinch-to-zoom
   - `feedback-match-established-pattern` — toolbar zoom controls should match the existing AdminLayoutsToolbar viewport segmented control's visual hierarchy
   - `feedback-vitest-import-meta-client-undefined` — composable browser guards
   - `feedback-vi-restoreallmocks-wipes-vifn-impls` — vi.fn mock preservation
   - `feedback-deploy-health-check-warn-not-fail` — curl /api/health after deploy
   - `project-session-161-sidebar` + `project-session-162` — the chrome-collapse precedent + the design system pattern

3. **Existing surfaces** to study before writing:
   - `layers/base/composables/useEditorChrome.ts` (~60 lines) — the cookie-persisted boolean state pattern. The new composable follows it.
   - `layers/base/composables/useAdminSidebar.ts` (~95 lines) — same pattern. Both pin: `useCookie` over `useState` + `localStorage` for SSR/CSR hydration consistency (no flash).
   - `layers/base/components/admin/layouts/AdminLayoutsToolbar.vue` — where zoom controls land. Has a viewport segmented control (mobile/tablet/desktop max-width sim); zoom is conceptually adjacent but different (transform scale vs container width).
   - `layers/base/components/admin/layouts/AdminLayoutsCanvas.vue` — applies transform; scrollable canvas pane lives here.
   - `packages/ui/theme/base.css` — for any new tokens (`--zoom-step`, `--zoom-min`, `--zoom-max`).

## Scope (5 sub-tasks)

- [ ] **Z.1 New composable `useEditorViewport`** — owns reactive zoom state. Matches `useEditorChrome` pattern (`useCookie` for persistence, cookie key `cpub-editor-zoom`, default `1.0`, range `[0.25, 2.0]`). API:
  ```ts
  const { zoom, zoomIn, zoomOut, setZoom, resetZoom, fitToWidth } = useEditorViewport()
  ```
  Hotkeys: Cmd+= (zoom in), Cmd+- (zoom out), Cmd+0 (reset), Shift+1 (fit to width — UX research synthesis; matches Figma).
- [ ] **Z.2 Canvas transform application** — `AdminLayoutsCanvas.vue` wraps its stage in a scrollable container; `transform: scale(var(--zoom-level))` with `transform-origin: top left`. Critically: the SCROLLABLE container's size remains in "real" pixels (`overflow: auto`); the canvas stage scales inside it. This is the trickiest math — Figma's `transform-origin: top left` + container-relative offset for zoom-to-cursor.
- [ ] **Z.3 Zoom-to-cursor** — when user wheel-zooms (Ctrl/Cmd + scroll OR pinch), zoom centers on the cursor position, not the top-left. Math:
  ```
  // Before: cursor at (cx, cy) in canvas-coords = (cx/oldZoom, cy/oldZoom) in stage-coords
  // After: keep stage-coords under cursor stable → adjust scrollLeft/scrollTop
  scrollLeft += (cx * (newZoom - oldZoom)) / oldZoom
  scrollTop  += (cy * (newZoom - oldZoom)) / oldZoom
  ```
  Snap zoom levels (0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0) — matches Figma's stepwise zoom (smoother than free-zoom but allows fine wheel control).
- [ ] **Z.4 Toolbar controls** — add zoom UI to `AdminLayoutsToolbar` MATCHING the existing viewport segmented control's visual hierarchy (per `feedback-match-established-pattern`). Three controls:
  - "−" button (`fa-solid fa-magnifying-glass-minus`)
  - Current zoom % readout (clickable → opens a dropdown of preset zooms 25 / 50 / 75 / 100 / 125 / 150 / 200 / Fit width)
  - "+" button (`fa-solid fa-magnifying-glass-plus`)

  Place adjacent to the viewport segmented control on the toolbar. Cursor `pointer` on buttons; aria-label on each.
- [ ] **Z.5 Tests + a11y**:
  - useEditorViewport composable: cookie persistence, zoomIn caps at max, zoomOut caps at min, reset returns 1.0, fitToWidth math correct for known canvas widths
  - Hotkey handlers attach + detach on mount/unmount (typeof window guard per `feedback-vitest-import-meta-client-undefined`)
  - aria-labels on toolbar buttons
  - Zoom level displayed in toolbar uses `aria-live="polite"` so screen readers announce changes on hotkey
  - `prefers-reduced-motion: reduce` → no transform transition (instant snap)

## Tricky bits

1. **Coordinate-system invariants under transform**: drag/drop libraries (when 3b ships) use viewport-space pointer events. Under `transform: scale`, the inner stage has DIFFERENT coordinates. Drag handlers need to divide by zoom level to compute stage-space coordinates. If 3b ships before this session, audit its handlers; if it ships after, write the math in a way that 3b can consume cleanly (consider `useEditorViewport` exposing `screenToStage(x, y)` helper).
2. **Trackpad pinch gestures**: on macOS, pinch fires `wheel` events with `ctrlKey: true` automatically. The handler checks for `ctrlKey || metaKey` + zoom math. Don't intercept regular wheel scroll (would break vertical canvas navigation).
3. **Cookie size**: zoom level is a small number; one cookie key `cpub-editor-zoom` stores a stringified float. Don't combine with `useEditorChrome`'s cookies (different lifecycle; user might want chrome state but reset zoom).

## a11y rules

- Keyboard-only access via Cmd+= / Cmd+- / Cmd+0 / Shift+1.
- All toolbar zoom buttons focusable, aria-labeled.
- Current zoom level: `aria-live="polite"` announces "Zoom 125%" on change.
- `prefers-reduced-motion: reduce` → instant zoom (no transition).
- Min 28×28 touch target on zoom buttons (per `feedback-visual-editor-ux-patterns` — WCAG AA's 24×24 is the floor, not the design target).
- Cursor: when over a zoom hotspot or during pinch, cursor stays `default` (no `cursor: grab` lies).

## Hard rules

- **No AI attribution** (CLAUDE.md #15)
- **0 npm publishes** — workspace-only on commonpub.io
- **heatsync + deveco UNTOUCHED** on dormant 0.24.0
- **var(--*) only** — new zoom tokens go in `packages/ui/theme/base.css` synced via `bundle-theme.mjs` if you add any
- **Pre-push hook runs typecheck** — vue-tsc strict catches what vitest's esbuild lets pass
- **NEVER trust `gh run list`** — curl /api/health after deploy
- **Match established patterns** — `useEditorChrome` + `useAdminSidebar` are the precedent; copy their cookie pattern verbatim
- **Verify load-bearing claims against source** — when documenting math or behavior, recompute against the actual code/CSS, not against expectations (session 162 audit-of-docs lesson)

## Self-audit after coding

R1-R4 lens. Likely findings:
- **R1**: cursor lies during zoom (cursor: zoom-in only when over canvas + Cmd held); hotkey conflicts with browser native zoom (browser will fight us — handle with preventDefault on captured wheel events with ctrlKey); FLIP animations from 3b/B (if shipped) interact with transform-scale.
- **R2**: zoom-to-cursor math edge cases at canvas boundaries (scroll into negative); SSR cookie-read race (matches `feedback-vitest-import-meta-client-undefined` if you guard browser code wrong); double-decrement on rapid keypress.
- **R3**: discoverability — does the user know the hotkeys? Tooltips on the toolbar buttons. mobile: pinch-to-zoom natively does its thing; don't try to capture.
- **R4**: transform performance at zoom < 0.5 with N=50+ sections (browser composite layer; should be GPU-accelerated; verify with DevTools paint flashing).

## First action

1. Confirm priority docs read (one paragraph max).
2. Read `useEditorChrome.ts` + `useAdminSidebar.ts` end-to-end — they're the pattern this session extends.
3. Sketch the `useEditorViewport` API + share with user before coding (one short message).
4. Ship 5 sub-tasks as atomic commits.
5. Self-audit + polish commit.
6. Update session log + write next-session handoff.

Don't accumulate debt. Phase 3b should NOT be touched in this session unless audit finds a coordinate-system bug that requires fixing in both surfaces.

---
