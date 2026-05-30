# Resume prompt — CommonPub (after session 169)

Paste everything between the `---` rules as the FIRST message when you come back
to CommonPub. Session 169 left the project in a **clean, published, all-deployed
state** — there is no broken or half-finished work waiting; pick up any item
below when you're ready.

---

Fresh Claude Code session on the CommonPub monorepo
(`/Users/obsidian/Projects/ossuary-projects/commonpub`). commonpub.io builds
from workspace `main`; deveco.io + heatsynclabs.io are thin npm consumers.
**No AI attribution in commits. pnpm (never npm) for publishing.**

## What landed in session 169 (all SHIPPED + verified)

1. **Deployed sessions 163–168 to commonpub.io** — the whole Phase 3a/3c layout
   editor + LayoutRow/Section extraction + sidebar collapse + PageFrame
   consolidation went live (prod had been on session-162 code).
2. **Fixed a live homepage P0** (`9bf961a`): the layout-engine canary 500'd with
   "DnD provider not found" — `LayoutSection`/`LayoutRow` called dnd-kit
   `makeDraggable`/`makeDroppable` (which `inject()` a provider) on the
   provider-less public path. Now guarded behind `editable`; regression guards
   in the tests.
3. **Hardened the deploy smoke** (`2a13cf0`): `scripts/smoke.mjs` runs
   in-container, checks `/` (not just `/api/health`), hard-fails on non-2xx.
4. **Cruft audit + fixes**: tokenized 2 modal backdrops (`var(--color-surface-overlay)`);
   reported a dead export (`findZoneOfRow`) + a sub-12px font-token gap (unfixed,
   P3).
5. **Doc sweep**: layout engine added to `docs/llm/facts.md` + `gotchas.md` +
   `codebase-analysis/*`; both READMEs + plan docs corrected (verified counts:
   **90 pages / 132 components / 33 composables / ~300 routes**).
6. **Published `@commonpub/layer@0.25.0`** to npm (only the layer changed since
   0.24.0). Bumped `tools/create-commonpub/src/template.rs` pins to current.
7. **Updated deveco.io** to `@commonpub/layer@^0.25.0` (deployed + verified).

## Verify the state

```bash
for u in https://commonpub.io https://deveco.io https://heatsynclabs.io; do echo "  $u home=$(curl -s -o /dev/null -w '%{http_code}' $u/) health=$(curl -s -o /dev/null -w '%{http_code}' $u/api/health)"; done
npm view @commonpub/layer version            # expect 0.25.0
gh run list --workflow=deploy.yml -L 1        # last commonpub deploy GREEN
pnpm --filter @commonpub/layer test 2>&1 | grep Tests | tail -1   # 670 passed
SMOKE_BASE=https://commonpub.io node scripts/smoke.mjs            # ✅ / -> 200
```

## Feature / layout-engine status (for context)

- **`layoutEngine` flag**: default OFF; **ON live on commonpub.io** via runtime
  override (homepage canary via `<LayoutSlot>`). deveco + heatsync keep it OFF
  (legacy renderer) — so they never exercise the editor/dnd path. 18 top-level
  flags + 5 nested `identity.*`. 6 migrations (latest `0005` = layout tables).
- **Layout editor**: Phase 3a (shell) + 3b (drag-drop) + 3c (resize) + 3d (a11y)
  + 3e (auto-form, session-1) LIVE. Pending: 3e remainder + 3f. See
  `docs/plans/phase-3-editor.md` (status banner at top; checkboxes lag).

## Resumable work (pick any — none are blocking)

- **heatsync update (1 small task)**: `heatsynclabs.io` was NOT bumped (its repo
  `virgilvox/heatsync-org` is a separate owner, not cloned locally). To update:
  clone it, set `@commonpub/layer` to `^0.25.0` in package.json, `pnpm install`
  (regen lockfile — watch [[feedback-pnpm-install-drops-files]]), push, then
  `curl https://heatsynclabs.io/` to confirm 200. It's running 0.24.0 happily;
  no urgency (layoutEngine off → no new surface).
- **Part A** — migrate the homepage `index.vue` to `<PageFrame>` (the last frame
  duplicate). **Browser-gated** — migrate all three render branches together
  (shared `.cpub-main-layout`), update `apps/reference/e2e/responsive.spec.ts`,
  real-browser smoke at ≥1025/768–1024/≤640. Lower risk now (canary proven).
- **Part B** — component-shadowing literal-keyed resolver (thin-app-gated). Name
  table in `docs/sessions/168-kickoff-next.md`.
- **Part C** — Phase 3e remainder (mobile colSpan slider → `responsive` field,
  not base; rich-field pickers; config-edit undo) + 3f inspector polish. R3-12
  snap-line math needs runtime gap measurement (NOT a pure function — see 169
  doc). All want a browser for the interactive bits.
- **Verify `tools/create-commonpub`**: `cargo build` + `cargo test` after the
  template.rs pin bump (constants were 3 publishes stale; now current).
- **Cleanup nits** (from the 169 audit): delete dead `findZoneOfRow`
  (`useLayoutHistory.ts:187`); decide on a `--text-2xs` token for the ~9 sub-12px
  editor labels.

## Conventions reminder
- Publish ONLY via `pnpm publish:layer` / `pnpm publish:all` (npm publish ships
  `workspace:*` literals → breaks consumers). Verify npm propagation before
  bumping a dependant. `^0.x` caret does NOT cross minors — bump dependant pins
  by hand. Always `curl /` after a deploy (health 200 ≠ site works).

---
