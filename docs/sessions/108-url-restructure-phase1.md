# Session 108 — URL Restructure Phases 1+2 (2026-04-06)

## What Was Done

Phase 1 of the URL restructure: `/{type}/{slug}` → `/u/{username}/{type}/{slug}`.
This is the **additive, non-breaking** phase. All changes are backwards compatible — old URLs still work via 301 redirects.

### New Files Created
- `layers/base/composables/useContentUrl.ts` — client-side URL builder composable (`contentPath`, `contentEditPath`, `contentNewPath`, `contentUrl`, `contentLink`)
- `layers/base/pages/u/[username]/[type]/[slug]/index.vue` — new content detail page
- `layers/base/pages/u/[username]/[type]/[slug]/edit.vue` — new content editor page
- `layers/base/server/routes/u/[username]/[type]/[slug].ts` — new AP Article dereference endpoint
- `docs/plans/url-restructure-audit.md` — exhaustive 272-location audit across 94 files

### Modified Files
- `packages/server/src/query.ts` — added `buildContentPath()`, `buildContentUrl()`, `buildContentEditPath()`, `buildContentNewPath()` + `scopeCols` param on `ensureUniqueSlugFor()`
- `packages/server/src/index.ts` — exported new URL builders
- `packages/schema/src/content.ts` — replaced global `UNIQUE(slug)` with composite `UNIQUE(authorId, type, slug)`
- `packages/server/src/content/content.ts` — author-scoped slug uniqueness (4 call sites), `getContentBySlug` accepts `authorUsername`/`authorId` disambiguation, `apObjectId` stamped on first publish, `SQL` type import
- `layers/base/composables/useContentSave.ts` — added `username` option, replaced 5 URL construction sites with `viewPath()`/`editPath()` helpers
- `layers/base/pages/[type]/[slug]/index.vue` — converted to 301 redirect (lookup author → redirect to `/u/{username}/{type}/{slug}`)
- `layers/base/pages/[type]/[slug]/edit.vue` — converted to 301 redirect (new → use current user, existing → lookup author)
- `layers/base/server/api/content/[id]/index.get.ts` — added `?author=` query param for slug disambiguation
- `test-site/server/api/content/[id]/index.get.ts` — same (gitignored, not committed)

### Audit Issues Found & Fixed (7 total across 4 audit passes)
1. `useContentSave` composable used old URL format in 5 places — added `username` option
2. AP dereference route missing `type` filter + TS enum error — added filter with cast
3. New pages didn't validate content author matches URL username — added `?author=` API param
4. Edit page didn't verify URL username matches authenticated user — added auth check (redirect for new, 404 for existing)
5. `getContentBySlug` slug-only query could return wrong content on collision — added `authorUsername`/`authorId` params
6. 4 internal callers of `getContentBySlug` also needed author disambiguation — updated all
7. Test-site API endpoint also needed `author` param — updated

### Pre-Existing Bugs Found (not part of this change)
- `layers/base/server/api/users/[username]/feed.xml.get.ts:53` — uses `/profile/${username}` instead of `/u/${username}` (dead link)
- `test-site/components/views/ArticleView.vue:10` — `useEngagement(contentId, contentType)` uses positional args instead of object

### Verification
- 26/26 typecheck passing
- 760 server tests passing (unchanged)
- 181 explainer tests passing (unchanged)

---

## What Phase 1 Ships

| Feature | Status |
|---------|--------|
| New URLs work: `/u/{username}/{type}/{slug}` | Ships |
| Old URLs redirect: `/{type}/{slug}` → `/u/{username}/{type}/{slug}` | Ships |
| Slug uniqueness scoped per author+type | Ships |
| `apObjectId` stamped on first publish | Ships |
| API supports `?author=` disambiguation | Ships |
| New AP dereference at `/u/{username}/{type}/{slug}` | Ships |
| URL builder functions (server + client) | Ships |

---

## What's Left

### Phase 2 — Update All Links (~200 locations, 1-2 sessions)

Every place that CONSTRUCTS a content URL needs to use the new builders. The new builders exist; the call sites just need to switch.

**Vue templates — layers/base (26 instances):**
- ContentCard.vue:54, HubFeed.vue:64
- ArticleView (49, 72, 210), BlogView (29), ProjectView (52, 271), ExplainerView (113, 172, 215)
- index.vue:230, dashboard.vue (205, 213, 229, 238, 259), admin/content.vue:55
- create.vue:66, [type]/index.vue:34
- contests (292, 85), learn (229, 225)

**Vue templates — test-site (26 instances):**
- Same components/pages mirrored in test-site

**Server notification links (8 instances):**
- content.ts:720, 807 — need author username join
- social.ts:66, 301 — need author username join
- inboxHandlers.ts:587, 812, 832, 975 — need author username + type join

**Feed/sitemap (8 instances):**
- feed.xml.ts, sitemap.xml.ts, user feed, hub feed (base + test-site)

**Hub share data flow (4 instances):**
- posts.ts:718-725 — add authorUsername to share JSON payload
- posts.ts:186-189 — add authorUsername to enrichment query
- hubs/[slug]/index.vue:69-76 — add authorUsername to mapping

**Learning linked content (2 instances):**
- learning.ts:878-889 — add users join to linkedContent query

**API endpoints using buildContentUri (2 instances):**
- like.post.ts:25, share.post.ts:33

### Phase 3 — Federation (~170 locations, 1-2 sessions)

Update AP object URIs and inbox parsing for the new format.

- `contentToArticle()` — use stored `apObjectId` for existing content, new format for new
- `buildContentUri()` — update or deprecate
- `federateDelete/Comment` — use stored `apObjectId`
- Inbox handlers — parse both old and new URI formats
- Hub federation share originUrl
- ~150 test URL instances across 24 test files
- 3 documentation files

### Phase 4 — Cleanup

- Remove old `[type]/[slug]` redirect pages (once analytics confirm no direct traffic)
- Update deveco-io's `create.vue` (the one `/${t.type}/new/edit` link)
- Fix pre-existing bugs found during audit

---

## Decisions Made

1. **Hubs, docs, learning, contests, products** — NOT restructured. They're in separate namespaces and not user-scoped.
2. **apObjectId** — Stamped on first publish, not on creation. Slug can change before publish; the URI should be permanent.
3. **Old AP URIs** — Preserved forever. Remote instances have cached them. Old `/content/{slug}` route stays.
4. **Composite unique** — `(authorId, type, slug)` replaces global `UNIQUE(slug)`. More permissive — migration is safe.
5. **Author disambiguation** — Server-side via `?author=` param on content detail API, not just client-side validation.

## Open Questions
- Should `/{type}/{slug}` show a disambiguation page if two users have the same slug? (Currently redirects to first match)
- When should old redirect routes be removed? (After Phase 3 when all links point to new format)

---

## Phase 2 — Update All Links (same session)

### Changes Made (Batch 0-4: Server)
- **content.ts**: Related content query now joins users for `author.username`. Build + fork notifications use `buildContentPath()`. 
- **social.ts**: Like + comment notification queries join users, use `buildContentPath()`.
- **inboxHandlers.ts**: All 4 remote notification links (comment, like UUID, like slug, boost) now join users and use `buildContentPath()`.
- **hub/posts.ts**: `shareContent()` query joins users, adds `authorUsername` to JSON payload. Enrichment backfill includes `authorUsername`.
- **hubFederation.ts + hubs/[slug]/posts/[postId].ts**: originUrl uses new format when `authorUsername` available, falls back to old.
- **learning.ts**: `linkedContent` query joins users, returns `author: { username }`.
- **All 8 feed/sitemap files** (base + test-site): Use new URL format. Fixed `/profile/` bug in user feed RSS.

### Changes Made (Batch 5: Vue Templates)
- **ContentCard.vue**: `cardLink` computed replaced with `contentLink(props.item)` from `useContentUrl()`.
- **ArticleView, BlogView, ProjectView, ExplainerView**: SEO og:url uses new format. Edit links use new format. Login redirect uses new format.
- **ProjectView**: Fork navigate uses `authUser.username`.
- **dashboard.vue**: All 5 content links use `user?.username` scoping. Bookmark links use `bm.content.author?.username`.
- **index.vue**: Featured content link uses `author?.username`.
- **admin/content.vue**: Content link uses `author?.username`.
- **create.vue + [type]/index.vue**: Create links use `user?.username` from `useAuth()`.
- **contests**: Entry links use `entry.authorUsername`. Judge page mapping updated.
- **learn**: LinkedContent links use `(linkedContent as any).author?.username`.
- **HubFeed.vue**: Share card links use `authorUsername` with fallback.
- **hubs/[slug]/index.vue**: SharedContent mapping includes `authorUsername`.
- **12 test-site mirror files**: Same changes applied (gitignored).

### Files Modified (34 tracked + 12 gitignored)
- 26/26 typecheck, 760 server tests, 181 explainer tests

### Remaining Intentional Old-Format Fallbacks
- `useContentUrl.ts:50`, `useContentSave.ts:61,65` — composable fallbacks for missing author data
- `HubFeed.vue:64`, `ArticleView.vue:211` — template fallbacks for old data without author
- All resolve via 301 redirect

### Phase 3 — Federation (same session)

- **contentMapper.ts**: `contentToArticle()` now uses stored `apObjectId` when available (via new `ContentItemInput.apObjectId` field). New content gets `/u/{username}/{type}/{slug}` format. `article.url` also uses new format.
- **federation.ts**: `federateDelete()` uses stored `apObjectId` from DB. `federateComment()` uses stored `apObjectId` for inReplyTo parent URI. New `resolveContentObjectUri()` function for callers that need the canonical AP URI.
- **federation.ts**: `buildContentUri()` deprecated (kept for compat). `like.post.ts` and `share.post.ts` now use `resolveContentObjectUri()`.
- **Inbox handlers**: Already work with both URI formats — they extract the last path segment (slug) which is the same in both `/content/{slug}` and `/u/{user}/{type}/{slug}`.
- **two-instance-federation.test.ts**: Updated 6 URI expectations to new format.
- 42 tracked files + 12 test-site files modified total across all 3 phases.
- 26/26 typecheck, 760 server tests, 373 protocol tests, 181 explainer tests.
- Protocol tests `contentMapper.test.ts` and `contentMapper.roundtrip.test.ts` updated for new URI format (3 expectations).
- `two-instance-federation.test.ts` updated for new URI format (7 expectations).

### Remaining test files with old-format URIs (~140 URLs)
These are INTENTIONALLY kept in old format because they:
- Simulate what REMOTE instances send (mastodon, misskey, gotosocial interop tests)
- Test delivery/reception mechanics using manually constructed URIs
- Use `buildContentUri()` (deprecated but functional) to construct test fixtures
- Test federated timeline ingestion of remote content with arbitrary URIs
No changes needed — these test that the system correctly handles ANY URI format from remote instances.

### Phase 4 — Cleanup (same session)
- Documentation updated: `docs/reference/guides/federation.md`, `docs/architecture.md`, `packages/server/README.md`
- deveco-io `create.vue` updated to use `/u/{username}/{type}/new/edit`
- Protocol tests: 3 expectations updated in `contentMapper.test.ts` and `contentMapper.roundtrip.test.ts`
- 45 tracked files modified + 6 new files + 12 test-site files + 1 deveco-io file

### Final Verification
- 26/26 typecheck
- 760 server tests
- 373 protocol tests
- 181 explainer tests

### Post-Audit Fixes
- test-site `[type]/[slug]/edit.vue`: Fixed 5 old-format URLs (3 navigateTo + 2 history.replaceState)
- deveco-io `node_modules` findings: stale published package — will resolve when @commonpub/layer is republished

### Federation Bug Fixes (same session)

**Hub join button not showing joined state:**
- `federated-hubs/[id]/index.vue`: `hubFollowStatus` changed from writable ref to computed from `hub.followStatus`. Button shows "Joined" when accepted, "Follow pending..." when pending.

**Hub replies not reaching host instance:**
- `inboxHandlers.ts` `onCreate()`: Added hub post reply detection. When `inReplyTo` URI matches `/hubs/{slug}/posts/{postId}` on local domain, increments `hubPosts.replyCount` and notifies the post author.
- Previously replies to hub posts were silently dropped (UUID didn't match any content slug).

### Inbox URI Parsing Fix (same session — final audit catch)
- Added `parseLocalContentUri()` and `lookupContentByUri()` helpers to `inboxHandlers.ts`
- Handles both `/u/{username}/{type}/{slug}` and `/content/{slug}` URI formats
- Uses author-scoped DB lookup when username is available in the URI
- Fixed 4 sites: onLike slug fallback, onUndo slug lookup, onCreate comment counting, onAnnounce boost counting
- Without this fix: slug collisions between users would cause likes/comments/boosts to hit the wrong content

### Documentation Updates
- Created `docs/reference/guides/url-structure.md` — comprehensive URL reference (builders, API, AP URIs, schema)
- Updated `docs/reference/guides/routing.md` — new routes as primary, old as legacy redirects
- Updated `docs/reference/guides/feature-flags.md` — content routes list
- Updated `docs/reference/implementation-guide.md` — CRUDL flow with user-scoped URLs
- Updated `docs/reference/server/content.md` — `getContentBySlug` signature with author params
- Updated `docs/adr/014-seo-strategy.md` — canonical URL pattern

### What's Left
- **Publish updated packages**: `@commonpub/schema`, `@commonpub/protocol`, `@commonpub/server`, `@commonpub/layer` — then `pnpm update` in deveco-io
- **Deploy**: Push to main triggers auto-deploy. drizzle-kit push will apply schema change.
- **Remove old redirect pages** once traffic confirms migration.
- **Hub reply text display**: federated replies increment count + notify, but reply text isn't stored locally (needs schema addition — `remoteActorUri`/`remoteActorName` columns on `hubPostReplies`, or a new table)
- **Hub join is instance-level**: instance actor sends Follow, not per-user. All users on instance share join state.
- ~140 test URLs simulating remote instances intentionally kept in old format
- When should old redirect routes be removed? (After Phase 2 when all links point to new format)
