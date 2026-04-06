# Plan: User-Scoped Content URLs (`/u/{username}/{type}/{slug}`)

## Current State
- Content URLs: `/{type}/{slug}` (e.g., `/project/my-project`)
- Slugs globally unique — `ensureUniqueSlugFor()` appends `-{timestamp}` on collision
- Federation AP object ID: `https://domain/content/{slug}`
- Federation human URL: `https://domain/{type}/{slug}`
- Schema: `contentItems.slug` has global UNIQUE constraint
- No route validation — `[type]` accepts any string, falls back to 404

## Proposed State
- Content URLs: `/u/{username}/{type}/{slug}` (e.g., `/u/alice/project/my-project`)
- Slugs unique per (author, type) — multiple users can have `my-project`
- Federation AP object ID: `https://domain/u/{username}/{type}/{slug}` (new content only)
- Old URIs stay resolvable via 301 redirects
- Schema: composite UNIQUE on `(authorId, type, slug)`, drop global unique

## Why
- Slug dedup appends timestamps (`my-project-1712345678900`) — ugly
- Explainer template gives everyone "your-explainer-title"
- User-scoped URLs are the standard (GitHub, Medium, dev.to, Hackster)
- Cleaner profiles, better SEO, disambiguation

---

## COMPLETE IMPACT INVENTORY

### A. Vue Templates — Content Links (16 files, ~25 instances)

| File | Line(s) | Current Pattern | Notes |
|------|---------|-----------------|-------|
| `layers/base/components/ContentCard.vue` | 54 | `` `/${props.item.type}/${props.item.slug}` `` | **Central** — used everywhere |
| `layers/base/components/ContentCard.vue` | 52 | `` `/mirror/${props.item.federatedContentId}` `` | Federated — no change needed |
| `layers/base/pages/index.vue` | 230 | `` `/${featured.items[0].type}/${featured.items[0].slug}` `` | Homepage featured |
| `layers/base/pages/admin/content.vue` | 55 | `` `/${item.type}/${item.slug}` `` | Admin listing |
| `layers/base/pages/dashboard.vue` | 205,213,229,238,259 | `` `/${item.type}/${item.slug}` `` and edit variant | Dashboard (5 instances) |
| `layers/base/pages/contests/[slug]/judge.vue` | 85 | `` `/${entry.contentType}/${entry.contentSlug}` `` | Contest judge |
| `layers/base/pages/contests/[slug]/index.vue` | 292 | `` `/${entry.contentType}/${entry.contentSlug}` `` | Contest entries |
| `layers/base/pages/create.vue` | 66 | `` `/${t.type}/new/edit` `` | Create page → changes to `/u/{me}/{type}/new/edit` |
| `layers/base/pages/learn/[slug]/[lessonSlug]/index.vue` | 229 | `` `/${lessonData.linkedContent.type}/${lessonData.linkedContent.slug}` `` | Lesson linked content |
| `layers/base/pages/learn/[slug]/[lessonSlug]/edit.vue` | 225 | `` `/${lesson.type}/${lessonData?.linkedContent?.slug}/edit` `` | Lesson edit |
| `layers/base/pages/[type]/[slug]/index.vue` | 80 | `` `/${enrichedContent.type}/${enrichedContent.slug}/edit` `` | Content detail edit btn |
| `layers/base/pages/[type]/index.vue` | 34 | `` `/${contentType}/new/edit` `` | Type listing create btn |
| `layers/base/components/hub/HubFeed.vue` | 64 | `` `/${post.sharedContent.type}/${post.sharedContent.slug}` `` | Hub share card |
| `layers/base/components/views/ArticleView.vue` | 210 | `` `/${item.type}/${item.slug}` `` | Related content |
| `layers/base/components/views/ExplainerView.vue` | 172,215 | `` `/${content.type}/${content.slug}/edit` `` | Edit button (2x) |
| `layers/base/components/views/ProjectView.vue` | 271 | `` `/${result.type}/${result.slug}/edit` `` | Fork → edit |

### B. SEO/Meta URLs (4 view components)

| File | Line | Current |
|------|------|---------|
| `layers/base/components/views/ArticleView.vue` | 72 | `` `${siteUrl}/article/${slug}` `` |
| `layers/base/components/views/BlogView.vue` | 29 | `` `${siteUrl}/blog/${slug}` `` |
| `layers/base/components/views/ProjectView.vue` | 52 | `` `${siteUrl}/project/${slug}` `` |
| `layers/base/components/views/ExplainerView.vue` | 113 | `` `${siteUrl}/explainer/${slug}` `` |

### C. Composables (1 file, 3 instances)

| File | Line | Current |
|------|------|---------|
| `layers/base/composables/useContentSave.ts` | 148 | `` navigateTo(`/${type}/${result.slug}`) `` |
| `layers/base/composables/useContentSave.ts` | 154 | `` navigateTo(`/${type}/${currentSlug}`) `` |
| `layers/base/composables/useContentSave.ts` | 206 | `` navigateTo(`/${type}/${resultSlug}`) `` |

### D. Server-Side Notification Links (4 instances)

| File | Line | Current | Context |
|------|------|---------|---------|
| `packages/server/src/content/content.ts` | 720 | `` `/${result.type}/${result.slug}` `` | Publish notification |
| `packages/server/src/content/content.ts` | 807 | `` `/${item.type}/${item.slug}` `` | Fork notification |
| `packages/server/src/social/social.ts` | 66 | `` `/${t.type}/${t.slug}` `` | Like notification |
| `packages/server/src/social/social.ts` | 301 | `` `/${t.type}/${t.slug}` `` | Comment/mention notification |

### E. Federation URI Construction (5 critical functions)

| File | Line | Current | Function |
|------|------|---------|----------|
| `packages/protocol/src/contentMapper.ts` | 204 | `` `https://${domain}/content/${slug}` `` | `contentToArticle()` — AP object ID |
| `packages/protocol/src/contentMapper.ts` | 259 | `` `https://${domain}/${type}/${slug}` `` | AP article.url (human URL) |
| `packages/server/src/federation/federation.ts` | 664 | `` `https://${domain}/content/${slug}` `` | `federateDelete()` |
| `packages/server/src/federation/federation.ts` | 701 | `` `https://${domain}/content/${slug}` `` | `federateComment()` inReplyTo |
| `packages/server/src/federation/federation.ts` | 776 | `` `https://${domain}/content/${slug}` `` | `buildContentUri()` utility |

### F. Inbox Handlers — URI Parsing (3 handlers)

| File | Line | Handler | Parses |
|------|------|---------|--------|
| `packages/server/src/federation/inboxHandlers.ts` | 573 | `onCreate()` | `inReplyTo` → parent slug |
| `packages/server/src/federation/inboxHandlers.ts` | 794-835 | `onLike()` | objectUri → content slug (6 fallback strategies) |
| `packages/server/src/federation/inboxHandlers.ts` | 975 | `onAnnounce()` | objectUri → content slug |

### G. Feed/Sitemap/Crawlers (4 files)

| File | Line | Current |
|------|------|---------|
| `layers/base/server/routes/feed.xml.ts` | 30 | `` `${siteUrl}/${type}/${slug}` `` |
| `layers/base/server/api/users/[username]/feed.xml.get.ts` | 37 | `` `${siteUrl}/${type}/${slug}` `` |
| `layers/base/server/api/hubs/[slug]/feed.xml.get.ts` | 31 | `` `${siteUrl}/${type}/${slug}` `` |
| `layers/base/server/routes/sitemap.xml.ts` | 53 | `` `${siteUrl}/${type}/${slug}` `` |

### H. AP Dereference Route

| File | Line | Current |
|------|------|---------|
| `layers/base/server/routes/content/[slug].ts` | 24,40 | Lookup by `eq(contentItems.slug, slug)` |

### I. Hub Federation (share metadata)

| File | Line | Current |
|------|------|---------|
| `packages/server/src/federation/hubFederation.ts` | 445 | `` `https://${domain}/${type}/${slug}` `` |
| `layers/base/server/routes/hubs/[slug]/posts/[postId].ts` | 67 | `` `https://${domain}/${type}/${slug}` `` |
| `layers/base/server/api/hubs/[slug]/share.post.ts` | 33 | Uses `buildContentUri()` |

### J. Email Templates (uses notification links — no direct URL construction)

| File | Lines | Notes |
|------|-------|-------|
| `packages/infra/src/email.ts` | 181,213 | Uses `notification.url` from notification.link field |
| `layers/base/server/plugins/notification-email.ts` | 57,138 | Prepends `siteUrl` to `notification.link` |

### K. Nuxt Page Routes (must move/duplicate)

| Current | New |
|---------|-----|
| `pages/[type]/[slug]/index.vue` | `pages/u/[username]/[type]/[slug]/index.vue` |
| `pages/[type]/[slug]/edit.vue` | `pages/u/[username]/[type]/[slug]/edit.vue` |
| `pages/[type]/index.vue` | Keep (type listing, no slug) |
| `pages/create.vue` | Update links only |

### L. Tests (7+ files with hardcoded URLs)

| File | Pattern |
|------|---------|
| `packages/protocol/src/__tests__/contentMapper.test.ts` | `https://test.example.com/blog/blog-post` |
| `packages/protocol/src/__tests__/mastodon.test.ts` | `https://hack.build/project/my-pcb` |
| `packages/server/src/__tests__/hub-post-federation.test.ts` | `https://remote/project/...` |
| `packages/server/src/__tests__/hub-members.integration.test.ts` | `https://remote.example.com/project/...` |
| `packages/server/src/__tests__/federated-timeline.integration.test.ts` | `https://remote/project/...` |
| `layers/base/components/__tests__/FederatedContentCard.test.ts` | `https://remote.example.com/project/led-cube` |
| `layers/base/composables/__tests__/useMirrorContent.test.ts` | `https://remote.example.com/article/test` |

---

## TOTAL CHANGE COUNT

| Category | Files | Instances |
|----------|-------|-----------|
| Vue template links | 16 | ~25 |
| SEO/meta URLs | 4 | 4 |
| Composables | 1 | 3 |
| Server notification links | 2 | 4 |
| Federation URI construction | 3 | 5 |
| Inbox handler URI parsing | 1 | 3 |
| Feed/sitemap | 4 | 4 |
| AP dereference route | 1 | 1 |
| Hub federation | 3 | 3 |
| Nuxt page routes | 2 | 2 (move) |
| Tests | 7+ | ~15 |
| **TOTAL** | **~44 files** | **~69 code locations** |

---

## IMPLEMENTATION STRATEGY

### Preparation: URL Builder Helper

Create a single `buildContentPath()` helper used everywhere:

```typescript
// packages/server/src/query.ts or new utils
export function buildContentPath(username: string, type: string, slug: string): string {
  return `/u/${username}/${type}/${slug}`;
}

export function buildContentUrl(domain: string, username: string, type: string, slug: string): string {
  return `https://${domain}/u/${username}/${type}/${slug}`;
}
```

Client-side equivalent in a composable. This centralizes ALL URL construction.

### Phase 1: Add New Routes (Additive, Non-Breaking)
1. Create `pages/u/[username]/[type]/[slug]/index.vue` and `edit.vue`
2. Create new AP dereference route: `server/routes/u/[username]/[type]/[slug].ts`
3. Add `buildContentPath()` / `buildContentUrl()` helpers
4. Keep old routes working (they still resolve)

### Phase 2: Schema Migration
1. Add composite UNIQUE on `(authorId, type, slug)` 
2. Drop global UNIQUE on `slug` (after composite is in place)
3. Update `ensureUniqueSlugFor()` to scope by `authorId`

### Phase 3: Update Content Creation (New Content Uses New URIs)
1. `contentToArticle()` generates new-format objectUri for new content
2. `buildContentUri()` accepts username parameter
3. New content gets AP object ID: `https://domain/u/{username}/{type}/{slug}`
4. Old content retains old AP object ID (never changes — federation contract)

### Phase 4: Update All Links
1. Update `ContentCard.vue` and all 16+ template files to use `buildContentPath()`
2. Update `useContentSave.ts` navigation
3. Update notification link construction in server
4. Update feeds, sitemap
5. Update tests

### Phase 5: Redirect Old Routes
1. `/{type}/{slug}` → 301 to `/u/{author}/{type}/{slug}` (lookup author from DB)
2. `/content/{slug}` → 301 to new AP dereference endpoint
3. Inbox handlers: try new URI pattern first, fall back to old for existing content

### Phase 6: Cleanup
1. Remove old page routes (now just redirects)
2. Update remaining tests
3. Run federation re-announce for existing published content (optional)

---

## FEDERATION BACKWARDS COMPATIBILITY

### The Contract
AP object IDs are immutable. Remote instances store `https://a.com/content/my-slug` in their databases. We CANNOT change that URI for existing content.

### Strategy
1. **Old content keeps old URI** — `contentToArticle()` checks if content has an existing `apObjectId` stored, and if so, uses that instead of generating a new one
2. **New content gets new URI** — `https://domain/u/{username}/{type}/{slug}`
3. **Redirect chain** — `/content/{slug}` returns 301 to new dereference endpoint; remote instances follow redirect and cache new location
4. **Inbox handlers** — Parse both old (`/content/{slug}`) and new (`/u/{user}/{type}/{slug}`) URI formats

### Required Schema Addition
Add `apObjectUri` column to `contentItems` table to store the canonical AP object ID. Set it on creation, never change it. Old content gets backfilled with `https://domain/content/{slug}`.

---

## OPEN QUESTIONS
- Should `/u/{username}` remain the profile page? (Currently is — works fine)
- Future: vanity URLs like `/{username}/{slug}` without type? (Conflicts with `/{type}/{slug}`)
- User renames: add username history table + 301 redirects?
- Should old `/{type}/{slug}` show disambiguation page if multiple users would have same slug?

## ESTIMATED SCOPE
- ~44 files, ~69 code locations
- 3-4 focused sessions
- Phase 1 (additive) can ship in 1 session
- Phases 2-5 are a single coordinated deploy
- Phase 6 is cleanup
