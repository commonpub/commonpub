# URL Restructure — Complete Audit (5 Passes)

> Generated 2026-04-05 across 5 deep passes of the entire CommonPub monorepo.
> Covers: `/{type}/{slug}` → `/u/{username}/{type}/{slug}` for content items.

## Scope

**IN SCOPE:** Content items (project, article, blog, explainer) — user-authored, AP-federated.

**OUT OF SCOPE (no changes needed):**
- Hubs → `/hubs/{slug}` — community entities, not user-scoped
- Docs → `/docs/{siteSlug}` — site-level, not user-scoped  
- Learning → `/learn/{slug}` — separate namespace
- Contests → `/contests/{slug}` — separate namespace
- Products → `/products/{slug}` — separate namespace
- User profiles → `/u/{username}` — already user-scoped
- Mirror/federated → `/mirror/{id}` — remote content, no local slug

---

## MASTER INVENTORY

### A. Schema & Database

| # | File | Line | What | Change Required |
|---|------|------|------|-----------------|
| A1 | `packages/schema/src/content.ts` | 24 | `.unique()` on slug column | Replace with composite `unique('content_items_author_type_slug').on(t.authorId, t.type, t.slug)` |
| A2 | `packages/schema/src/content.ts` | 69 | `apObjectId: text('ap_object_id')` | Already exists, never populated — start writing it on content creation |
| A3 | `packages/schema/migrations/0000_slippery_marvex.sql` | 218 | `CONSTRAINT "content_items_slug_unique" UNIQUE("slug")` | Will be replaced by drizzle-kit push from updated schema |

### B. Slug Uniqueness

| # | File | Line | What | Change Required |
|---|------|------|------|-----------------|
| B1 | `packages/server/src/query.ts` | 55-79 | `ensureUniqueSlugFor()` — globally scoped | Add `authorId` scoping for contentItems table (keep global for hubs/docs/etc) |

### C. Content Lookup

| # | File | Line | What | Change Required |
|---|------|------|------|-----------------|
| C1 | `packages/server/src/content/content.ts` | 330-342 | `getContentBySlug(db, slug, requesterId)` | Add `username` + `type` params, query by `(authorId, type, slug)` |
| C2 | `packages/server/src/content/content.ts` | 464 | `getContentBySlug(db, item!.slug, authorId)` — after create | Update call |
| C3 | `packages/server/src/content/content.ts` | 525 | `getContentBySlug(db, slug, authorId)` — after update | Update call |
| C4 | `packages/server/src/content/content.ts` | 813 | `getContentBySlug(db, forked!.slug, userId)` — after fork | Update call |
| C5 | `packages/server/src/content/content.ts` | 860 | `getContentBySlug(db, forked!.slug, userId)` — after fork federated | Update call |
| C6 | `layers/base/server/api/content/[id]/index.get.ts` | 10 | `getContentBySlug(db, slugOrId, user?.id)` | Update call (this uses slug as lookup — backwards compat needed) |
| C7 | `layers/base/server/routes/content/[slug].ts` | 24,40 | AP dereference — `eq(contentItems.slug, slug)` | Keep for backwards compat (old AP URIs), add new route |

### D. URL Builder Functions (CREATE)

| # | File | What | Status |
|---|------|------|--------|
| D1 | `packages/server/src/query.ts` (or new file) | `buildContentPath(username, type, slug)` | CREATE — server-side |
| D2 | `packages/server/src/query.ts` (or new file) | `buildContentUrl(domain, username, type, slug)` | CREATE — server-side |
| D3 | `layers/base/composables/useContentUrl.ts` | `useContentUrl()` composable | CREATE — client-side |

### E. Federation URI Construction

| # | File | Line | Current Pattern | Change Required |
|---|------|------|-----------------|-----------------|
| E1 | `packages/protocol/src/contentMapper.ts` | 204 | `https://${domain}/content/${item.slug}` (AP object ID) | For NEW content: `https://${domain}/u/${author.username}/${item.type}/${item.slug}`. Old content: use stored `apObjectId` |
| E2 | `packages/protocol/src/contentMapper.ts` | 259 | `https://${domain}/${item.type}/${item.slug}` (AP url) | `https://${domain}/u/${author.username}/${item.type}/${item.slug}` |
| E3 | `packages/server/src/federation/federation.ts` | 664 | `https://${domain}/content/${slug}` (federateDelete) | Use stored `apObjectId` — never change published URI |
| E4 | `packages/server/src/federation/federation.ts` | 701 | `https://${domain}/content/${target[0].slug}` (federateComment inReplyTo) | Use stored `apObjectId` from target content |
| E5 | `packages/server/src/federation/federation.ts` | 776-778 | `buildContentUri(domain, slug)` definition | Update to accept username, type; or deprecate in favor of D2 |
| E6 | `packages/server/src/federation/hubFederation.ts` | 444-445 | `https://${domain}/${shared.type}/${shared.slug}` (hub share originUrl) | Need authorUsername in share payload |
| E7 | `layers/base/server/routes/hubs/[slug]/posts/[postId].ts` | 66-67 | `https://${domain}/${shared.type}/${shared.slug}` (hub post AP) | Need authorUsername in share payload |

### F. Inbox Handler URI Parsing

| # | File | Line | What | Change Required |
|---|------|------|------|-----------------|
| F1 | `packages/server/src/federation/inboxHandlers.ts` | 265-284 | onUndo — parse objectUri segments, lookup by slug | Parse both old `/content/{slug}` and new `/u/{user}/{type}/{slug}` |
| F2 | `packages/server/src/federation/inboxHandlers.ts` | 573-587 | onCreate — parse inReplyTo for parent slug | Parse both formats |
| F3 | `packages/server/src/federation/inboxHandlers.ts` | 794-835 | onLike — 6 fallback strategies | Add new URI pattern as strategy |
| F4 | `packages/server/src/federation/inboxHandlers.ts` | 843-860 | onLike — hub post pattern | No change (hub URIs unchanged) |
| F5 | `packages/server/src/federation/inboxHandlers.ts` | 884 | onLike — Announce Note segments | No change |
| F6 | `packages/server/src/federation/inboxHandlers.ts` | 956-975 | onAnnounce — parse objectUri | Parse both formats |

### G. Server Notification Links

| # | File | Line | Current | Change Required | authorUsername Available? |
|---|------|------|---------|-----------------|--------------------------|
| G1 | `packages/server/src/content/content.ts` | 720 | `/${result.type}/${result.slug}` (build notification) | Use buildContentPath() | ❌ Need to query author username |
| G2 | `packages/server/src/content/content.ts` | 807 | `/${item.type}/${item.slug}` (fork notification) | Use buildContentPath() | ❌ Need to query author username |
| G3 | `packages/server/src/social/social.ts` | 66 | `/${t.type}/${t.slug}` (like notification) | Use buildContentPath() | ❌ Need to add `users` join |
| G4 | `packages/server/src/social/social.ts` | 301 | `/${t.type}/${t.slug}` (comment notification) | Use buildContentPath() | ❌ Need to add `users` join |
| G5 | `packages/server/src/federation/inboxHandlers.ts` | 587 | `/content/${parentSlug}` (remote comment) | Use buildContentPath() | ❌ Need to add `users` join + type |
| G6 | `packages/server/src/federation/inboxHandlers.ts` | 812 | `/content/${idOrSlug}` (remote like) | Use buildContentPath() | ❌ Need to add `users` join + type |
| G7 | `packages/server/src/federation/inboxHandlers.ts` | 832 | `/content/${idOrSlug}` (remote like) | Use buildContentPath() | ❌ Need to add `users` join + type |
| G8 | `packages/server/src/federation/inboxHandlers.ts` | 975 | `/content/${idOrSlug}` (remote boost) | Use buildContentPath() | ❌ Need to add `users` join + type |

### H. API Endpoints Using buildContentUri

| # | File | Line | What | Change Required |
|---|------|------|------|-----------------|
| H1 | `layers/base/server/api/social/like.post.ts` | 23-25 | `getContentSlugById` → `buildContentUri` | Update to new signature with username |
| H2 | `layers/base/server/api/hubs/[slug]/share.post.ts` | 31-33 | `getContentSlugById` → `buildContentUri` | Update to new signature with username |

### I. Hub Share Payload (Data Flow Gap)

| # | File | Line | What | Change Required |
|---|------|------|------|-----------------|
| I1 | `packages/server/src/hub/posts.ts` | 718-725 | `shareContent()` JSON payload — no `authorUsername` | Add `authorUsername` to payload |
| I2 | `packages/server/src/hub/posts.ts` | 694-705 | `shareContent()` query — only selects from contentItems | Add `users` join for authorUsername |
| I3 | `packages/server/src/hub/posts.ts` | 186-189 | Share enrichment query — no authorUsername | Add authorUsername to enrichment |
| I4 | `layers/base/pages/hubs/[slug]/index.vue` | 69-76 | SharedContent mapping — no authorUsername | Add authorUsername to mapping |

### J. Learning Path Linked Content (Data Flow Gap)

| # | File | Line | What | Change Required |
|---|------|------|------|-----------------|
| J1 | `packages/server/src/learning/learning.ts` | 878-889 | `linkedContent` query — no authorUsername | Add `users` join |
| J2 | `packages/server/src/learning/learning.ts` | 845 | `linkedContent` type — no authorUsername field | Add field |

### K. Vue Templates — layers/base

| # | File | Line | Current Pattern |
|---|------|------|-----------------|
| K1 | `components/ContentCard.vue` | 54 | `` `/${props.item.type}/${props.item.slug}` `` |
| K2 | `components/hub/HubFeed.vue` | 64 | `` `/${post.sharedContent.type}/${post.sharedContent.slug}` `` |
| K3 | `components/views/ArticleView.vue` | 49 | `` `/auth/login?redirect=/article/${props.content.slug}` `` |
| K4 | `components/views/ArticleView.vue` | 72 | `` `${siteUrl}/article/${slug}` `` (SEO og:url) |
| K5 | `components/views/ArticleView.vue` | 210 | `` `/${item.type}/${item.slug}` `` (related) |
| K6 | `components/views/BlogView.vue` | 29 | `` `${siteUrl}/blog/${slug}` `` (SEO og:url) |
| K7 | `components/views/ProjectView.vue` | 52 | `` `${siteUrl}/project/${slug}` `` (SEO og:url) |
| K8 | `components/views/ProjectView.vue` | 271 | `` `/${result.type}/${result.slug}/edit` `` (fork navigate) |
| K9 | `components/views/ExplainerView.vue` | 113 | `` `${siteUrl}/explainer/${slug}` `` (SEO og:url) |
| K10 | `components/views/ExplainerView.vue` | 172 | `` `/${content.type}/${content.slug}/edit` `` |
| K11 | `components/views/ExplainerView.vue` | 215 | `` `/${content.type}/${content.slug}/edit` `` |
| K12 | `pages/index.vue` | 230 | `` `/${featured.items[0].type}/${featured.items[0].slug}` `` |
| K13 | `pages/dashboard.vue` | 205 | `` `/${item.type}/${item.slug}/edit` `` |
| K14 | `pages/dashboard.vue` | 213 | `` `/${item.type}/${item.slug}/edit` `` |
| K15 | `pages/dashboard.vue` | 229 | `` `/${item.type}/${item.slug}` `` |
| K16 | `pages/dashboard.vue` | 238 | `` `/${item.type}/${item.slug}/edit` `` |
| K17 | `pages/dashboard.vue` | 259 | `` `/${bm.content.type}/${bm.content.slug}` `` (bookmark) |
| K18 | `pages/admin/content.vue` | 55 | `` `/${item.type}/${item.slug}` `` |
| K19 | `pages/create.vue` | 66 | `` `/${t.type}/new/edit` `` |
| K20 | `pages/[type]/index.vue` | 34 | `` `/${contentType}/new/edit` `` |
| K21 | `pages/[type]/[slug]/index.vue` | 80 | `` `/${enrichedContent.type}/${enrichedContent.slug}/edit` `` |
| K22 | `pages/[type]/[slug]/edit.vue` | 222 | `history.replaceState` → `` `/${contentType}/${slug}/edit` `` |
| K23 | `pages/contests/[slug]/index.vue` | 292 | `` `/${entry.contentType}/${entry.contentSlug}` `` |
| K24 | `pages/contests/[slug]/judge.vue` | 85 | `` `/${entry.contentType}/${entry.contentSlug}` `` |
| K25 | `pages/learn/[slug]/[lessonSlug]/index.vue` | 229 | `` `/${linkedContent.type}/${linkedContent.slug}` `` |
| K26 | `pages/learn/[slug]/[lessonSlug]/edit.vue` | 225 | `` `/${lesson.type}/${linkedContent.slug}/edit` `` |

### L. Vue Templates — test-site

| # | File | Line | Current Pattern |
|---|------|------|-----------------|
| L1 | `components/ContentCard.vue` | 67 | `` `/${item.type}/${item.slug}` `` |
| L2 | `components/views/ArticleView.vue` | 41 | `` `/auth/login?redirect=/article/${slug}` `` |
| L3 | `components/views/ArticleView.vue` | 64 | `` `${siteUrl}/article/${slug}` `` (SEO) |
| L4 | `components/views/ArticleView.vue` | 198 | `` `/${item.type}/${item.slug}` `` (related) |
| L5 | `components/views/BlogView.vue` | 21 | `` `${siteUrl}/blog/${slug}` `` (SEO) |
| L6 | `components/views/ProjectView.vue` | 50 | `` `${siteUrl}/project/${slug}` `` (SEO) |
| L7 | `components/views/ProjectView.vue` | 187 | `` `/${result.type}/${result.slug}/edit` `` (fork) |
| L8 | `components/views/ExplainerView.vue` | 91 | `` `${siteUrl}/explainer/${slug}` `` (SEO) |
| L9 | `components/views/ExplainerView.vue` | 175 | `` `/${content.type}/${content.slug}/edit` `` |
| L10 | `pages/index.vue` | 193 | `` `/${featured.items[0].type}/${featured.items[0].slug}` `` |
| L11 | `pages/dashboard.vue` | 124 | `` `/${item.type}/${item.slug}/edit` `` |
| L12 | `pages/dashboard.vue` | 131 | `` `/${item.type}/${item.slug}/edit` `` |
| L13 | `pages/dashboard.vue` | 143 | `` `/${item.type}/${item.slug}` `` |
| L14 | `pages/dashboard.vue` | 151 | `` `/${item.type}/${item.slug}/edit` `` |
| L15 | `pages/dashboard.vue` | 165 | `` `/${bm.content.type}/${bm.content.slug}` `` |
| L16 | `pages/admin/content.vue` | 42 | `` `/${item.type}/${item.slug}` `` |
| L17 | `pages/create.vue` | 62 | `` `/${t.type}/new/edit` `` |
| L18 | `pages/[type]/index.vue` | 31 | `` `/${contentType}/new/edit` `` |
| L19 | `pages/[type]/[slug]/index.vue` | 88 | `` `/${enrichedContent.type}/${enrichedContent.slug}/edit` `` |
| L20 | `pages/[type]/[slug]/edit.vue` | 186 | `history.replaceState` → `` `/${contentType}/${slug}/edit` `` |
| L21 | `pages/[type]/[slug]/edit.vue` | 194 | `history.replaceState` → `` `/${contentType}/${slug}/edit` `` |
| L22 | `pages/learn/[slug]/[lessonSlug]/index.vue` | 215 | `` `/${linkedContent.type}/${linkedContent.slug}` `` |
| L23 | `pages/learn/[slug]/[lessonSlug]/edit.vue` | 225 | `` `/${lesson.type}/${linkedContent.slug}/edit` `` |

### M. Composables

| # | File | Line | Current Pattern |
|---|------|------|-----------------|
| M1 | `layers/base/composables/useContentSave.ts` | 111 | `history.replaceState` → `` `/${opts.contentType.value}/${result.slug}/edit` `` |
| M2 | `layers/base/composables/useContentSave.ts` | 118 | `history.replaceState` → `` `/${opts.contentType.value}/${updated.slug}/edit` `` |
| M3 | `layers/base/composables/useContentSave.ts` | 148 | `` `navigateTo(\`/${opts.contentType.value}/${result.slug}\`)` `` |
| M4 | `layers/base/composables/useContentSave.ts` | 154 | `` `navigateTo(\`/${opts.contentType.value}/${currentSlug}\`)` `` |
| M5 | `layers/base/composables/useContentSave.ts` | 206 | `` `navigateTo(\`/${opts.contentType.value}/${resultSlug}\`)` `` |

### N. Feed & Sitemap — layers/base

| # | File | Line | Current Pattern |
|---|------|------|-----------------|
| N1 | `server/routes/feed.xml.ts` | 30 | `` `${siteUrl}/${item.type}/${item.slug}` `` |
| N2 | `server/routes/sitemap.xml.ts` | 53 | `` `${siteUrl}/${item.type}/${item.slug}` `` |
| N3 | `server/api/users/[username]/feed.xml.get.ts` | 37 | `` `${siteUrl}/${item.type}/${item.slug}` `` |
| N4 | `server/api/users/[username]/feed.xml.get.ts` | 53 | `` `${siteUrl}/profile/${username}` `` (**BUG: should be `/u/`**) |
| N5 | `server/api/hubs/[slug]/feed.xml.get.ts` | 31 | `` `${siteUrl}/${item.type}/${item.slug}` `` |

### O. Feed & Sitemap — test-site

| # | File | Line | Current Pattern |
|---|------|------|-----------------|
| O1 | `server/routes/feed.xml.ts` | 30 | `` `${siteUrl}/${item.type}/${item.slug}` `` |
| O2 | `server/routes/sitemap.xml.ts` | 53 | `` `${siteUrl}/${item.type}/${item.slug}` `` |
| O3 | `server/api/users/[username]/feed.xml.get.ts` | 37 | `` `${siteUrl}/${item.type}/${item.slug}` `` |
| O4 | `server/api/hubs/[slug]/feed.xml.get.ts` | 31 | `` `${siteUrl}/${item.type}/${item.slug}` `` |

### P. Page Routes to Create/Move

| # | Current Path | New Path | Directories |
|---|-------------|----------|-------------|
| P1 | `pages/[type]/[slug]/index.vue` | `pages/u/[username]/[type]/[slug]/index.vue` | layers/base + test-site |
| P2 | `pages/[type]/[slug]/edit.vue` | `pages/u/[username]/[type]/[slug]/edit.vue` | layers/base + test-site |
| P3 | Old `pages/[type]/[slug]/*` | Keep as 301 redirects to new paths | layers/base + test-site |

### Q. AP Dereference Routes

| # | Current | New | Notes |
|---|---------|-----|-------|
| Q1 | `server/routes/content/[slug].ts` | Keep — serves old AP URIs, add redirect for browsers | Backwards compat |
| Q2 | — | `server/routes/u/[username]/[type]/[slug].ts` | CREATE — new AP dereference endpoint |

### R. SEO / JSON-LD `authorUrl`

| # | File | Line | Current |
|---|------|------|---------|
| R1 | `layers/base/components/views/ArticleView.vue` | 75 | `` `${siteUrl}/u/${author?.username}` `` |
| R2 | `layers/base/components/views/BlogView.vue` | 32 | `` `${siteUrl}/u/${author?.username}` `` |
| R3 | `layers/base/components/views/ProjectView.vue` | 55 | `` `${siteUrl}/u/${author?.username}` `` |
| R4 | `layers/base/components/views/ExplainerView.vue` | 116 | `` `${siteUrl}/u/${author?.username}` `` |

These are already correct (author profile URLs) — no change needed. Listed for completeness.

### S. Tests

**24 test files, ~150+ hardcoded URL instances.** Key files:

| # | File | ~Instances | Key Patterns |
|---|------|-----------|--------------|
| S1 | `protocol/__tests__/contentMapper.test.ts` | 8 | `/content/{slug}`, `/{type}/{slug}` |
| S2 | `protocol/__tests__/contentMapper.roundtrip.test.ts` | 4 | `/content/{slug}` |
| S3 | `protocol/__tests__/activities.test.ts` | 8 | `/content/{slug}` |
| S4 | `protocol/__tests__/activityTypes.test.ts` | 8 | `/content/{slug}` |
| S5 | `protocol/__tests__/inbox.test.ts` | 10 | `/content/{slug}` |
| S6 | `protocol/__tests__/outbox.test.ts` | 2 | `/content/{slug}` |
| S7 | `protocol/__tests__/interop/misskey.test.ts` | 10 | `/content/{slug}` |
| S8 | `protocol/__tests__/interop/mastodon.test.ts` | 8 | `/content/{slug}`, `/project/{slug}` |
| S9 | `protocol/__tests__/interop/gotosocial.test.ts` | 6 | `/content/{slug}` |
| S10 | `protocol/__tests__/sanitize.test.ts` | 1 | `/project/{slug}` in HTML |
| S11 | `server/__tests__/federation.integration.test.ts` | 4 | `/content/{slug}` |
| S12 | `server/__tests__/two-instance-federation.test.ts` | 8 | `/content/{slug}` |
| S13 | `server/__tests__/federation-content-types.integration.test.ts` | 4 | `/content/{slug}` |
| S14 | `server/__tests__/federated-timeline.integration.test.ts` | 20+ | `/content/{slug}`, `/{type}/{slug}` |
| S15 | `server/__tests__/hub-post-federation.test.ts` | 6 | `/content/{slug}`, `/{type}/{slug}` |
| S16 | `server/__tests__/delivery-retry.test.ts` | 16 | `/content/{slug}` |
| S17 | `server/__tests__/federation-production.integration.test.ts` | 12 | `/content/{slug}` |
| S18 | `server/__tests__/federation-hooks.integration.test.ts` | 10 | `/content/{slug}` |
| S19 | `server/__tests__/inbox-handlers.integration.test.ts` | 12 | `/content/{slug}` |
| S20 | `server/__tests__/outboxQueries.test.ts` | 5 | `/content/{slug}` |
| S21 | `server/__tests__/unified-content.test.ts` | 4 | `/content/{slug}` |
| S22 | `server/__tests__/hub-members.integration.test.ts` | 2 | `/{type}/{slug}` |
| S23 | `layers/base/components/__tests__/FederatedContentCard.test.ts` | 4 | `/{type}/{slug}` |
| S24 | `layers/base/composables/__tests__/useMirrorContent.test.ts` | 2 | `/{type}/{slug}` |

### T. Documentation

| # | File | Line | What |
|---|------|------|------|
| T1 | `docs/reference/guides/federation.md` | 131,135 | Example AP Article with old URL format |
| T2 | `docs/architecture.md` | 251 | Route structure documentation |
| T3 | `packages/server/README.md` | 24 | Usage example with `getContentBySlug` |

---

## DATA AVAILABILITY MATRIX

For each URL construction site, does it have `author.username` available without extra queries?

| Site | Has author.username? | Fix Needed |
|------|---------------------|------------|
| ContentCard.vue (K1, L1) | ✅ `item.author.username` | None |
| Dashboard (K13-K17, L11-L15) | ✅ `listContent()` joins users | None |
| Homepage featured (K12, L10) | ✅ `listContent()` joins users | None |
| Admin content (K18, L16) | ✅ `listContent()` joins users | None |
| Contest pages (K23-K24) | ✅ `entry.authorUsername` | None |
| View components (K3-K11, L2-L9) | ✅ `props.content.author.username` | None |
| Search results | ✅ `ContentSearchResult.authorUsername` | None |
| Meilisearch index | ✅ Already indexes `authorUsername` | None |
| Feed/sitemap (N1-N5, O1-O4) | ✅ `listContent()` joins users | None |
| contentToArticle() (E1-E2) | ✅ Receives `author.username` param | None |
| federateDelete() (E3) | ✅ Receives `authorUsername` param | None |
| useContentSave (M1-M5) | ⚠️ Needs current user's username | Add to composable opts |
| social.ts like notification (G3) | ❌ | Add `users` join |
| social.ts comment notification (G4) | ❌ | Add `users` join |
| content.ts build notification (G1) | ❌ | Query author username |
| content.ts fork notification (G2) | ❌ | Query author username |
| inboxHandlers notifications (G5-G8) | ❌ | Add `users` join + type |
| Hub share payload (I1-I4) | ❌ | Add to payload + mapping |
| Learning linkedContent (J1-J2) | ❌ | Add `users` join |
| federateComment parent (E4) | ❌ | Add `users` join for target |
| like.post.ts (H1) | ❌ | Need username for buildContentUri |
| share.post.ts (H2) | ❌ | Need username for buildContentUri |
| [type]/[slug]/edit.vue replaceState (K22, L20-L21) | ⚠️ Needs from route params | Available from new `/u/[username]/...` route |
| Create page (K19-K20, L17-L18) | ⚠️ Needs current user | Use `useAuth()` composable |

---

## PRE-EXISTING BUGS FOUND

| # | File | Line | Bug |
|---|------|------|-----|
| BUG1 | `layers/base/server/api/users/[username]/feed.xml.get.ts` | 53 | Uses `/profile/${username}` instead of `/u/${username}` — dead link |

---

## CONFIRMED NON-ISSUES

| Pattern | Why No Change Needed |
|---------|---------------------|
| `useEngagement.ts` share (line 154, 160) | Uses `window.location.href` — automatic when route changes |
| `NotificationItem.vue` (line 50/38) | Renders `notification.link` from server — server changes propagate |
| `notification-email.ts` (line 57, 138) | Prepends `siteUrl` to `notification.link` — server changes propagate |
| `/mirror/{id}` links | Federated content, no local slug |
| `useContentTypes.ts` routes | Type listing pages, not individual content |
| GDPR export (`profile/export.ts`) | Raw data only, no URL construction |
| deveco-io consumer | Inherits from layer, zero code changes |
| `canonicalUrl` column | Exists but never populated — not affected |
| `federated-hubs/[id]/index.vue:355` | Uses remote `originUrl`, not local paths |
| Meilisearch index | Already stores `authorUsername` |

---

## PASS 6 ADDITIONS

### L+ (additional test-site instances)

| # | File | Line | Current Pattern |
|---|------|------|-----------------|
| L24 | `test-site/pages/[type]/[slug]/edit.vue` | 230 | `navigateTo(\`/${contentType.value}/${result.slug}\`)` (publish new) |
| L25 | `test-site/pages/[type]/[slug]/edit.vue` | 235 | `navigateTo(\`/${contentType.value}/${slug.value}\`)` (publish existing) |
| L26 | `test-site/pages/[type]/[slug]/edit.vue` | 314 | `navigateTo(\`/${contentType.value}/${resultSlug}\`)` (publish after save) |

### Data Availability Confirmations

| Site | Has author.username? | Source |
|------|---------------------|--------|
| BookmarkItem (dashboard bookmarks) | ✅ | `social.ts:439` — joins users table |
| Product content list (products/[slug]) | ✅ | Uses `ContentCard` which has `item.author.username` |
| Related content (ArticleView) | ✅ | Uses `ContentCard` which has `item.author.username` |
| Contest entry data | ✅ | `contest.ts:284` — `authorUsername` field |

### Confirmed Non-Issues (Pass 6)

| Pattern | Why No Change Needed |
|---------|---------------------|
| Content body internal links | Stored in rich text HTML — user-authored links to external or internal paths. These are in stored content and would naturally point to old URLs. Could add a migration script later, but NOT blocking. |
| Fork chain UI | No "Forked from" UI implemented — `forkedFromId` column not in schema (only in-memory during fork operation) |
| Comment backlinks | Comments don't link to parent content in UI |
| Report system | Reports store `targetId` (UUID), not URLs |
| Admin deletion | No redirect to content URL after delete |
| Content versions | No version detail page exists |
| Admin federation page | No content URL links in federation admin |
| Route type validation | No validation on `[type]` param — accepts any string, 404s on invalid. Not a URL restructure concern. |

### Pre-Existing Bugs Found (Pass 6)

| # | File | Line | Bug |
|---|------|------|-----|
| BUG2 | `test-site/components/views/ArticleView.vue` | 10 | `useEngagement(contentId, contentType)` — positional args instead of object. Base layer version is correct. |

---

## GRAND TOTAL

| Category | Files | Instances |
|----------|-------|-----------|
| Schema & DB (A) | 2 | 3 |
| Slug uniqueness (B) | 1 | 1 |
| Content lookup (C) | 3 | 7 |
| URL builders to create (D) | 3 | 3 |
| Federation URI construction (E) | 4 | 7 |
| Inbox handler URI parsing (F) | 1 | 6 |
| Server notification links (G) | 3 | 8 |
| API endpoints (H) | 2 | 2 |
| Hub share data flow (I) | 3 | 4 |
| Learning linked content (J) | 1 | 2 |
| Vue templates — layers/base (K) | 17 | 26 |
| Vue templates — test-site (L) | 14 | 26 |
| Composables (M) | 1 | 5 |
| Feed/sitemap — layers/base (N) | 4 | 5 |
| Feed/sitemap — test-site (O) | 3 | 4 |
| Page routes (P) | 4 | 4 |
| AP dereference routes (Q) | 2 | 2 |
| SEO/JSON-LD (R) | 4 | 4 (no change) |
| Tests (S) | 24 | ~150 |
| Documentation (T) | 3 | 3 |
| **TOTAL** | **~94** | **~272** |
