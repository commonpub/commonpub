# Session 160 — Audit ROUND 3 (operational / discoverability)

**Date**: 2026-05-28 (continuation between R2 and R4)
**Trigger**: user feedback "i dont see the ui in admin panel on commonpub.io for layouts" — empirical confirmation of what a parallel agent's audit had just independently surfaced.

R1 covered UX polish. R2 covered security/correctness. **R3 plumbed dimensions an operator actually touches**: discoverability from the admin sidebar, the relationship between legacy and new editors, server-side enforcement of `pageMeta.access`, mobile UX, audit log coverage on all destructive paths.

(This doc was written retroactively in R5 after the R4 doc noted it was missing. R3 fixes shipped in commit `a4135c5` 2026-05-28.)

## Process

Parallel agent ("discoverability + operator UX") audited the new operator surface against the user-experience-of-a-new-operator-setting-up-the-instance lens. While the agent was running the user reported the same #1 finding empirically, validating the audit direction.

## Findings + actions

### 🔴 #1 — `/admin/layouts` INVISIBLE in the admin sidebar (FIXED)

`layers/base/layouts/admin.vue:29-41` enumerated 12 sidebar links. **No link to `/admin/layouts`**. The whole Phase 3a feature was reachable only by URL-typing. Operator turns on `layoutEngine`, opens admin → sees no new nav item → believes nothing changed.

**Fix applied**: added a `<NuxtLink>` between Homepage and Navigation, `v-if="layoutEngine"` (CLAUDE.md rule #2 — gated on the flag so it stays invisible until the operator opts in). Icon: `fa-table-cells-large` (grid metaphor matches the 12-col canvas). Label: "Layouts" (matches the page H1).

Also destructured `layoutEngine` from `useFeatures()` in the script setup.

### 🔴 #2 — Misleading "Migrate homepage layout" CTA (FIXED)

The empty-state CTA on `/admin/layouts` (when no layouts exist yet) was a `<NuxtLink to="/admin/homepage">` — taking the operator to the LEGACY editor, not triggering migration. Operator clicked expecting migration, landed on a different editor, no signpost back.

**Fix applied**: replaced the NuxtLink with a `<button>` that fires `POST /api/admin/layouts/migrate-homepage` with loading state, toast feedback, and `refresh()` of the list. Secondary "Or edit the legacy homepage" link preserved for the case where there's no legacy data to migrate yet. Button copy: "Migrate homepage to layout" with `fa-house-circle-check` icon; switches to "Migrating…" with spinner during the request.

### 🔴 #3 — `frame` `<select>` was a UI lie (FIXED)

`AdminLayoutsInspectorPage.vue` had a full 6-option `<select>` for `pageMeta.frame` (narrow/wide/two-column/etc.) with hint text "Page chrome shape — drives the zones the layout exposes." The renderer at `pages/[...customPath].vue:27` had a comment explicitly noting "Phase 4 introduces page_meta.frame" — meaning the field had ZERO effect today. Admin sets it, saves, sees nothing change. First-trust-break pattern.

**Fix applied**: disabled the select (`disabled` attribute + `--disabled` modifier class), added a "Phase 4" badge next to the label, rewrote the hint to "Reserved for Phase 4. Currently has no effect; the renderer always exposes the same three zones (full-width, main, sidebar)." Honest UI > lying UI.

### 🟠 #4 — Server-side `pageMeta.access` enforcement gap (FIXED)

R2's P0 fix bifurcated the public layout endpoint's cache key 2-way (`admin:<path>` vs `public:<path>`) to prevent draft leak. R3 audit caught a deeper concern: `pageMeta.access === 'members'` and `access === 'admin'` layouts could still leak to lower tiers via direct `/api/layouts/by-route` hit — the catch-all page had a client-side check, but the API endpoint did NOT enforce the access field at all.

**Fix applied**: trifurcated cache key to 3 tiers (`admin:<path>` / `members:<path>` / `anon:<path>`). Added `accessOk` gate in the handler logic:
- `access === 'public'` → everyone OK
- `access === 'members'` → any authenticated user OK
- `access === 'admin'` → only admins OK

Combined with the existing draft-leak guard (`isAdmin || layout.state === 'published'`). Contract test updated to lock the 3-way split + the `pageMeta.access` read.

### 🟠 #5 — 5 missing audit logs (FIXED)

R2 added `cpub.audit.layout.delete` + `cpub.audit.layout.force-save` on the two highest-risk paths. R3 audit caught that 5 other destructive admin paths had no forensic trail:

- POST `/api/admin/layouts` (create new layout)
- POST `/api/admin/layouts/[id]/publish` (promote draft → live)
- POST `/api/admin/layouts/[id]/versions/[versionId]/revert` (overwrite current with prior snapshot)
- POST `/api/admin/layouts/migrate-homepage` (one-time destructive transformation)
- POST `/api/admin/layouts/seed-homepage` (initial bootstrap)

**Fix applied**: added `console.info('cpub.audit.layout.{action}', JSON.stringify({...}))` to each handler. All 7 destructive paths now stdout-greppable as `cpub.audit.layout.*`. Operators query container logs: `docker logs commonpub-app-1 | grep cpub.audit.layout`.

### 🟡 #6 — Mobile editor: palette stack order + no phone banner (FIXED)

At `<1024px` viewport the 3-column grid collapsed to a single column with palette FIRST in DOM order. Admin on a phone had to scroll past 17 section tiles before reaching the canvas. At `<640px` the editor was simply unusable (drag-drop on 375px is user-hostile per the plan §7.7) but no banner explained this.

**Fix applied**:
- Refactored to `grid-template-areas` for desktop layout (palette / canvas / inspector visual order preserved at ≥1024px while DOM order becomes canvas / palette / inspector)
- `@media (max-width: 1024px)` falls back to DOM-order single-column → admin sees canvas immediately
- `@media (max-width: 640px)` HIDES the editor body and shows a phone-only banner: "Use a larger screen — The layout editor needs a tablet or desktop viewport (640px or wider)." with link back to `/admin/layouts`

## Self-catches during R3 implementation

- `useToast` has no `.info()` method — only `success`, `error`, `show` (where `show` defaults to `'info'` type). Caught by vue-tsc on first save.
- After R3 fixes my own pass found unused imports (`LayoutRecord`, `watch`) in `AdminLayoutsToolbar.vue` from the R1 work — folded into the same commit.

## Findings DOCUMENTED but not fixed in R3

These were noted in the agent output and queued, not addressed in `a4135c5`:

- Dashboard `Quick Actions` tile for `/admin/layouts` (R3 audit noted it's silent about the headline feature; deferred — feature, not bug)
- `validateSectionConfigs.ts` dormant code — decision to KEEP (with the proper-fix path in R2 doc)
- Bundle size — agent measured 18.2 KB raw / 6 KB gzipped for editor JS; under all thresholds
- Operator runbook for `layoutEngine` setup (`docs/guides/operator-layout-engine.md` doesn't exist) — gap captured in R4 + R5 docs

## Files changed (commit a4135c5)

- `layers/base/layouts/admin.vue` — `/admin/layouts` sidebar link
- `layers/base/pages/admin/layouts/index.vue` — migrate CTA + empty state CSS
- `layers/base/components/admin/layouts/AdminLayoutsInspectorPage.vue` — frame disabled + Phase 4 badge
- `layers/base/server/api/layouts/by-route.get.ts` — 3-way tier bifurcation + access gate
- `layers/base/server/api/layouts/__tests__/by-route-draft-leak.test.ts` — extended contract test
- `layers/base/server/api/admin/layouts/index.post.ts` — `cpub.audit.layout.create` log
- `layers/base/server/api/admin/layouts/[id]/publish.post.ts` — `cpub.audit.layout.publish` log
- `layers/base/server/api/admin/layouts/[id]/versions/[versionId]/revert.post.ts` — `cpub.audit.layout.revert` log
- `layers/base/server/api/admin/layouts/migrate-homepage.post.ts` — `cpub.audit.layout.migrate-homepage` log
- `layers/base/server/api/admin/layouts/seed-homepage.post.ts` — `cpub.audit.layout.seed-homepage` log
- `layers/base/pages/admin/layouts/[id].vue` — mobile grid order + phone banner
- `layers/base/components/admin/layouts/AdminLayoutsToolbar.vue` — unused-imports cleanup
- `docs/sessions/161-handoff-prompt.md` — picks Path A or Path B

## Tests + types after R3

Layer **262** (no new tests in R3 — content was contract + UI fixes; existing contract tests held). Typecheck 26/26 fresh.

## Linked artifacts

- `docs/sessions/160-audit-godmode.md` — R1 (UX)
- `docs/sessions/160-audit-round2-deep.md` — R2 (security/correctness)
- This doc — R3 (operational)
- `docs/sessions/160-audit-round4-deep.md` — R4 (DB/perf/edge cases)
- Commit `a4135c5` — the R3 fixes
