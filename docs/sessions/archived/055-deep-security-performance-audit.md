# Session 055: Deep Security, Performance & UI/UX Audit

## Scope

Full-repo audit from 6 personas: security researcher, DBA, frontend developer, federation implementer, explainer content creator, mobile user. Found and fixed security vulnerabilities, performance gaps, broken flows, unwired UI, and a fundamental misunderstanding of the explainer content type.

## Changes Made

### Phase 1: Security (P0)

**1. XSS — Sanitized all `v-html` block renderers**
- Added `isomorphic-dompurify` to `apps/reference/package.json` and `packages/docs/package.json`
- Created `apps/reference/composables/useSanitize.ts` with DOMPurify-based `sanitizeBlockHtml()`
- Fixed 7 files: `BlockTextView.vue`, `BlockQuoteView.vue`, `BlockCalloutView.vue`, `BlockContentRenderer.vue` (fallback), `[type]/[slug]/edit.vue` (3 preview usages)
- Upgraded `packages/docs/src/render/pipeline.ts` `sanitizeHtml()` from weak regex to DOMPurify
- Editor blocks with `contenteditable` left unsanitized (self-XSS only — author editing own content)

**2. SSRF — Private IP validation in `resolveActor()`**
- `packages/protocol/src/actorResolver.ts` — added `isPrivateUrl()` check blocking 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, CGN ranges, IPv6 local/unique-local, metadata endpoints (GCP, AWS)
- Applied to both `resolveActor()` and `resolveActorViaWebFinger()`
- Note: validates hostname before fetch, not after DNS resolution. DNS rebinding is a future hardening item.

**3. Broken inbox — Fixed `processInboxActivity` call signature**
- `apps/reference/server/routes/inbox.ts` and `users/[username]/inbox.ts` were calling `processInboxActivity(body)` — function requires 2 args (activity + callbacks)
- ALL inbound federation was crashing with TypeError
- Added stub `InboxCallbacks` with console logging for each activity type
- Added TODO for HTTP signature verification

**4. CSP — Wired `Content-Security-Policy` header**
- `apps/reference/server/middleware/security.ts` now calls `buildCspDirectives()` + `buildCspHeader()`
- Dev mode: allows `unsafe-eval`, `unsafe-inline`, `ws:` for HMR
- Production: strict CSP. Skips API routes (JSON doesn't need CSP)

### Phase 2: Performance (P1)

**5. Database indexes — 50+ indexes across all 12 schema files**
PostgreSQL does NOT auto-index FK columns. Every JOIN, WHERE, CASCADE on FK columns was doing full table scans.

| Schema file | Indexes added |
|-------------|--------------|
| `content.ts` | author_id, status, type, published_at, content_versions.content_id, content_forks source/fork, content_tags content/tag, content_builds.content_id |
| `social.ts` | likes.target, follows follower/following, comments author/target/parent, bookmarks.target, notifications user+read, reports reporter/status, messages conversation/sender |
| `hub.ts` | hubs.created_by/type, hub_posts hub/author, replies post/author, bans hub/user, invites hub, shares hub/content |
| `learning.ts` | paths author/status, modules path, lessons module, enrollments user/path, lesson_progress lesson, certificates path |
| `docs.ts` | sites owner, versions site, pages version/parent |
| `files.ts` | uploader, content |
| `video.ts` | author |
| `contest.ts` | created_by/status, entries contest/user |
| `product.ts` | hub, created_by, content_products product |
| `federation.ts` | activities direction+status/actor_uri/created_at |
| `admin.ts` | audit_logs user/created_at |

**IMPORTANT: Run `drizzle-kit push` to apply these indexes to the database.**

### Phase 3: Correctness (P1)

**6. Query validation — 25 GET routes fixed**
Replaced `.parse(getQuery(event))` (throws unformatted ZodError → 500) with `parseQueryParams(event, schema)` (returns clean 400 with field errors). Files across content, social, admin, hubs, learn, docs, products, search, videos, users, notifications, contests, files.

### Phase 4: UI/UX Alignment

**7. ExplainerView layout conflict (CRITICAL)**
ExplainerView has its own `position: fixed` topbar + full-height sidebar layout. Was rendering inside the default layout (which also has a fixed topbar at `top: 0`). Result: double overlapping topbars, broken layout.

Fix: `pages/[type]/[slug]/index.vue` now uses `setPageLayout(false)` when content type is `explainer`, and `setPageLayout('default')` when switching back to other types. This handles the case where the same page component is reused across content type navigations.

**8. Editor canvas "page card" wrapper**
`editors/BlockCanvas.vue` — blocks now render inside `.cpub-canvas-page` (bordered white card with box-shadow), matching mockup `03-editor-article.html` which shows a 680px document card centered in the canvas. Responsive: card styling removed on mobile (<768px).

### Phase 5: Explainer Editor Overhaul

After reading the explainer skill files (`/Users/obsidian/Projects/ossuary-projects/skills/hackbuild-explainer.skill` and `explorable-explainer.skill`), identified that the explainer is a **Nicky Case-style explorable explanation**, not a blog post with widgets. The existing explainer editor was indistinguishable from the article editor.

**9. SliderBlock editor — feedback ranges (the main broken flow)**
The slider VIEW (`BlockSliderView.vue:18-22`) reads `content.feedback` as `FeedbackRange[]` for contextual messages at different values. The editor (`SliderBlock.vue`) had NO UI to configure these ranges — making the slider's defining feature impossible to use through the editor.

Rewrote `editors/blocks/SliderBlock.vue` with:
- Feedback range editor: add/remove ranges, min/max bounds, state selector (low/slow/ok/good/high/danger), message text per range
- Default value field
- Live preview with working slider + feedback display
- Previous fields retained: label, min, max, step, unit

**10. ExplainerEditor differentiation**
Rewrote `editors/ExplainerEditor.vue` to feel like an explainer tool:
- **Block types reordered**: Interactive blocks FIRST (slider → "Range Slider", quiz → "Knowledge Check", checkpoint, callout → "Key Insight")
- **Content blocks renamed**: "Body Text — 2-3 short paragraphs max", "Section Header", "Diagram" (not "Image")
- **Structure tab redesigned**:
  - Question → Interact → Insight → Bridge flow guide at top
  - Interactive count summary (e.g. "3 interactives across 5 sections")
  - Per-section list with section number, title, block count, interactive count badge
  - Warning when a section has no interactive block
  - Empty state with guidance
- **Status bar**: shows "sections" + "interactives" (not just blocks/words)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Editor `v-html` in contenteditable blocks left unsanitized | Self-XSS only (author editing own content). Sanitizing would break editing UX by stripping user input. |
| Inbox callbacks are stubs with logging | Real DB-backed implementations deferred until federation is prioritized. Current stubs prevent crashes and log activity. |
| HTTP signature verification marked as TODO | Requires integration with `verifyHttpSignature()` from protocol package. Significant work. |
| CSP skipped for `/api/` routes | JSON responses don't execute in a browser context. CSP is a defense for HTML pages. |
| SSRF validates hostname only (not after DNS resolution) | DNS rebinding is a future hardening item. Current check blocks the most common SSRF vectors. |
| ExplainerView uses `setPageLayout(false)` not a separate page file | Avoids route duplication. Nuxt `setPageLayout` works reactively. Resets to 'default' when navigating to non-explainer content. |
| Slider feedback ranges stored in block content as `feedback[]` | Consistent with how slider min/max/step are stored. The VIEW already reads this field — the editor just needed to write it. |

## Verification

- All 28 Turborepo tasks pass (build + test across all packages)
- TypeScript compiles clean for schema and protocol packages
- Reference app build produces working output
- All 175 unit/integration tests pass

## Known Remaining Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| HTTP signature verification on inbox | P1 | TODO in code. Inbox accepts unsigned POSTs. |
| Canvas-based simulations for explainers | P2 | Skill files describe canvas sims (draggable, tick-based). Current blocks are foundation only. |
| Dark mode CSS coverage | P2 | Theme switcher works but page-scoped styles may have gaps. |
| Avatar component duplication | P3 | `@commonpub/ui` Avatar.vue exists but pages use ad-hoc letter-initial implementations. |
| Tab CSS migration | P3 | Per-page tab CSS exists alongside global `.cpub-tab-bar`. |
| Editor zoom controls | P3 | Mockup shows zoom in/out/100% in canvas toolbar — not implemented. |
| DNS rebinding in SSRF protection | P3 | Current check validates hostname pre-fetch. Doesn't validate resolved IPs. |

## File Change Summary

| File | Change |
|------|--------|
| `apps/reference/composables/useSanitize.ts` | **NEW** — DOMPurify-based HTML sanitizer |
| `apps/reference/package.json` | Added `isomorphic-dompurify` dependency |
| `packages/docs/package.json` | Added `isomorphic-dompurify` dependency |
| `packages/docs/src/render/pipeline.ts` | Replaced regex sanitizer with DOMPurify |
| `packages/protocol/src/actorResolver.ts` | Added SSRF protection (private IP check) |
| `apps/reference/server/routes/inbox.ts` | Fixed `processInboxActivity` call + stub callbacks |
| `apps/reference/server/routes/users/[username]/inbox.ts` | Same fix |
| `apps/reference/server/middleware/security.ts` | Added CSP header |
| `packages/schema/src/*.ts` (12 files) | Added 50+ database indexes |
| 25 API GET routes | `.parse()` → `parseQueryParams()` |
| `apps/reference/components/blocks/Block*View.vue` (4 files) | Added DOMPurify sanitization |
| `apps/reference/pages/[type]/[slug]/edit.vue` | Added sanitization to preview v-html |
| `apps/reference/pages/[type]/[slug]/index.vue` | Added `setPageLayout` for explainer layout |
| `apps/reference/components/editors/BlockCanvas.vue` | Added page card wrapper |
| `apps/reference/components/editors/blocks/SliderBlock.vue` | Rewrote with feedback ranges + live preview |
| `apps/reference/components/editors/ExplainerEditor.vue` | Rewrote structure tab, block ordering, flow guidance |
