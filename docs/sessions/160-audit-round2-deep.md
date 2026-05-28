# Session 160 — God-mode audit ROUND 2 (security + correctness deep-dive)

**Date**: 2026-05-28 (continuation)
**Trigger**: post-round-1 (UX polish + cruft), user asked for "go deeper". This round plumbed dimensions Round 1 didn't touch: **security, race conditions, architectural correctness**.

## Process

Two parallel agents launched, each going deep:

1. **Security audit agent** — auth on every endpoint, XSS vectors, CSRF, IDOR, input validation depth, path traversal, the If-Match header itself, audit logging, rate limiting, SSRF in ogImage, public-page SSR of pageMeta.

2. **Race conditions + correctness audit agent** — save re-entry, discard-timer race, visibility-flush race, force-save If-Match correctness, 30s setInterval, manual LayoutRecord→LayoutPayload cast, Inspector re-render storm, sendBeacon for tab close, conflict cascade, dirty comparison cost, mount + fetch race, useLayoutEditor singleton risk, memory leaks.

Both reports were extensive. Synthesis produced a 12-finding action list ranked by severity.

## Findings + actions

### 🔴 P0 — public endpoint leaks DRAFT layouts to anonymous users (FIXED)

**Verified by reading code**: `layers/base/server/api/layouts/by-route.get.ts` returns `getLayoutByScope()` result regardless of `layout.state`. The handler's docstring promised "admins see drafts, end users get a 404 until published" — but the code never implemented that gate. Anonymous users hitting `/api/layouts/by-route?path=/whatever` got the unpublished draft content.

**Fix applied**:
- Added `getOptionalUser(event)` soft-check (does not throw on unauthenticated — endpoint must stay public for published layouts)
- Returns the layout only when `isAdmin || layout.state === 'published'`; otherwise null (which surfaces as 404 to the catch-all + the legacy renderer fallback)
- Cache key bifurcated: `admin:<path>` vs `public:<path>` so an admin's draft-aware response can't leak to an anonymous hit on the same key
- Lock via static contract test (`by-route-draft-leak.test.ts`, 4 tests) — string-matches the load-bearing fragments of the fix; regression surfaces if any are removed by refactor

### 🟠 P1 — per-section configSchema NOT enforced on write (FIXED)

**Verified by reading code**: `layoutCreateSchema` validates the SHAPE of `section.config` as `z.record(z.unknown())` — but ignores the per-type Zod schemas registered in `layers/base/sections/builtin/*.ts`. An admin can bypass URL guards, size caps, sandbox flags by sending arbitrary config. Limited blast radius (admin-only) but every CMS validates admin input anyway — admin tier is semi-trusted.

**Fix applied**:
- New `layers/base/server/utils/validateSectionConfigs.ts` — iterates zones → rows → sections, looks up each section's `def.configSchema` from the registry, runs `safeParse`, collects all errors into a structured 400 response
- Unknown section types also 400 with a clear error (was previously silently rendering a placeholder)
- Wired into both POST + PUT handlers BEFORE saveLayout call
- Local `httpError` helper (h3 isn't a direct layer dep — Nuxt/Nitro treats any error with `statusCode` + `statusMessage` + `data` as createError-equivalent on the wire)
- 5 tests against the REAL section registry (17 builtin sections) covering happy path + unknown types + bulk error reporting + position-info preservation

### 🟠 P1 — ogImage URL scheme bypass (FIXED)

**Verified by reading schema**: `pageMetaSchema` had `ogImage: z.string().url().max(2048).optional()`. Zod's `.url()` accepts `javascript:`, `data:`, `blob:`, `file:` schemes — all of which would render into `<meta property="og:image">` content attributes and become downstream vectors for social-media scrapers (which sometimes server-side fetch the URL).

**Fix applied**:
- Added `.refine()` to require `http://` or `https://` URL only
- 7 tests in `layout-validators.test.ts`: 2 accept (http, https) + 5 reject (javascript:, data:, file:, ftp:, protocol-relative `//`)
- Protocol-relative `//` is also rejected because Zod's `.url()` requires a scheme — documented in the schema comment + the test asserts this explicitly

### 🟠 P1 — save re-entry race + visibility-flush race (FIXED with single-flight)

**Verified by reading code**: `useLayoutEditor.save()` had no re-entry guard. Two distinct triggers could fire save() in parallel — (a) manual Save click + auto-save timer firing within the debounce window, (b) auto-save in flight while user Cmd+Tabs and visibility-change flush fires. Both calls passed the dirty check, both set saving=true, both sent PUTs with the SAME stale If-Match. Server accepts both (last-write-wins). Client's `original.updatedAt` ends up referring to whichever response landed LAST in the await queue — under network jitter this isn't guaranteed to be the actual DB row's updatedAt, causing spurious 409s on the next save.

**Fix applied**:
- Single-flight pattern: closure-captured `inFlightSave: Promise<void> | null` inside `useLayoutEditor`
- Save guards: `if (inFlightSave) return inFlightSave` — concurrent callers coalesce on the same promise
- Cleared in `finally { inFlightSave = null }` so the next save starts fresh
- Closes BOTH race triggers (single source of truth — auto-save composable doesn't need its own gate)
- 3 new tests: coalesce-into-one-PUT, sequential-saves-after-completion, lock-releases-on-error

### 🟡 P2 — array bounds (payload-bomb DOS) + ogImage refinements (FIXED)

**Verified**: `layoutCreateSchema` had no `.max()` on zones / rows / sections arrays. An admin could send a 10k-section payload to DOS the server (memory, DB connections, transaction time).

**Fix applied** (in `packages/schema/src/validators.ts`):
- `layoutBaseObject.zones` → `.max(16)` — covers narrow/wide/two-column/three-column/sidebar-*/virtual zones + headroom
- `layoutZoneSchema.rows` → `.max(200)` — comfortable for marketing pages; complex sites rarely exceed 50
- `layoutRowSchema.sections` → `.max(24)` — 2× the natural 12-col-grid maximum
- 2 new tests asserting the bounds reject oversized arrays

### 🟡 P2 — audit log on destructive paths (FIXED)

**Reasoning**: No audit log = no forensic trail when "the homepage layout disappeared" or "alice's edits got overwritten last night" reports come in. Full audit table is out of scope for this audit pass; structured console.info to stdout is the minimum.

**Fix applied**:
- DELETE handler: logs `cpub.audit.layout.delete` with adminId + layoutId + scope + name + state
- PUT handler: logs `cpub.audit.layout.force-save` when the client sends `X-Cpub-Force-Save: 1` header (signals deliberate overwrite via the conflict modal — distinguishes from normal saves which omit If-Match because the layout is new)
- Client (`useLayoutEditor.save({force:true})`) sets the header
- Greppable from container logs: `docker logs commonpub-app-1 | grep cpub.audit.layout`

## Findings DEFERRED (documented, not fixed this round)

### 🟡 P2 — LayoutRecord → LayoutPayload manual cast (Canvas.vue)

`AdminLayoutsCanvas.vue` lines 29-54 hand-build a LayoutPayload from a LayoutRecord. The cast is structurally an identity map today, but if a new section field is added in Phase 3b (e.g. `pinned: boolean`) the editor would silently drop it while the public path picks it up — exactly the wrong direction (admins lose trust when "editor preview" diverges from "live render").

**Fix queued for 3b**: replace the manual map with `LayoutPayload = Pick<LayoutRecord, 'state' | 'pageMeta' | 'zones'>` — drops the cast entirely. Five-line cleanup that closes a future bug class.

### 🟡 P2 — Inspector re-render storm + dirty stable-stringify cost

At N=50 sections, every keystroke triggers a `stableString` walk of the entire layout (allocate sorted-key proxies, JSON.stringify). Estimated 5-10ms per keystroke at N=50; >16ms at N=200 (eats a frame). Today N=5 → imperceptible.

**Fix queued for 3b polish**: replace `dirty` computed with a version-counter pattern (`dirtyVersion` ref bumped on every mutation, `savedVersion` set on save success → `dirty = computed(() => dirtyVersion !== savedVersion)`). O(1) compare.

### 🟡 P2 — Beacon for tab-close

`visibilitychange to hidden` fires reliably on Cmd+Tab + minimize but NOT on tab close (Chromium prefers `pagehide`; Safari fires neither reliably on mobile). The save uses `$fetch` (async, may not complete before page destruction).

**Fix queued**:
- Phase 3a polish: add `pagehide` listener parallel to `visibilitychange` (one extra listener, same handler) — covers Chromium
- Phase 3b: add `/api/admin/layouts/[id]/beacon` accepting a beacon-shaped body, use `navigator.sendBeacon` from `pagehide` for browser-guaranteed delivery (tradeoff: sendBeacon doesn't carry If-Match → unload save is last-write-wins; acceptable for "don't lose work")

### 🟡 P2 — Conflict cascade thrashing

If admin clicks "Reload their version" and a third admin saves during the reload's network round-trip, the user's next edit can immediately 409 again. Each conflict is a different third-party save (not a single loop) but the UX thrashes.

**Fix queued for 3b**: throttle pattern — 3 conflicts within 60s → switch to manual-mode banner. Cheap to add, big UX improvement. Phase 3b+ presence ping ("Alice is also editing") preempts this entirely.

### 🟢 P3 — items intentionally deferred

- 30s setInterval doesn't pause on tab hidden (battery drain, minor)
- useLayoutEditor not provide/inject'd (works today, latent if child components ever call it)
- BlockEmbedView iframe missing `sandbox` attribute (separate from session 160 scope)
- Rate-limit bucketing: single bucket for all `/api/admin/*` (low real risk for admin-only routes)
- Versioning cleanup / GDPR for old `layout_versions` snapshots (operator/legal scope)

### 🟢 Verified SAFE — no action needed

- Auth on every editor endpoint (`requireAdmin` + `requireFeature('admin')` + `requireFeature('layoutEngine')` ordering verified by `handlers-contract.test.ts`)
- Cross-admin IDOR (single-tenant model; last-write-wins by design — now audit-logged)
- CSRF (Better Auth uses SameSite=Lax cookies)
- Path traversal (validateCustomPageScope + path-normalize cover the cases)
- If-Match header parsing (simple string compare; no injection surface)
- SSRF in ogImage (never server-fetched on the editor/public path; the only ogImage fetch is `safeFetch`-guarded in the article-import flow which is unrelated)
- Memory leaks (all listeners + intervals correctly cleaned in onBeforeUnmount; Vue auto-cleans watch())
- Editor mount + initial fetch race (verified: `useLayoutAutoSave` is wired AFTER the initial state assignment; watcher's `flush: 'post'` + initial-value-matches-original ensures no false positive on mount)
- Discard-cancels-timer (verified: timer fires but hits `if (!dirty.value) return` no-op)
- Force-save updates If-Match correctly (verified: `original.value = updated` from server response → subsequent normal saves use fresh updatedAt)

## Anti-patterns deliberately NOT adopted

1. **Wholesale audit DB table** — out of scope; structured stdout log is the minimum forensic trail. When operator complaints surface, promote to a real audit table.
2. **Type-to-confirm on force-save** — overkill for v1; modal already has 3-option pattern with destructive as rightmost.
3. **Rejecting ALL non-https ogImage URLs** — http:// is still valid for internal/dev environments; restriction is to the http(s) family only.
4. **Per-section custom Zod composition at the schema level** — kept section schemas in the layer (where the registry lives); validation runs at API boundary, not in the shared schema package. Server package stays section-agnostic.
5. **Throwing on unknown section type at the SCHEMA level** — would couple schema to registry. Validation happens at API boundary with structured error response.

## Files changed (this audit pass)

| File | Change |
|---|---|
| `layers/base/server/api/layouts/by-route.get.ts` | P0 draft-leak fix + cache-key bifurcation |
| `layers/base/server/api/layouts/__tests__/by-route-draft-leak.test.ts` | NEW — 4 contract tests |
| `layers/base/server/utils/validateSectionConfigs.ts` | NEW — per-section configSchema validator |
| `layers/base/server/utils/__tests__/validateSectionConfigs.test.ts` | NEW — 5 tests against real registry |
| `layers/base/server/api/admin/layouts/index.post.ts` | Wired validateSectionConfigs |
| `layers/base/server/api/admin/layouts/[id].put.ts` | Wired validateSectionConfigs + audit log on force-save |
| `layers/base/server/api/admin/layouts/[id].delete.ts` | Audit log + captured admin var |
| `layers/base/composables/useLayoutEditor.ts` | Single-flight inFlightSave guard + X-Cpub-Force-Save header |
| `layers/base/composables/__tests__/useLayoutEditor.test.ts` | NEW — 3 single-flight tests |
| `packages/schema/src/validators.ts` | ogImage refine + zones/rows/sections .max() |
| `packages/schema/src/__tests__/layout-validators.test.ts` | NEW — 7 ogImage tests + 2 array-cap tests |

## Test deltas

- **Layer**: 249 → **261** (+12: 4 draft-leak contract + 5 validator + 3 single-flight)
- **Schema**: previous + 9 new tests (7 ogImage + 2 array bounds)
- **Total this audit pass**: +21 tests
- **Typecheck**: 26/26 (forced fresh after every step)

## What this audit was looking for that wasn't there

The agents asked tough questions and got clean answers most of the time. The cases above (P0 + P1s) are real bugs that shipped to production briefly + are now fixed before any operator complaints. The deferred items are mostly perf-at-scale concerns (Inspector storm, dirty cost) that don't bite at v1 layout sizes (N=5 sections) but will at N=50+.

## Linked artifacts

- `docs/sessions/160-audit-godmode.md` — Round 1 (UX polish)
- This doc — Round 2 (security + correctness)
- `docs/sessions/160-phase-3a-editor-shell.md` — main session log
- `docs/plans/phase-3-editor.md` — Phase 3a checklist (all ✅)
- New memory: `feedback-visual-editor-ux-patterns` (from round 1, still relevant)
