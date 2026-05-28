# Session 160 — Audit ROUND 4 (DB + perf + edge cases + multi-path)

**Date**: 2026-05-28 (continuation)
**Trigger**: post-R3, user said "ultrathink audit + continue, you pick". This round plumbed DB/perf, edge cases under failure, federation interaction, multi-path operator endpoints, session handling.

## Findings + actions

Six fixes applied this round (4 of them were P0 or P1 from the audit agent's ranking).

### 🔴 P0 — `assembleLayout` full table scan (FIXED)

`packages/server/src/layout/layout.ts:213-219` was running `SELECT * FROM layout_sections` with NO WHERE clause on every layout fetch — then filtering in JavaScript. The `idx_layout_sections_row` index was unused because the query didn't reference `row_id`. By-route hot path × N total sections across the instance.

**Fix**: `where(inArray(layoutSections.rowId, sectionRowIds))`. Single-line drizzle change. The index is now hit. Index-range lookup instead of full scan.

**Verification**: 1125 server tests still pass (existing assembleLayout coverage exercises the path).

### 🔴 P0 — legacy `/admin/homepage` silently overwrites layout-engine edits (FIXED)

`layers/base/server/api/admin/homepage/sections.put.ts:68-83` auto-sync ran `migrateHomepageSectionsToLayout(... force: true)` on every legacy save when `layoutEngine` was on. `force: true` deletes the layout row (cascading rows + sections + **versions**), then recreates from the legacy JSON. Bespoke editor edits + entire publish history destroyed silently.

**Fix**: changed `force: true` → `force: false`. Auto-sync becomes non-destructive: creates the layout the FIRST time, never overwrites. Operators who adopt the new editor get their bespoke work preserved.

**Plus**: deprecation banner added to `/admin/homepage` when `layoutEngine` is on. Reads "This is the legacy homepage editor. The Layout Engine is active on this instance — use the new visual editor for live changes." + link to `/admin/layouts`. Non-blocking; the legacy editor still works for backward-compat.

### 🟠 P1 — `beforeunload` + `onBeforeRouteLeave` guards (FIXED)

`pages/admin/layouts/[id].vue` had no navigation guard. User edits → 1500ms debounce window → user clicks sidebar nav → silent data loss. The visibility-change flush (R2) only fires on tab-hidden events, NOT in-app navigation.

**Fix**: two guards added.
1. `onBeforeRouteLeave` — fires on Nuxt navigation; `confirm()`s if dirty.
2. `beforeunload` listener — sets `preventDefault()` if dirty; modern browsers show their generic "unsaved changes" prompt.

Both cleaned up properly in `onBeforeUnmount`.

### 🟠 P1 — unbounded cache memory (FIXED)

`layers/base/server/utils/layoutCache.ts` was a plain `Map` with no eviction. R3's 3-tier key bifurcation tripled the surface. An adversarial client hitting random paths could grow memory without bound.

**Fix**: bounded LRU with `MAX_CACHE_ENTRIES = 1000` cap. Map insertion-order semantics make LRU-on-set trivial: delete+reinsert touches an entry to the "newest" end; eviction iterates from oldest. `getLayoutCacheEntry` also touches LRU order so recently-read entries survive longer. 2 new tests cover cap + LRU touch behavior.

Memory cap ≈ 512 KB per pod (1000 entries × ~512 bytes each).

### 🟠 P1 — homepage DELETE no special-case warning (FIXED)

`[id].delete.ts` treated `('route', '/')` like any other layout. Direct API call could destroy the homepage's entire publish history with no confirmation.

**Fix**: server refuses to delete homepage layout unless `X-Cpub-Confirm-Homepage-Delete: 1` header is set. Returns 409 with `code: 'HOMEPAGE_DELETE_NEEDS_CONFIRM'`. The list-page UI sets this header after a SECOND confirm() (operator sees two prompts in a row, intentional).

### 🟡 P2 — `discard()` function exists but no UI control (FIXED)

`useLayoutEditor.discard()` was implemented + tested but no UI wired it. Admin's only revert path was page refresh (loses everything not auto-saved yet).

**Fix**: added `Discard` button to `AdminLayoutsToolbar` (DOM order: Discard, Save, Publish). Enabled only when dirty. Editor page wires `@discard` → `onDiscard` → confirm prompt → `editor.discard()` → toast. Updated Toolbar tests to account for the 3rd button.

## Findings DEFERRED (in queue for next session)

### 🟠 P1 — server PUT doesn't validate section configs (still deferred)

The R2-deferred P1. `validateSectionConfigs.ts` is dormant + tested but un-wired because the registry import pulls `.vue` components. Proper fix: schema-package refactor (move section Zod schemas to `@commonpub/schema`). 1-session effort.

### 🟡 P1 — `migrate-homepage` with `force: true` still destroys versions

`packages/server/src/layout/migrate-homepage.ts:292-295` — when an admin EXPLICITLY uses the migrate-homepage CTA with force, the layout row is deleted-and-recreated, cascading versions. After R4's auto-sync fix, this is the only remaining destructive path. Fix path: rewrite force-branch to use `saveLayout(... { id: existing.id })` instead of delete + create. 30-min refactor.

### 🟡 P2 — `listLayouts` is N+1 (admin list page)

`packages/server/src/layout/layout.ts:202`. `Promise.all(rows.map(assembleLayout))` runs 1 + 1 query per layout. For instances with many layouts the list page degrades. Fix: batch all rows + sections via two queries with `inArray`. Not user-traffic-hot but ugly.

### 🟡 P2 — partial publish-chain failure UX

`useLayoutEditor.publish()` chains save → POST /publish → refresh. If step 2 fails after step 1 succeeded, user sees "Publish failed" with no indication that their changes were saved-as-draft. Fix: separate try/catch around each step + nuanced toasts.

### 🟡 P2 — no `AbortController` on save fetch

Ghost-save path: user clicks Save, slow network, immediately navigates away, the orphan PUT lands after unmount. Could cause stale 409 if user opens the editor again in another tab before the orphan commits. Fix: store an AbortController in the editor composable, abort on unmount. Trade-off: kills the orphan PUT — but the visibility-flush already covers the "save on tab close" path.

### 🟢 P3 — trivia
- `idx_layouts_scope` is redundant with the UNIQUE constraint — drop in next migration
- Layouts-being-local-only is implicit, not documented alongside CLAUDE.md federation rules
- Multi-pod cache divergence (60s publish-propagation window) not in rollout tracker
- saveLayout tx doesn't `FOR UPDATE` lock — harmless under last-write-wins

## Verified SAFE (no action)

- Foreign-key indexes on all join columns
- Cascade rules correct (DELETE layouts → cascades)
- Transaction isolation works under concurrent saves (FK lock serializes)
- Federation: layouts are local-only (zero refs in protocol package)
- Better Auth session validation chain (DB-checked every request, role refreshed)
- 409 mid-publish-chain aborts cleanly
- Cross-admin delete-while-editing produces clear error
- Editor bundle 6KB gz JS + 10KB gz CSS — comfortably under limits
- R2 cache invalidation contract still locked across all 7 writers

## Tests + types

Layer **264** (+2 LRU eviction tests). Server unchanged (1125). Typecheck **26/26** fresh.

## Files changed

| File | Change |
|---|---|
| `packages/server/src/layout/layout.ts` | inArray WHERE on assembleLayout (P0 perf) |
| `layers/base/server/api/admin/homepage/sections.put.ts` | force: true → false (P0 data loss) |
| `layers/base/pages/admin/homepage.vue` | deprecation banner when layoutEngine on |
| `layers/base/pages/admin/layouts/[id].vue` | beforeunload + onBeforeRouteLeave guards + Discard handler |
| `layers/base/server/utils/layoutCache.ts` | bounded LRU (1000 cap) |
| `layers/base/server/utils/__tests__/layoutCache.test.ts` | 2 LRU tests |
| `layers/base/server/api/admin/layouts/[id].delete.ts` | homepage scope requires confirm header |
| `layers/base/pages/admin/layouts/index.vue` | sends X-Cpub-Confirm-Homepage-Delete after extra confirm |
| `layers/base/components/admin/layouts/AdminLayoutsToolbar.vue` | Discard button + emit |
| `layers/base/components/admin/layouts/__tests__/AdminLayoutsToolbar.test.ts` | btns[2] for Publish (Discard added) |

## Linked artifacts

- `docs/sessions/160-audit-godmode.md` — R1 (UX polish)
- `docs/sessions/160-audit-round2-deep.md` — R2 (security/correctness)
- (R3 fixes captured in commit messages — no separate doc; R3 was the user-direct fix for the invisible sidebar)
- This doc — R4 (DB/perf/edge cases)
- `docs/sessions/161-handoff-prompt.md` — handoff for session 161
