# Session 055: Deep Security & Performance Audit

## What Was Done

Full-repo audit from multiple personas (security researcher, DBA, frontend developer, federation implementer). 17 issues found across P0-P3 severity. All fixable issues addressed.

### Security Fixes (P0)

1. **XSS: Sanitized all `v-html` block renderers**
   - Added `isomorphic-dompurify` to reference app + docs package
   - Created `composables/useSanitize.ts` with DOMPurify-based `sanitizeBlockHtml()`
   - Fixed: `BlockTextView.vue`, `BlockQuoteView.vue`, `BlockCalloutView.vue`, `BlockContentRenderer.vue` (fallback), `[type]/[slug]/edit.vue` (3 preview usages)
   - Upgraded `@commonpub/docs` `sanitizeHtml()` from regex-based to DOMPurify

2. **SSRF: Added private IP validation to `resolveActor()`**
   - `packages/protocol/src/actorResolver.ts` — blocks requests to 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, CGN ranges, IPv6 local, metadata endpoints
   - Applied to both `resolveActor()` and `resolveActorViaWebFinger()`

3. **Broken inbox: Fixed `processInboxActivity` call signature**
   - Both `/inbox` and `/users/[username]/inbox` were calling with 1 arg (needs 2)
   - Added stub `InboxCallbacks` with logging — federation processing now functional
   - Added TODO for HTTP signature verification

4. **CSP header: Wired `Content-Security-Policy` into security middleware**
   - `server/middleware/security.ts` now calls `buildCspDirectives()` + `buildCspHeader()`
   - Dev mode allows `unsafe-eval`, `unsafe-inline`, `ws:` for HMR
   - Production mode uses strict CSP

### Performance Fix (P1)

5. **Added 50+ database indexes on FK columns across all schema files**
   - `content.ts`: author_id, status, type, published_at, content_versions FK, content_forks FKs, content_tags FKs, content_builds FK
   - `social.ts`: likes target, follows follower/following, comments author/target/parent, bookmarks target, notifications user/read, reports reporter/status, messages conversation/sender
   - `hub.ts`: created_by, type, hub_posts hub/author, replies post/author, bans hub/user, invites hub, shares hub/content
   - `learning.ts`: paths author/status, modules path, lessons module, enrollments user/path, lesson_progress lesson, certificates path
   - `docs.ts`: sites owner, versions site, pages version/parent
   - `files.ts`: uploader, content
   - `video.ts`: author
   - `contest.ts`: created_by/status, entries contest/user
   - `product.ts`: hub, created_by, content_products product
   - `federation.ts`: activities direction+status, actor_uri, created_at
   - `admin.ts`: audit_logs user, created_at

### Correctness Fix (P1)

6. **Replaced 25 `.parse(getQuery(event))` calls with `parseQueryParams(event, schema)`**
   - All GET routes now return clean 400 errors instead of unformatted 500 on bad query params

## Decisions Made

- Editor block `v-html` (in contenteditable editors) left unsanitized — self-XSS only, sanitizing would break editing UX
- Inbox callbacks are stubs with logging — real DB-backed implementations deferred until federation is prioritized
- HTTP signature verification marked as TODO — requires integration with `verifyHttpSignature` from protocol package
- CSP skipped for `/api/` routes (JSON responses don't need CSP)

## Known Remaining Issues

- **HTTP signature verification**: Inbox routes accept unsigned POSTs (TODO in code)
- **Dark mode CSS coverage**: Theme switcher works but page-scoped styles may not all have dark variants
- **Avatar component**: `@commonpub/ui` Avatar.vue exists but pages still use ad-hoc implementations
- **Tab CSS migration**: Per-page tab CSS still exists alongside global `.cpub-tab-bar`

## Next Steps

- Wire inbox callbacks to actual DB operations (accept follows, mirror content)
- Implement HTTP signature verification on inbox routes
- Run `drizzle-kit push` to apply new indexes to database
- Audit dark mode CSS coverage
