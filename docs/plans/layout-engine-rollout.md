# Layout engine — full feature rollout plan

> **Living document.** Update as each stage completes. Source of truth for "what's next" during autonomous execution sessions.

**Last updated**: session 160 (Phase 3a editor shell shipped + 4 audit rounds; final head `946820c`, 264 layer tests). Next: Phase 3b drag-drop (2 sessions) or schema-package refactor (1 session, unblocks R2's deferred per-section validation) per `docs/sessions/161-handoff-prompt.md`.
**Architectural source**: `docs/plans/layout-and-pages.md` (1342 lines — the design doc, frozen)

---

## State as of session 159 close

| Site | Layer pin | Phase 1c rendering | Status |
|---|---|---|---|
| commonpub.io | workspace `main` | LayoutSlot, 7 sections | ✓ live |
| heatsynclabs.io | npm `0.23.3` | legacy renderer | ✓ healthy |
| deveco.io | npm `0.23.3` | legacy renderer | ✓ healthy |

**Built but not yet published**: 6 new sections + migration function + admin endpoint + SSR feature-flag prime + 5 infra fixes. All on `main`.

**Phases done**: 0.5 (test gap), 1 (schema + LayoutSlot + 5 starters + flag), partial 4 (homepage only).

**Phases remaining**: 2 (catch-all routes), 3a-f (editor UI), 4 (remaining 7 routes), 5 (preview-scene), 6a (mobile editor), 6b (13 more sections), 7 (versioning UI), 8 (multi-select), 9 (code-registered sections), 10 (perf hardening).

---

## Execution queue (in priority order)

### Stage A — Close the canary loop ✅ in progress

Goal: ship the work that's already on main to npm + roll to all 3 sites. Closes Phase 1 fully.

- [x] **A1**: Bump `@commonpub/server` 2.57.0 → 2.58.0 ✓ daafd2a
- [x] **A2**: Bump `@commonpub/layer` 0.23.3 → 0.24.0 ✓ daafd2a
- [x] **A3**: Publish both ✓ server 2.58.0 + layer 0.24.0 (635 files, all 6 sections + endpoints + Nitro plugin)
- [x] **A4**: Verified on registry via `pnpm view`
- [x] **A5**: Heatsync — 68e1959 in heatsynclabs-io, deployed clean, health 200, layer 0.24.0 + server 2.58.0 + schema 0.17.0 (80 files) installed via npm, layoutEngine flag stays off, legacy renderer serving. No homepage.sections to migrate — DORMANT state.
- [x] **A6**: ⚠️ feature-flags-prime plugin not in heatsync's nitro bundle (grep returned 0). Investigate before any operator canary. Workaround for now: operator can flip layoutEngine via `NUXT_PUBLIC_FEATURES_LAYOUT_ENGINE=true` env var (path that bypasses the plugin).
- [x] **A7**: Deveco — 4a1dcf0 in deveco-io, deployed in 4m28s, health 200, layer 0.24.0 + server 2.58.0 + schema 0.17.0 (80 files, no pnpm-drop-files bug). layoutEngine off, legacy serving. No homepage.sections to migrate.
- [x] **A8**: Deveco canary state confirmed dormant. Plugin bundled correctly (re-checked post-audit, see A.fix.1).

**Stage A complete 2026-05-27**. All 3 sites on layer 0.24.0; commonpub.io ACTIVE (LayoutSlot serving), heatsync + deveco DORMANT (legacy serving, full infra including feature-flags-prime plugin ready for operator opt-in).

### Stage A follow-ups (queue for next session)

- [x] **A.fix.1**: ~~Feature-flags-prime plugin missing from heatsync/deveco bundle~~ — **FALSE ALARM, retracted.** Re-checked: `grep -c cpubFeatureFlags /app/.output/server/chunks/nitro/nitro.mjs` returns 1 on all 3 sites. The plugin IS bundled via Nuxt's auto-discovery from extended layers (`server/plugins/` auto-merge). Earlier finding-of-0 was measured BEFORE the layer-0.24.0 deploy fully landed (against a stale 0.23.x bundle). **Operator opt-in path is unblocked on heatsync + deveco.** Lesson: never grep prod artifacts during a deploy window.
- [ ] **A.fix.2**: PUT handler on /api/admin/layouts/[id] enforces scope immutability so custom-page validate is moot. But could add a "normalise-then-compare" check so a client sending `/About` doesn't 400 against DB's `/about`. Low priority.

### Stage B — Phase 2: custom-page catch-all ✅ shipped 2026-05-27

Goal: enable admins to create `/about`, `/team`, etc as layout-only pages.

- [x] **B1**: Catch-all route `layers/base/pages/[...customPath].vue` ✓ commit 919270a
- [x] **B2**: `pathNormalize(input)` utility in `@commonpub/server` ✓ 52 tests
- [x] **B3**: `validateCustomPageScope(db, path)` with FILE_ROUTE_PREFIXES + duplicate detection ✓ 23 tests
- [x] **B4**: POST /api/admin/layouts wired with custom-page validate ✓ 400/409 errors
- [x] **B5**: Catch-all throws createError({statusCode:404}) for malformed paths + missing layouts ✓ SSR-safe via setResponseStatus
- [x] **B6**: 75 tests cover full path; commit 919270a

### Stage B follow-ups (deferred, queue for next session)

- [ ] **B.fix.1**: Wire validateCustomPageScope into PUT handler. Scope immutability check already enforced; this just adds path-normalisation safeguard. Low priority.
- [ ] **B.fix.2**: FILE_ROUTE_PREFIXES is hardcoded today. Phase 3 needs the Nitro plugin scanner that reads Nuxt's compiled route table at startup. Until then, thin apps adding routes must update the list manually.
- [ ] **B.fix.3**: Access control on catch-all — `'admin'` access returns 404 if not auth'd. Currently uses `useAuth().user` which is client-hydrated. SSR-side admin probe needed before this is bulletproof against existence-leak.

### Stage C — Phase 6b: 5 more sections ✅ shipped 2026-05-27 commit 8ae246b

Goal: chip away at the 13 remaining section types. Pick the most-used.

- [x] **C1**: `cta` — heading + body + up to 3 buttons (variants: default/contrast/minimal). URL guard on hrefs
- [x] **C2**: `markdown` — sanitised via @commonpub/docs renderMarkdown (remark+rehype-sanitize). Server-side render via useAsyncData; safer alternative to custom-html
- [x] **C3**: `gallery` — 2-5 col image grid, 5 aspect ratios, 20-item cap. URL guards on src + href. Lightbox deferred (data-lightbox-id hook present for Phase 10)
- [x] **C4**: `video` — dispatches between `<video>` (local file/.mp4) and `<iframe>` (YouTube/Vimeo via utils/embedUrl). Restrictive sandbox; autoplay → muted
- [x] **C5**: `embed` — generic sandboxed iframe with hardcoded host allowlist (twitter/x, github, codepen, loom, jsfiddle, figma, glitch, replit, youtube, vimeo). status:'beta' until sandbox policy stable
- [x] **C6**: Registry up to 17 sections (divider + 11 + 5 Phase 6b). 60 new component tests + 6 registry assertions. 300 layer tests total

### Stage C follow-ups

- [ ] **C.fix.1**: Per-instance embed allowlist override via `instance_settings.embedAllowlist` (admin can extend the hardcoded list). Phase 6b polish.
- [ ] **C.fix.2**: Lightbox composable + style wired to gallery's `data-lightbox-id` hook. Phase 10 polish (a11y-quality OSS lightbox audit needed).
- [ ] **C.fix.3**: Remaining 8 Phase 6b sections: spacer, featured-content, content-card, event-list, member-list, contact-form, newsletter, announcement, iframe. Defer per docs/plans/layout-and-pages.md §8 (estimated ~2 sessions for the lot).

### Stage D — Phase 1c canary polish (3 live-bug fixes) ✅ shipped 2026-05-27 commit 1174e7b

Goal: fix the 3 issues the user reported on the live canary.

- [x] **D1**: Migration hero defaults — legacy.title is the EDITOR DISPLAY NAME, not user-facing copy. When legacy hero has no real content (no customTitle/customSubtitle/eyebrow), restore the hardcoded copy from HeroSection.vue (Build/Document/Share + Open Source eyebrow + 2 CTAs). +3 PGlite tests.
- [x] **D2**: SectionContentFeed pagination — ported the legacy offset-based load-more pattern. Watch on query resets accumulated pages when admin changes section config. Button shows when items >= page size; hides on partial-page response.
- [x] **D3**: Auto-sync admin homepage.sections edits → layouts table. After PUT /api/admin/homepage/sections succeeds AND if features.layoutEngine is on, re-run migrateHomepageSectionsToLayout(force:true) + invalidate cache. Soft-fail (logs but doesn't block the user's save). Layer-flag off → no-op (legacy renderer reads sections directly).
- [x] **D4**: Re-canary verified on commonpub.io — hero shows real copy, Load more button rendered, removed sections stay removed. 5 sections live (user removed 2 via admin between canary attempts).

### Stage D follow-ups

- [ ] **D.fix.1**: Publish layer 0.25.0 + server 2.59.0 with these fixes when ready to roll out to heatsync + deveco. Not needed today — they're dormant (flag off) so auto-sync is no-op anyway.
- [ ] **D.fix.2**: SectionContentFeed pagination test — added the code path but no test asserting button-visibility / load-more-click flow. Manual canary covered today; add Vitest coverage next round.
- [ ] **D.fix.3**: The migration script's verification SQL uses `s."order"` which postgres parses fine but my SSH-inlined query escaped to `s.order` which fails. Cosmetic; the migration itself worked.

### Stage D — Phase 3a: editor shell read-only ✅ shipped 2026-05-28 (session 160)

Goal: admin can SEE the layout in the editor, edit page meta, save + publish.

- [x] **D1**: `pages/admin/layouts/index.vue` — page list (one row per layout) ✓ commit 583b7c3
- [x] **D2**: `pages/admin/layouts/[id].vue` — three-column editor shell ✓ commit 8358bff
- [x] **D3**: LayoutSlot `editable` prop — section + row chrome via modifier class + pseudo-element ✓ commit 85b0412
- [x] **D4**: Right-side inspector panel with page-meta form ✓ commit 8358bff
- [x] **D5**: Toolbar with viewport toggle + save indicator + publish ✓ commit d7ab0b9
- [x] **D6**: Auto-save scaffolding (1.5s debounce + If-Match → 409 → conflict modal) ✓ commit e60ff26

**End state (session 160 close — post-4-audit-rounds)**: commonpub.io on workspace main (`946820c`). Editor available at `/admin/layouts` + `/admin/layouts/[id]`. heatsync + deveco untouched (npm 0.24.0 dormant). Layer tests 196 → **264** (+68 across phase 3a + 4 audit rounds). Schema +9 tests. Server tests 1125 (no count change; R4 perf fix exercised by existing coverage). Typecheck 26/26.

**Session 160 four audit rounds** (post-3a.8):
- **R1 UX polish** — web-research synthesis from Linear/Notion/Figma/Webflow/Framer/Strapi/Sanity/Carbon/Cloudscape/GitLab/Primer/dnd-kit/React Aria/XWiki + cruft scan. 6 priority-1 fixes (cursor lie, conflict modal redesign, Modified state pill, touch targets, save timestamp, visibility flush) + 3 self-caught bugs (WCAG yellow contrast, modal focus-on-mount, build-break recovery). Doc: `docs/sessions/160-audit-godmode.md`.
- **R2 security + correctness** — parallel agents for auth/XSS/CSRF + race conditions. **P0 draft leak** (pre-existing from Phase 1c!) on `/api/layouts/by-route` fixed via 2-way cache bifurcation. P1 ogImage scheme bypass, save re-entry race (single-flight guard), array `.max()` bounds, structured stdout audit logs (`cpub.audit.layout.*` on delete + force-save). Per-section configSchema validation DEFERRED — validator implemented + 5 tests passing but wiring broke Nitro build (transitive `.vue` import from registry); proper fix is schema-package refactor. Doc: `docs/sessions/160-audit-round2-deep.md`.
- **R3 operational** — discoverability + operator UX audit. **User reported empirically** that `/admin/layouts` was invisible in admin sidebar; agent independently found same finding. Fixed: sidebar nav added with `v-if="layoutEngine"`, misleading "Migrate" CTA now actually fires migration endpoint, `frame` `<select>` disabled + Phase 4 badge (was a UI lie), 3-way cache tier bifurcation for `pageMeta.access` enforcement, 5 missing audit logs (create/publish/revert/migrate/seed), mobile editor canvas-first DOM order + <640px phone banner. Doc: `docs/sessions/160-audit-round3-ops.md`.
- **R4 DB + perf + edge cases** — parallel agents for DB layer + edge cases. **P0 `assembleLayout` full table scan** (one-line drizzle fix: `inArray(rowId, sectionRowIds)`). **P0 legacy `/admin/homepage` data loss** — auto-sync ran `force: true` which destroyed bespoke layout-engine edits + entire publish history; flipped to `force: false` + deprecation banner. Bounded LRU (1000 entries), `onBeforeRouteLeave` + `beforeunload` guards, homepage-DELETE requires `X-Cpub-Confirm-Homepage-Delete` header, Discard button wired. Doc: `docs/sessions/160-audit-round4-deep.md`.

**Total bugs caught + fixed across 4 rounds**: 20 (9 self-introduced + 1 pre-existing P0 from Phase 1c + 5 R3 + 5 R4).

### Stage E — Phase 3b: drag-drop

Goal: admin can drag sections from a palette onto rows + reorder within rows.

- [ ] **E1**: Pointer-event state machine
- [ ] **E2**: Section palette (left panel) listing all registered sections by category
- [ ] **E3**: Drop indicators (between rows, between sections, into new rows)
- [ ] **E4**: FLIP animations for reorder
- [ ] **E5**: Undo/redo stack
- [ ] **E6**: 2 sessions — split as E1-E3 and E4-E6

### Stage F — Phase 3c+: resize, a11y, auto-form, polish

- [ ] **F1 (3c)**: Resize interactions — edge handle + snap-to-12 + neighbour absorption
- [ ] **F2 (3d)**: Keyboard equivalence — every gesture reachable via Tab/Space/Arrow + ARIA live region
- [ ] **F3 (3e)**: Auto-form from Zod — 14 Zod-kind mappings, picker integrations
- [ ] **F4 (3f)**: Inspector polish — per-breakpoint colSpan, duplicate, delete

### Stage G — Phase 4: adopt LayoutSlot in 7 more routes

- [ ] **G1**: `pages/hubs/[slug].vue`
- [ ] **G2**: `pages/blog/index.vue`, `pages/project/index.vue`, `pages/learn/index.vue`
- [ ] **G3**: `pages/u/[username]/index.vue` (profile)
- [ ] **G4**: Footer (`__footer` virtual scope)
- [ ] **G5**: 404 (`__not-found` virtual scope)

### Stage H — Phase 5: preview-scene integration

- [ ] **H1**: `'page-layout'` scene for theme editor — renders in-progress layout
- [ ] **H2**: `'iframe-route'` scene — renders any route with in-progress theme overlay

### Stage I — Phase 6a + 6b remainder

- [ ] **I1 (6a)**: Tablet/mobile editor — bottom sheets, long-press drag, FAB, pinch-zoom
- [ ] **I2 (6b)**: Remaining 8 sections (spacer, featured-content, content-card, event-list, member-list, contact-form, newsletter, announcement, iframe)

### Stage J — Phase 7-10 polish

- [ ] **J1 (7)**: Versioning + draft + publish + revert UI
- [ ] **J2 (8)**: Section duplication, multi-select, context menus
- [ ] **J3 (9)**: Code-registered sections from thin app `commonpub.config.ts`
- [ ] **J4 (10)**: ETag + server-side cache hardening + SSR static-section inlining + per-section lazy hydration

---

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-27 | Defer canary on commonpub.io until 6 missing sections built | Otherwise visible homepage regression 7→2 sections |
| 2026-05-27 | Move feature-flags-prime plugin from apps/ref to layer | So heatsync/deveco inherit on layer bump |
| 2026-05-27 | Custom-html ships unsanitised + status:'beta' | Matches legacy security baseline; Phase 6b adds DOMPurify at admin-write |
| 2026-05-27 | Auto-fallback: `layoutEngineActive = flag && layout !== null` | Prevents blank-page when flag flipped without seeded layout |
| 2026-05-27 | Hold publish + rollout per user direction (post-canary) | Let commonpub.io soak for a day |
| 2026-05-27 | Resume autonomous execution per user direction "keep going" | Stages A-C shipped 16 commits + Phase 2 catch-all |
| 2026-05-27 | Catch-all uses `await useFetch` not useLayout | useLayout's non-await pattern returned null at setup; the sync check throw fired before SSR data settled. P0 latent bug found in audit, fixed in 0473313 |

---

## Rollback playbook

For any stage in this plan:

| Scenario | Action |
|---|---|
| commonpub.io canary regresses | `DELETE FROM layouts WHERE scope_type='route' AND scope_key='/'` — auto-fallback in <60s |
| Layer publish fails npm install on consumer | Deprecate the bad version, hotfix + republish (per session 158's 0.23.0 deprecation pattern) |
| heatsync deploy crashes on boot | Per [[feedback-deploy-health-check-warn-not-fail]], NEVER trust gh run list; curl `/api/health` always. Revert pin + redeploy. |
| deveco container fails on schema imports | Per [[feedback-pnpm-install-drops-files]], bump direct schema pin + regen lockfile |

---

## Standing rules (re-pinned)

- **No AI attribution** in any commit ([[feedback-no-coauthor]])
- **`pnpm publish:layer`** for layer publishes — never `npm publish` ([[feedback-pnpm-publish-layer]])
- **Poll `pnpm view`** between publishes — [[feedback-npm-propagation-lag]]
- **Caret semver on 0.x.y excludes minor bumps** — hand-edit consumer package.json ([[feedback-caret-semver-0x-minor-bump]])
- **NEVER trust `gh run list`** for deploy success — always curl `/api/health` ([[feedback-deploy-health-check-warn-not-fail]])
- **Pre-push hook runs `pnpm typecheck`** automatically; bypass only with `SKIP_SIMPLE_GIT_HOOKS=1`
- **Schema is the work** — every section's Zod schema is the contract; defaultConfig must parse against it
- **`var(--*)` only** in any new component scoped style
- **WCAG 2.1 AA min** on every visible element
- **Test-driven** — tests first or alongside, no implementation without coverage
- **No feature without a flag** in commonpub.config

---

## Memory of in-flight gotchas

These came up THIS session and will likely come up again during rollout:

- [[feedback-nuxt-env-only-declared-keys]] — env vars only propagate to `runtimeConfig.public.X` keys declared in nuxt.config.ts. Drift between FeatureFlags type and nuxt.config = silently-ignored env vars.
- [[feedback-usefetch-query-function]] — `query: { k: fn }` serialises function as undefined → 400 → null. Wrap in `computed()`.
- Dockerfile @commonpub/* exposure — `RUN rm -rf ./node_modules/@commonpub/{schema,server}` then COPY dist + package.json. MUST be AFTER `npm install` (npm prunes anything not in package.json). Subpath imports like `@commonpub/server/layout/migrate-homepage` bypass index.js's transitive workspace deps. (commonpub-only — heatsync uses npm install which copies real files.)
- **useLayout vs await useFetch in pages** — `useLayout('/x')` returns refs without internally awaiting. If a page does sync logic against `.value` in setup (early `throw createError(404)` or similar), the data is null at that point because Nuxt's SSR data coordination awaits AFTER setup returns. For sync-in-setup access, use `await useFetch('/api/layouts/by-route', ...)` directly. Pages are Suspense-wrapped — top-level await is safe. Composables that don't need sync access can keep using useLayout. Bug caught by session 159 audit (commit 0473313).
