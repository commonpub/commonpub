# Plan: User-Scoped Content URLs (`/u/{username}/{type}/{slug}`)

## Current State
- Content URLs: `/{type}/{slug}` (e.g., `/project/my-project`)
- Slugs are globally unique (one `my-project` across all users)
- Federation URIs: `https://domain/content/{slug}` (stored by remote instances)
- Schema: `contentItems.slug` has a global UNIQUE constraint

## Proposed State
- Content URLs: `/u/{username}/{type}/{slug}` (e.g., `/u/alice/project/my-project`)
- Slugs unique per (author, type) — multiple users can have `my-project`
- Federation URIs: `https://domain/u/{username}/{type}/{slug}`
- Schema: composite UNIQUE on `(authorId, type, slug)`

## Why
- Current slug dedup appends timestamps (`my-project-1712345678900`) — ugly
- Explainer template gives everyone "your-explainer-title" slug
- User-scoped URLs are the standard pattern (GitHub, Medium, dev.to, Hackster)
- Enables cleaner profiles: `/u/alice` shows all their content

## Impact Assessment

### CRITICAL — Federation Breaking Changes
These changes affect AP object URIs stored on remote instances.

| File | Line | Current | Change |
|------|------|---------|--------|
| `protocol/src/contentMapper.ts` | 204 | `https://domain/content/{slug}` | `https://domain/u/{username}/{type}/{slug}` |
| `protocol/src/contentMapper.ts` | 259 | `article.url = /{type}/{slug}` | `/u/{username}/{type}/{slug}` |
| `server/src/federation/federation.ts` | 664 | `federateDelete()` objectUri | Include username |
| `server/src/federation/federation.ts` | 701 | `federateComment()` inReplyTo | Include username |
| `server/src/federation/federation.ts` | 776 | `buildContentUri()` | Include username |

### HIGH — Inbox Handlers (Inbound Federation)
Remote instances send URIs in the OLD format. Must handle both.

| File | Line | Issue |
|------|------|-------|
| `server/src/federation/inboxHandlers.ts` | 573 | Parse `inReplyTo` to find parent content |
| `server/src/federation/inboxHandlers.ts` | 794-835 | `onLike()` — match objectUri to local content |
| `server/src/federation/inboxHandlers.ts` | 975 | `onAnnounce()` — same pattern |

### HIGH — Server Routes & API
| File | Change |
|------|--------|
| `layers/base/server/routes/content/[slug].ts` | AP dereference endpoint — must handle new URI pattern |
| `layers/base/server/routes/sitemap.xml.ts` | URL generation must join users table |
| `layers/base/server/routes/feed.xml.ts` | Same |
| `layers/base/server/api/content/[slug].get.ts` | Lookup by slug — needs author context |

### HIGH — Client-Side Pages & Links
| File | Change |
|------|--------|
| `layers/base/pages/[type]/[slug]/index.vue` | Move to `/pages/u/[username]/[type]/[slug]/index.vue` |
| `layers/base/pages/[type]/[slug]/edit.vue` | Move to `/pages/u/[username]/[type]/[slug]/edit.vue` |
| All components that link to content | Update URL construction |
| ContentCard.vue | Link format |
| Search results, related content | Link format |
| Notification links | Link format |

### MEDIUM — Schema Migration
1. Drop global UNIQUE on `contentItems.slug`
2. Add composite UNIQUE on `(authorId, type, slug)`
3. No data migration needed if existing slugs are globally unique (they are)

### MEDIUM — Slug Generation
| File | Change |
|------|--------|
| `server/src/query.ts` | `ensureUniqueSlugFor()` — scope to authorId |

## Federation Backwards Compatibility Strategy

**Non-negotiable requirement**: Existing federated content must still be resolvable.

### Approach: Dual-path resolution + redirects

1. **Keep the old route alive**: `GET /content/{slug}` returns 301 redirect to `/u/{username}/{type}/{slug}`
2. **New canonical route**: `GET /u/{username}/{type}/{slug}` returns AP JSON
3. **Inbox handlers**: Try new URI pattern first, fall back to old pattern for existing content
4. **New content**: Only generates new-format URIs
5. **Old content**: Retains old `objectUri` in AP, but human-facing URL redirects

### Migration Steps (ordered)

**Phase 1: Add new routes (non-breaking)**
1. Create `/pages/u/[username]/[type]/[slug]/` pages
2. Create `/server/routes/u/[username]/[type]/[slug].ts` AP endpoint
3. Add composite unique constraint (schema migration)
4. Update `ensureUniqueSlugFor()` to scope by author

**Phase 2: Update content creation (non-breaking)**
1. New content generates new-format objectUri
2. `contentToArticle()` uses new URI format
3. `buildContentUri()` accepts username parameter
4. Old content keeps old URIs

**Phase 3: Redirect old routes**
1. `/{type}/{slug}` → 301 to `/u/{username}/{type}/{slug}`
2. `/content/{slug}` → 301 to new AP endpoint
3. Update ContentCard, search results, etc. to use new URL format

**Phase 4: Update federation handlers**
1. Inbox handlers try both URI patterns
2. Notification links use new format
3. Sitemap, RSS use new format

## Open Questions
- Should `/u/{username}` be the profile page too? (Currently at `/u/[username]`)
- Should we support vanity URLs later? (e.g., `/{username}/{slug}` without type)
- How to handle user renames? (301 redirects from old username)
- Should the old `/{type}/{slug}` route show a disambiguation page if multiple users have the same slug?

## Estimated Scope
- ~30 files need changes
- ~15 are critical path (federation + routing)
- Can be done in 2-3 sessions with careful phase rollout
- Phase 1 is safe to ship independently (additive only)
