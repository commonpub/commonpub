# Layout engine — full feature rollout plan

> **Living document.** Update as each stage completes. Source of truth for "what's next" during autonomous execution sessions.

**Last updated**: session 159 (canary live on commonpub.io, holding for soak per user direction)
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
- [x] **A3**: Publish both — server published 2.58.0, layer published 0.24.0 with 635 files including all 6 new sections + migration endpoint + feature-flags-prime Nitro plugin
- [x] **A4**: Verified on registry — `pnpm view @commonpub/server@2.58.0 version` + `pnpm view @commonpub/layer@0.24.0 version` both resolve
- [-] **A5**: Heatsync pin bump (68e1959 in heatsynclabs-io) — pushed; deploy in flight
- [ ] **A6**: Heatsync verify health + run migration via admin endpoint OR script (TBD: heatsync's runtime container has @commonpub/* from npm install — should resolve cleanly; need to add migrate-homepage-layout script to heatsync's repo OR call admin endpoint with admin session)
- [ ] **A7**: Bump deveco's pin — schema already at ^0.17.0, layer + server need bumps. Same npm-install gotcha NOT applicable to heatsync; deveco uses pnpm so the schema-pin caveat from session 158 might still apply
- [ ] **A8**: Deveco canary

### Stage B — Phase 2: custom-page catch-all

Goal: enable admins to create `/about`, `/team`, etc as layout-only pages.

- [ ] **B1**: Catch-all route at `pages/[...slug].vue` with priority below file-based routes
- [ ] **B2**: Path normalisation utility (strip trailing slash, lowercase, reject reserved prefixes `/api`, `/_nuxt`, etc)
- [ ] **B3**: Conflict detection on save — refuse a `custom-page` layout if a file-based route exists for that path
- [ ] **B4**: Admin endpoint POST `/api/admin/layouts` for `scope.type='custom-page'` (CRUD already supports it; just needs conflict check)
- [ ] **B5**: 404 handling — if no layout for the path AND no file route, render 404
- [ ] **B6**: Integration tests + session log entry

### Stage C — Phase 6b: 5 more sections (highest-value subset)

Goal: chip away at the 13 remaining section types. Pick the most-used.

- [ ] **C1**: `gallery` — image grid 2-5 cols with lightbox
- [ ] **C2**: `video` — local file OR YouTube/Vimeo embed
- [ ] **C3**: `embed` — oEmbed URL (twitter, github, codepen)
- [ ] **C4**: `cta` — heading + paragraph + button(s)
- [ ] **C5**: `markdown` — sanitised markdown body
- [ ] **C6**: Update registry + tests + LLM ref doc

### Stage D — Phase 3a: editor shell read-only

Goal: admin can SEE the layout in the editor, no editing yet.

- [ ] **D1**: `pages/admin/layouts/index.vue` — page list (one row per layout)
- [ ] **D2**: `pages/admin/layouts/[id].vue` — canvas (LayoutSlot in `:editable=false` mode)
- [ ] **D3**: LayoutSlot `editable` prop — wraps each section in a selection overlay
- [ ] **D4**: Right-side inspector panel with page-meta form (title, description, ogImage, access, frame)
- [ ] **D5**: Toolbar with viewport toggle (mobile/tablet/desktop preview)
- [ ] **D6**: Auto-save scaffolding (debounced PUT, conflict detection)

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
| (NEW) | Resume — start with Stage A | User said keep going |

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
