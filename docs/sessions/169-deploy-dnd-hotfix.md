# Session 169 — deploy sessions 163–168 to commonpub.io + live P0 hotfix

**Date:** 2026-05-29
**Scope:** commonpub.io workspace-`main` ONLY. heatsync + deveco UNTOUCHED on dormant npm `0.24.0`. No npm publish. No AI attribution.
**Deployed SHA:** `9bf961a` (live on commonpub.io, verified).

## Headline

The user asked to "deploy commonpub.io with latest so I can test if it's safe."
It was **NOT** safe as-is — deploying sessions 163–168 took the **homepage down
with a 500** the moment it went live. Found, root-caused, fixed, and verified
safe in-session. The consolidation is now live and healthy.

## What was done

1. **Verified session 168 shipped** (PageFrame adopted by custom-page + editor
   canvas, full-bleed, explore grids fixed, 669 tests, typecheck 26/26).
2. **Discovered prod was 70 commits behind**: production last deployed a
   session-**162** commit. All of sessions 163–168 (LayoutRow/Section
   extraction, Phase 3a/3c editor, sidebar collapse, PageFrame consolidation)
   were unpushed. The "deploy" was really shipping that whole delta for the
   first time. Layer-only diff, **no new DB migrations** (0005 already on both
   sides), 670 tests + typecheck green.
3. **Deployed** (`git push` → `deploy.yml`). Two notes:
   - Both initial deploy attempts hit a **transient `ssh: handshake failed:
     connection reset by peer`** at the "Load image and restart" step —
     recovered via `gh run rerun --failed` (the pattern from session 142).
     The handshake fails *before* the script runs, so prod is untouched on a
     transient — safe failure mode.
   - The first successful load put 163–168 live → **homepage 500**.

## The P0 — "DnD provider not found" (FIXED in `9bf961a`)

**Symptom:** `GET /` → 500 `{"message":"DnD provider not found"}`, while
`/api/health` stayed 200 — so `deploy.yml`'s smoke (health-only) reported
success. Classic [[feedback-deploy-health-check-warn-not-fail]]: health 200 ≠
site works.

**Root cause:** commonpub.io runs the **layout-engine homepage canary**
(session 159 — the homepage renders through `LayoutSlot → LayoutRow →
LayoutSection`). In the 70-commit delta, **session 163 wired `@vue-dnd-kit/core`
into LayoutRow/LayoutSection** (`makeDroppable`/`makeDraggable`). Those
composables call `inject('VueDnDKitProvider')` at setup and **throw "DnD
provider not found" when there is no `<DnDProvider>` ancestor** — and
`disabled: true` does **NOT** suppress the inject (verified against
@vue-dnd-kit/core 2.4.6: `j=()=>{const e=inject(Z); if(!e) throw …}`). The
editor wraps everything in `<DnDProvider>` (`admin/layouts/[id].vue`); the
**public** homepage canary has no provider → every SSR render of the homepage
crashed.

**Why it slipped through:** (a) sessions 163–168 were developed on
workspace-`main` but **never deployed** — the canary + dnd-kit combination
never ran in production until this session; (b) **every unit test
`vi.mock`-ed the entire `@vue-dnd-kit/core` module** with a fake
`makeDraggable`/`makeDroppable` that never injects, so the real provider path
was never exercised. Textbook [[feedback-integration-test-full-output-path]].

**Fix (`9bf961a`):** instantiate the drag/drop machinery **only in editable
mode** (which always renders inside the editor's `<DnDProvider>`). `editable`
is static for an instance's lifetime, so the conditional composable call is
safe under Vue's setup-once model. Public instances use inert `ComputedRef`
fallbacks (`computed(() => undefined/false)`) — equivalent to the pre-session-163
public render that had no dnd-kit at all. Editor path is byte-identical.
- `LayoutSection.vue` — `makeDraggable` guarded behind `if (props.editable)`.
- `LayoutRow.vue` — `makeDroppable` guarded behind `if (props.editable)`.
- **Regression guards:** the two tests that asserted the *buggy* contract
  ("public path STILL registers makeDroppable but disabled=true") are rewritten
  to assert `makeDraggable`/`makeDroppable` are **NOT** called on the public
  path (`not.toHaveBeenCalled()`). 670 tests + vue-tsc 26/26 green.

## Verification (real-browser smoke, live commonpub.io)

Drove headless chromium at 1280 / 900 / 390px against `/` and `/explore`:
- **Homepage 200** all breakpoints. Desktop 2-col grid `868px 300px`, sidebar
  visible, hero full-bleed (`heroW≈docW`). Collapses to 1-col at ≤1024 (tablet
  `820px`, mobile `342px`). No horizontal scroll.
- **/explore 200** all breakpoints; responsive auto-fill grid (3/2/1 cols). No
  horizontal scroll. The explore-grid fix from 168 is working live.
- All three sites healthy: commonpub.io / deveco.io / heatsynclabs.io home=200
  health=200 (deveco + heatsync still on dormant npm 0.24.0, untouched).

## Known issue (pre-existing, NOT this session) — homepage hydration mismatch

Smoke logged `Hydration completed but contains mismatches` on every page. This
is **pre-existing** homepage-template SSR/client divergence, unrelated to the
dnd fix:
- `index.vue` contest sidebar renders `Math.ceil((endDate - Date.now())/…)`
  ("Xd left") — server time ≠ client time.
- `activeTab = ref(authUser.value ? 'foryou' : 'latest')` — auth state differs
  SSR vs client.
The page works (200, renders, Vue patches client-side). Candidate cleanup for a
future session: hydration-safe the date math (`<ClientOnly>` or compute the day
count from a server-stamped value) + the auth-dependent default tab.

## NOT done this session (deploy crisis consumed it)

- **Part A** (homepage `index.vue` → `<PageFrame>`) — the last frame duplicate.
  Still pending. Browser-gated; needs a locally-runnable app to smoke before
  merge (or accept a deploy-then-smoke on the now-de-risked canary).
- **Part B** (component-shadowing literal-keyed resolver). Thin-app-gated.
- **Part C** (Phase 3e editor polish: 3e.4 mobile colSpan slider, 3e.5 R3-10
  resize-handle `role="separator"`, R3-12 snap-line gap math, rich fields,
  config-edit undo). Browser-free / unit-testable / dormant surface. The
  prep is done (see below) — this is the cleanest next-session pickup.

### Part C prep notes (for next session)
- **3e.5 R3-10**: resize handle is a `<button>` in `LayoutSection.vue` (~line
  525). WAI-ARIA window-splitter target: `role="separator"` +
  `aria-orientation="vertical"` + `aria-valuemin/now/max` (= sectionMin /
  colSpan / sectionMax) + direct Arrow-key resize routed through
  `useLayoutResize.applyKeyboardResize`. Extend `editor-axe.test.ts`.
- **3e.5 R3-12**: snap-line overlay in `LayoutRow.vue` (~line 640) currently
  uses `left: (col/12)*100%` — ignores the grid gap, so lines drift from real
  column boundaries. Correct offset (px) for the right edge of column `col`:
  `colW = (rowWidth − 11*gap) / 12; offset = col*colW + (col−1)*gap`. NOTE the
  168-kickoff sketch `(col/12)*(W−11g)+col*g` **overshoots** (gives `W+g` at
  col=12) — derive + unit-test the endpoints (col=12 → rowWidth; col=1 → colW;
  gap=0 → (col/12)*W) instead of transcribing it.
- **3e.4**: `applyKeyboardResize` does ±1; a slider needs an absolute target —
  either loop ±1 or add an `applyResizeTo(target)` that reuses `clampResize` +
  records ONE command. "Mobile" colSpan = the `responsive` field, not base
  `colSpan` (see the per-breakpoint note in `useLayoutResize.ts`).

## Deploy mechanics reference
- `deploy.yml` triggers on push to `main`. Build Docker → scp tarball → ssh
  `docker load` + `up -d --force-recreate` → `db-migrate.mjs` → health smoke.
- **Health smoke is `curl … || ::warning`** (warns, never fails) and checks
  **only `/api/health`** — a crashing public page reads as deploy "success".
  ALWAYS curl `/` (and browser-smoke) after a deploy, never trust the run
  status. The old image is `prune`d on the droplet post-load, so rollback =
  full rebuild of a prior SHA, not an image swap — fix-forward is usually
  faster.
- Transient `ssh handshake failed` at "Load image and restart" → rerun the
  failed job; prod is untouched because the failure precedes the script.

## Next steps
1. Pick up **Part C** (browser-free, prepped above) — safest next code work.
2. **Part A** when an app can be run in a browser (now lower-risk: the canary
   is proven, so it's a pure code-dedup).
3. Optionally hydration-safe the homepage date/auth rendering (known issue).
