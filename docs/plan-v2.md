# CommonPub v2 — Production-Grade Master Plan

> Written 2026-03-15. Revised same day after deep re-examination of every schema
> table, every server function, every API route, every page, every component,
> every TipTap extension, every mockup HTML file, and every package.
>
> **Status as of 2026-04-02**: Phases 0-6 are **COMPLETE**. Phase 7 (Federation) is **COMPLETE** — all 7 sub-phases implemented in sessions 074-088. The "Current State" table below reflects the project at the time of writing (March 15) and is preserved for historical context. See session logs 071-102 for execution details.

---

## Current State (Audited)

| Layer | Count | Health |
|-------|-------|--------|
| Packages | 11 | All building, 881 tests passing |
| DB tables | 42 (+ `files` table with no consumer) | Schema complete but missing indexes, JSONB conversations, no product model |
| Server functions | ~120 | 92% real Drizzle queries. Contest judging unprotected. No follow CRUD. No profile update. No upload/storage. |
| API endpoints | ~97 | ~30 lack Zod validation. No upload route. No profile PUT. No user-facing reports. No RSS/sitemap. |
| Pages | ~42 | 5 match mockups (home, search, profile, community, layout). 12+ don't. |
| Components | ~27 + 4 editors + 4 views | 5 completely unused. Editors duplicate ~900 lines. |
| SEO | Partial | `useHead`/`useSeoMeta` in many pages. No JSON-LD, no sitemap, no RSS. |
| File uploads | Schema only | `files` table exists. Zero upload endpoints, zero storage adapter, zero image processing. |
| Real-time | None | Messaging/notifications are polling-only. No SSE/WebSocket. |
| Federation | Queued only | Activities created but nothing delivers them. Feature-flagged off. Correct for now. |

---

## Phase 0: Conceptual Model — COMPLETE

### 0.1 — The Hub Model

**Decision: Bring back "Hub" as the umbrella concept with typed variants.**

| Hub Type | Purpose | Examples | Key Features |
|----------|---------|----------|--------------|
| `community` | Maker group / topic space | "Edge AI Builders", "FPGA Enthusiasts" | Members, posts, discussions, moderation, explicit content sharing |
| `product` | Product/platform page | "Arduino Nano 33 BLE", "TensorFlow Lite", "KiCad" | Specs, purchase/download links, datasheet, **auto-populated project gallery via BOM**, discussions |
| `company` | Organization page | "Arduino", "Adafruit", "SparkFun" | Company info, team, product catalog (child product hubs), verification |

**Hub features matrix:**

| Feature | Community | Product | Company |
|---------|:---------:|:-------:|:-------:|
| Banner + description | Y | Y | Y |
| Members / followers | Y (join) | Y (follow) | Y (follow) |
| Feed / posts | Y | Y (discussions) | Y (announcements) |
| Moderation (bans/roles) | Y | Y | Y |
| Content gallery | via hubShares | **auto via BOM** | **auto via all child products** |
| Products tab | N | N (it IS a product) | Y (product catalog) |
| Specs / datasheet | N | Y | N |
| Purchase / download links | N | Y | N |
| Learning paths | Y | Y | Y |
| Contests | Y | N | Y |
| Parent hub | N | company | N |
| Child hubs | N | N | product hubs |
| Join policy (open/approval/invite) | Y | N (follow only) | N (follow only) |
| Invites | Y | N | N |
| Verification badge | N | Y (claimed) | Y (verified) |

### 0.2 — The BOM / Product Link

**The Hackster killer feature:** When you add a product to your project's parts list, your project automatically appears on that product's hub page and the parent company's hub page.

**Hybrid BOM model:**

The `contentItems.parts` JSONB array stays for fast display. A new normalized `products` table + `contentProducts` join table provides the relational backbone.

When editing a project's parts list:
1. User types in the parts list input
2. Autocomplete searches the product catalog (`/api/products?q=...`)
3. If user selects a catalog product → stores `productId` in the JSONB part AND creates a `contentProducts` row
4. If user types a freeform entry (generic resistor, wire, etc.) → JSONB only, no `contentProducts` row

This gives us:
- **Fast display:** read the JSONB array (no joins)
- **Gallery queries:** `SELECT content FROM contentProducts WHERE productId IN (SELECT id FROM products WHERE hubId = ?)`
- **Flexibility:** not every part needs a catalog entry

### 0.3 — Remove `guide` content type

The enum includes 'guide' but there is no guide editor, no guide view, no guide mockup. It adds confusion.

- Remove 'guide' from `contentTypeEnum` in enums.ts
- Remove 'guide' from all polymorphic target enums (`likeTargetTypeEnum`, etc.)
- Remove from Zod validators
- Any existing content with type='guide' treated as 'article' (no prod data exists)

### 0.4 — Organizations table

The `organizations` and `members` tables in `auth.ts` are **Better Auth's built-in organization feature**. They stay as-is for auth/multi-tenant access control. Company hubs are a separate concept in the `hubs` table. They can be linked later (orgId on hub) but are not coupled.

### 0.5 — Migration strategy: Two-step rename

Renaming `communities` → `hubs` across the entire codebase is risky if done all at once.

**Step A (code rename, no DB change):**
- Rename all TypeScript symbols: `communities` → `hubs`, `communityMembers` → `hubMembers`, etc.
- Keep Drizzle `pgTable('communities', ...)` pointing at old DB table names
- Rename files, API routes, page routes, types
- All 881 tests pass against existing DB schema

**Step B (DB rename, no code change):**
- Generate Drizzle migration: `ALTER TABLE communities RENAME TO hubs`, etc.
- All code already uses new names — migration is mechanical
- Run on dev, verify, then on prod

This isolates the risk: Step A is pure refactor (testable), Step B is pure migration (reversible).

---

## Phase 1: Schema Evolution — COMPLETE

### 1.1 — Hub rename + type discriminator

**Schema changes (`packages/schema/src/`):**

Rename `community.ts` → `hub.ts`. Rename all table definitions and relations:
- `communities` → `hubs` (Drizzle symbol; DB table stays `communities` in Step A)
- `communityMembers` → `hubMembers`
- `communityPosts` → `hubPosts`
- `communityPostReplies` → `hubPostReplies`
- `communityBans` → `hubBans`
- `communityInvites` → `hubInvites`
- `communityShares` → `hubShares`

**New columns on `hubs`:**
```
hubType         hub_type enum ('community' | 'product' | 'company') DEFAULT 'community' NOT NULL
parentHubId     uuid FK → hubs.id NULLABLE  — product hubs owned by company hubs
website         varchar(512) NULLABLE        — product/company URLs
categories      jsonb NULLABLE               — string[] for topic filtering
privacy         hub_privacy enum ('public' | 'unlisted' | 'private') DEFAULT 'public'
```

**New enums in `enums.ts`:**
```
hubTypeEnum: 'community' | 'product' | 'company'
hubPrivacyEnum: 'public' | 'unlisted' | 'private'
```

Rename existing enums:
- `communityRoleEnum` → `hubRoleEnum`
- `communityJoinPolicyEnum` → `hubJoinPolicyEnum`

**New column on `hubMembers`:**
```
status          hub_member_status enum ('pending' | 'active') DEFAULT 'active'
```

**New column on `hubPosts`:**
```
lastEditedAt    timestamp NULLABLE
```

**Cascade rename through:**
- `packages/server/src/community.ts` → `hub.ts` (all function names)
- `packages/server/src/types.ts` (all type names)
- `packages/server/src/utils.ts` (permission helpers)
- `packages/server/src/index.ts` (re-exports)
- `apps/reference/server/api/communities/` → `hubs/` (all route files)
- `apps/reference/pages/communities/` → `hubs/` (all page files)
- `apps/reference/components/` (any imports)
- `packages/config/` (feature flags)
- All test files referencing "community"

### 1.2 — Product catalog

New file: `packages/schema/src/product.ts`

**`products` table:**
```
id              uuid PK
name            varchar(255) NOT NULL
slug            varchar(255) NOT NULL UNIQUE
description     text
hubId           uuid FK → hubs.id NOT NULL
                  — Points to the hub that owns this product.
                  — For products WITH their own hub page: hubId = the product hub
                  — For products WITHOUT a page: hubId = the company hub
category        product_category enum
specs           jsonb            — flexible key-value: { "processor": "Xtensa LX7", "ram": "512KB", ... }
imageUrl        text
purchaseUrl     text             — primary buy/download link
datasheetUrl    text
alternatives    jsonb            — [{ productId: uuid, reason: string }]
pricing         jsonb            — { min: number, max: number, currency: string, asOf: string }
status          product_status enum ('active' | 'discontinued' | 'preview') DEFAULT 'active'
createdById     uuid FK → users.id — who added this product to the catalog
createdAt       timestamp
updatedAt       timestamp
```

**`contentProducts` join table (the BOM link):**
```
id              uuid PK
contentId       uuid FK → contentItems.id ON DELETE CASCADE
productId       uuid FK → products.id ON DELETE CASCADE
quantity        integer DEFAULT 1
role            varchar(64)   — 'main_board', 'sensor', 'power', 'software', 'tool', 'other'
notes           text          — user's notes on this specific usage
required        boolean DEFAULT true
sortOrder       integer DEFAULT 0
createdAt       timestamp
UNIQUE(contentId, productId)
```

**New enums:**
```
productStatusEnum: 'active' | 'discontinued' | 'preview'
productCategoryEnum: 'microcontroller' | 'sbc' | 'sensor' | 'actuator' | 'display' |
                     'communication' | 'power' | 'mechanical' | 'software' | 'tool' | 'other'
```

**Gallery query for a product hub:**
```sql
SELECT ci.* FROM content_items ci
JOIN content_products cp ON ci.id = cp.content_id
JOIN products p ON cp.product_id = p.id
WHERE p.hub_id = :productHubId AND ci.status = 'published'
ORDER BY ci.published_at DESC
```

**Gallery query for a company hub (aggregates all child products):**
```sql
SELECT DISTINCT ci.* FROM content_items ci
JOIN content_products cp ON ci.id = cp.content_id
JOIN products p ON cp.product_id = p.id
JOIN hubs h ON p.hub_id = h.id
WHERE (h.id = :companyHubId OR h.parent_hub_id = :companyHubId)
  AND ci.status = 'published'
ORDER BY ci.published_at DESC
```

### 1.3 — Schema hardening

**Indexes (add via Drizzle `.index()` or migration):**
```sql
-- Content hot paths
CREATE INDEX idx_content_author ON content_items(author_id);
CREATE INDEX idx_content_type_status ON content_items(type, status);
CREATE INDEX idx_content_published ON content_items(published_at DESC) WHERE status = 'published';

-- Hub hot paths
CREATE INDEX idx_hub_posts_created ON hub_posts(hub_id, created_at DESC);
CREATE INDEX idx_hub_shares_hub ON hub_shares(hub_id);
CREATE INDEX idx_hub_shares_content ON hub_shares(content_id);

-- Social hot paths
CREATE INDEX idx_comments_target ON comments(target_type, target_id);
CREATE INDEX idx_likes_target ON likes(target_type, target_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- Product hot paths
CREATE INDEX idx_content_products_product ON content_products(product_id);
CREATE INDEX idx_content_products_content ON content_products(content_id);
CREATE INDEX idx_products_hub ON products(hub_id);

-- Learning hot paths
CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_path ON enrollments(path_id);
CREATE INDEX idx_lesson_progress_user ON lesson_progress(user_id, lesson_id);

-- Federation
CREATE INDEX idx_activities_pending ON activities(status) WHERE status = 'pending';
```

**Normalize conversations:**

New join table `conversationParticipants`:
```
conversationId  uuid FK → conversations.id ON DELETE CASCADE
userId          uuid FK → users.id ON DELETE CASCADE
joinedAt        timestamp DEFAULT now
leftAt          timestamp NULLABLE
PRIMARY KEY (conversationId, userId)
```
- Index on `userId` for "find my conversations" query
- Migrate existing JSONB `participants` arrays into this table
- Keep `participants` JSONB temporarily for backward compat, deprecate

**New columns on existing tables:**

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `users` | `pronouns` | varchar(32) | Inclusivity |
| `users` | `timezone` | varchar(64) | Notification scheduling |
| `users` | `emailNotifications` | jsonb | `{ digest: 'daily'|'weekly'|'none', likes: bool, comments: bool, follows: bool, mentions: bool }` |
| `contentItems` | `licenseType` | varchar(32) | MIT, CC-BY-SA, Apache-2.0, proprietary, etc. |
| `contentItems` | `series` | varchar(128) | Multi-part content grouping |
| `contentItems` | `estimatedMinutes` | integer | Read/build time |
| `contentItems` | `canonicalUrl` | text NULLABLE | Federation: original URL if mirrored |
| `contentItems` | `apObjectId` | text NULLABLE | Federation: AP object URI |
| `hubs` | `apActorId` | text NULLABLE | Federation: AP Group actor URI |
| `files` | `contentId` | uuid FK → contentItems.id NULLABLE | Link files to content |
| `files` | `hubId` | uuid FK → hubs.id NULLABLE | Link files to hubs |
| `files` | `width` | integer NULLABLE | Image dimensions |
| `files` | `height` | integer NULLABLE | Image dimensions |
| `files` | `originalName` | varchar(255) | Original filename before storage key |

**Soft delete pattern:**

Add `deletedAt` timestamp (nullable) to: `users`, `contentItems`, `hubs`, `hubPosts`
- All queries add `WHERE deleted_at IS NULL`
- Delete operations set `deletedAt = now()` instead of hard delete
- Child records (shares, tags, join tables) still hard cascade

**Content versioning:**

New table `contentVersions`:
```
id              uuid PK
contentId       uuid FK → contentItems.id ON DELETE CASCADE
version         integer NOT NULL
title           varchar(255)
content         jsonb
metadata        jsonb  — snapshot of all metadata at time of publish
createdById     uuid FK → users.id
createdAt       timestamp
```
- Auto-created each time content transitions to `status = 'published'`
- Not on every save — only on publish
- Provides history of published versions

### 1.4 — Validators

Add to `packages/schema/src/validators.ts`:

**Hub:** `createHubSchema`, `updateHubSchema`
**Product:** `createProductSchema`, `updateProductSchema`
**Contest:** `createContestSchema`, `updateContestSchema`, `judgeEntrySchema`
**Video:** `createVideoSchema`, `createVideoCategorySchema`
**Learning:** `createLearningPathSchema`, `updateLearningPathSchema`, `createModuleSchema`, `updateModuleSchema`, `createLessonSchema`, `updateLessonSchema`
**Docs:** `createDocsSiteSchema`, `updateDocsSiteSchema`, `createDocsPageSchema`, `updateDocsPageSchema`, `createDocsVersionSchema`
**Messaging:** `createConversationSchema`, `sendMessageSchema`
**Profile:** `updateProfileSchema`
**Social:** `createReportSchema`, `createReplySchema`, `createInviteSchema`, `banUserSchema`
**Admin:** `adminUpdateRoleSchema`, `adminUpdateStatusSchema`, `adminSettingSchema`

Every POST/PUT endpoint will validate against these before calling server functions.

---

## Phase 2: Server Layer — COMPLETE

### 2.1 — Hub + product functions

In `packages/server/src/hub.ts` (renamed from community.ts):

**Product management:**
- `createProduct(hubId, input)` — add product to hub catalog
- `updateProduct(productId, input)` — edit product specs/links
- `deleteProduct(productId)` — remove product
- `getProductBySlug(slug)` — product detail with specs, hub info
- `listHubProducts(hubId)` — all products belonging to a hub
- `searchProducts(query, filters)` — global product catalog search with category/status filters

**Content ↔ product linking (BOM):**
- `addContentProduct(contentId, productId, opts)` — link content to product
- `removeContentProduct(contentId, productId)` — unlink
- `listContentProducts(contentId)` — all products used by content item
- `syncContentProducts(contentId, products[])` — bulk sync BOM (used by editor save)

**Gallery:**
- `listProductContent(productId, opts)` — all published content using this product
- `listHubGallery(hubId, opts)` — all content associated with hub:
  - For community hubs: content from `hubShares`
  - For product hubs: content from `contentProducts` where product.hubId = hubId
  - For company hubs: content from `contentProducts` where product.hubId IN (hubs with parentHubId = hubId)
  - Deduplicated, paginated, sorted by publishedAt

**Hub claiming:**
- `claimProductHub(userId, hubId)` — request to claim ownership of product/company hub (creates admin review ticket)

### 2.2 — Missing server functions

**Profile:**
- `updateUserProfile(userId, input)` — update bio, headline, skills, social links, avatar, banner, pronouns, timezone, notification prefs
- `getUserByEmail(email)` — for auth lookup

**Follow system (local):**
- `followUser(followerId, followingId)` — create follow + notification
- `unfollowUser(followerId, followingId)` — remove follow
- `isFollowing(followerId, followingId)` — boolean check
- `listFollowers(userId, opts)` — paginated with user details
- `listFollowing(userId, opts)` — paginated with user details

**Content reporting (user-facing):**
- `createReport(reporterId, input)` — submit report with reason and description

**File uploads:**
- `createFile(uploaderId, file, purpose)` — store file metadata + upload to storage
- `deleteFile(fileId, userId)` — remove file + delete from storage
- `listUserFiles(userId, purpose?)` — list user's uploaded files

**Storage adapter interface** (in `packages/server/src/storage.ts`):
```ts
interface StorageAdapter {
  upload(key: string, data: Buffer | ReadableStream, mimeType: string): Promise<string>  // returns URL
  delete(key: string): Promise<void>
  getUrl(key: string): string
}
```
Implementations:
- `LocalStorageAdapter` — saves to `./uploads/`, serves via Nitro static route. For dev.
- `S3StorageAdapter` — S3-compatible (AWS S3, MinIO, Cloudflare R2). For production.
- Configured via `commonpub.config.ts` storage feature flag.

**Image processing** (in `packages/server/src/image.ts`):
- On upload: validate type/size → generate thumbnails (150px, 300px, 600px) → convert to WebP → store all variants
- Uses `sharp` (Node.js image processing)
- Returns variant URLs in file metadata

**Contest fixes:**
- `deleteContest(contestId, userId)` — with ownership check
- `transitionContestStatus(contestId, newStatus)` — state machine: upcoming → active → judging → completed
- `calculateContestRanks(contestId)` — sort entries by score, set rank field
- Fix `judgeContestEntry()`: verify userId is in contest.judges array
- Fix `submitContestEntry()`: verify content exists, is published, user owns content

**Video category CRUD:**
- `createVideoCategory(input)`, `updateVideoCategory(id, input)`, `deleteVideoCategory(id)`

**Learning path ratings:**
- `rateLearningPath(userId, pathId, score, review)` — 1-5 star + text review
- `listPathReviews(pathId, opts)` — paginated reviews with user info

**Global search:**
- `globalSearch(query, filters)` — unified search across content, hubs, users, products, learning paths
- Uses Postgres FTS initially; Meilisearch adapter when available (per `@commonpub/docs` pattern)

**Content versioning:**
- `createContentVersion(contentId, userId)` — snapshot current state
- `listContentVersions(contentId)` — version history
- `getContentVersion(versionId)` — specific version detail
- Called automatically by `publishContent()` before status transition

### 2.3 — Server hardening

**Every function must:**
1. Validate inputs via Zod schema (from 1.4) at entry
2. Check authorization (ownership or role)
3. Return typed results (zero `any`)
4. Handle edge cases (not found, already exists, no permission)
5. Use transactions for multi-table writes
6. Log audit entries for destructive operations
7. Wrap denormalized counter updates in same transaction as the related operation

**Specific fixes needed:**
- `judgeContestEntry()`: Check userId in contest.judges array
- `submitContestEntry()`: Verify content published + user owns it
- `updateContest()`: Add ownership check
- `getContentBySlug()`: Enforce `visibility: 'members'` against hub membership
- `deleteComment()`: Also handle comment-on-community-post case for counter decrement

---

## Phase 3: API Layer — COMPLETE

### 3.1 — New endpoints

**File uploads:**
- `POST /api/files/upload` — multipart upload, returns file metadata
- `DELETE /api/files/:id` — delete file (ownership check)
- `GET /api/files/mine` — list authenticated user's files

**Profile:**
- `GET /api/profile` — authenticated user's own profile
- `PUT /api/profile` — update own profile (validated)

**Follows:**
- `POST /api/users/:username/follow`
- `DELETE /api/users/:username/follow`
- `GET /api/users/:username/followers`
- `GET /api/users/:username/following`

**Content reporting:**
- `POST /api/content/:id/report`

**Products:**
- `GET /api/products` — search/browse product catalog
- `GET /api/products/:slug` — product detail
- `POST /api/hubs/:slug/products` — add product to hub (hub admin/owner)
- `PUT /api/products/:id` — update product
- `DELETE /api/products/:id` — delete product
- `GET /api/products/:slug/content` — project gallery for product

**Hub gallery:**
- `GET /api/hubs/:slug/gallery` — unified gallery (via products + shares)

**Content BOM:**
- `GET /api/content/:id/products` — list products in content's BOM
- `POST /api/content/:id/products` — add product to BOM
- `DELETE /api/content/:id/products/:productId` — remove from BOM
- `PUT /api/content/:id/products` — bulk sync BOM (editor save)

**Video categories:**
- `POST /api/videos/categories` (admin)
- `PUT /api/videos/categories/:id` (admin)
- `DELETE /api/videos/categories/:id` (admin)

**Content versioning:**
- `GET /api/content/:id/versions` — version history
- `GET /api/content/:id/versions/:versionId` — specific version

**Contest management:**
- `DELETE /api/contests/:slug`
- `POST /api/contests/:slug/transition`

**RSS feeds:**
- `GET /api/feed.xml` — site-wide recent published content
- `GET /api/users/:username/feed.xml` — user's published content
- `GET /api/hubs/:slug/feed.xml` — hub content/gallery

**Sitemap:**
- `GET /sitemap.xml` — generated from published content, hubs, users, learning paths

### 3.2 — Validation sweep

Add Zod validation to every unvalidated POST/PUT endpoint (25 endpoints identified in audit — see full list in Phase 3.2 of previous version). Every body is parsed through the schema from 1.4 before reaching server functions.

### 3.3 — API consistency

- Standardize all error responses: `{ statusCode: number, statusMessage: string, data?: unknown }`
- All list endpoints: support `limit` + `offset` params, return `{ items: T[], total: number }`
- All timestamps: ISO 8601 strings
- All IDs: UUIDs
- Rate limiting: return `Retry-After` header on 429
- Pagination: default limit 20, max 100

### 3.4 — SEO

Many pages already use `useHead()` / `useSeoMeta()`. Additions needed:
- **JSON-LD structured data** on view pages:
  - Article → `schema.org/Article`
  - Project → `schema.org/HowTo`
  - Learning path → `schema.org/Course`
  - Video → `schema.org/VideoObject`
  - Profile → `schema.org/Person`
  - Hub → `schema.org/Organization` (company) or `schema.org/Project` (product)
- **OG image generation** — dynamic OG images for content (title + author + cover image composited)
- **Sitemap** — auto-generated, submitted to search engines
- **Canonical URLs** on all content pages
- **Robots.txt** with sitemap reference

---

## Phase 4: Frontend — Match Every Mockup — COMPLETE

**Rule: Read the actual mockup HTML file FIRST, then compare with the Vue page, then fix.**

### 4.1 — View pages (highest visual impact)

Current `[type]/[slug]/index.vue` is generic. Need type-specific rendering.

| Content Type | Mockup | Key Sections |
|-------------|--------|--------------|
| Article | `08-view-article.html` | Cover hero, reading time, TOC sidebar, prose body, author card, series nav, comment section |
| Blog | `09-view-blog.html` | Cover image hero, personal narrative tone, reading time, author bio footer, related posts |
| Explainer | `10-view-explainer.html` | **Progress bar at top**, sidebar TOC with completion checkmarks, interactive slider cards, quiz blocks with answer validation, math notation blocks, section navigation, checkpoints that animate in |
| Project | `11-view-project.html` | Cover, metadata bar (difficulty/time/cost badges), tags, **BOM/parts list with product hub links**, build steps with numbered sections, file downloads, tools list, comment section |

The project view is critical because it's where **BOM → product hub links** become visible to users.

### 4.2 — Hub page (3 variants)

Rebuild `pages/hubs/[slug].vue` with type-switching:

**Community hub tabs:** Feed (with counts), Projects (from hubShares), Discussions, Learn, Members, Events (placeholder)
**Product hub tabs:** Overview (specs grid + purchase link + datasheet), Projects Using This (auto-gallery), Discussions, Documentation
**Company hub tabs:** Overview (about + team), Products (catalog grid), Projects (aggregate gallery), Discussions

### 4.3 — Other pages to match mockups

| Page | Mockup | Priority |
|------|--------|----------|
| Contest page | `14-contest-page.html` | High — countdown, prizes, entry gallery, judges, rules |
| Learning system | `15-learning-system.html` | High — path cards with progress, module accordion, ProgressTracker |
| Video hub | `16-video-hub.html` | Medium — featured video, grid, categories, live sidebar, playlists |
| Profile editor | `07-editor-profile.html` | Medium — full settings with sections |

### 4.4 — Editor consolidation + product catalog integration

**Consolidation:** Replace 4 duplicate editors with config-driven `EditorShell.vue`:

```ts
interface EditorConfig {
  type: ContentType
  panels: {
    left?: { type: 'block-library' | 'structure'; blocks: BlockDef[] }
    right: { sections: PanelSection[] }
  }
  canvas: { showCover: boolean; showMetaRow: boolean; showTags: boolean; maxWidth: string }
}
```

Each content type provides a config object. Shared behavior (tags, section collapse, visibility, cover upload) lives in EditorShell. Specialized behavior (explainer modules, project parts list) lives in small sub-components.

**Product catalog integration in parts-list:**

The TipTap `partsList` extension currently stores `{ name, qty, price?, url?, category?, required? }`. Add `productId?: string` to the part schema.

When user edits the parts list in the project editor:
1. Parts list panel shows an input with autocomplete
2. Autocomplete hits `GET /api/products?q=...`
3. Selecting a result fills in name, url, price from the product AND sets productId
4. On save, `edit.vue` calls `PUT /api/content/:id/products` to sync the contentProducts join table from the parts list JSONB
5. This is what creates the gallery associations

The `toolList` extension gets the same treatment — tools can be software products, IDE plugins, etc.

### 4.5 — Wire up unused components

| Component | Target Page |
|-----------|-------------|
| `VideoCard.vue` | Video hub (replace inline markup) |
| `ProgressTracker.vue` | Learning path detail |
| `SortSelect.vue` | Search, content listings, hub galleries |
| `StatBar.vue` | Profile hero stats, hub stats |
| `AnnouncementBand.vue` | Default layout (from admin instance settings) |
| `TOCNav.vue` | Article view sidebar, explainer view sidebar |
| `CommentSection.vue` | All view pages |
| `CountdownTimer.vue` | Contest page hero |
| `MessageThread.vue` | Messages conversation page |
| `NotificationItem.vue` | Notifications page |
| `SectionHeader.vue` | All section dividers |

### 4.6 — Real-time

**Notifications:** Server-Sent Events (SSE)
- `GET /api/notifications/stream` — Nitro SSE route
- Client: `useEventSource()` composable
- On new notification: push to reactive notification count in layout

**Messaging:** WebSocket
- `GET /api/messages/:conversationId/ws` — Nitro WebSocket route
- Client: `useWebSocket()` composable
- Bi-directional: send message + receive messages in real-time

### 4.7 — Remove dead code

After wiring up all components, audit and remove any truly unused components, composables, and utilities.

---

## Phase 5: Data & Testing — COMPLETE

### 5.1 — Seed script

Create `apps/reference/server/seed.ts`:

**Users (10):** Realistic profiles with skills, experience, social links, locations, headlines
**Company hubs (3):** Arduino, Espressif, Raspberry Pi Foundation
**Product hubs (10):** Arduino Nano 33 BLE, ESP32-S3-DevKitC-1, RPi 5, Coral USB Accelerator, etc. Each with specs, purchase URLs, datasheets
**Products (15):** Including some without their own hub page (generic parts)
**Community hubs (3):** Edge AI Builders, FPGA Enthusiasts, AfricaTech Makers — with members, posts, discussions
**Content (30+):** 8 projects (with BOM referencing products), 6 articles, 5 blogs, 4 explainers (with sections/quizzes), 7 guides-as-articles
**Content-product links:** Projects linked to products via contentProducts
**Contests (2):** One active with countdown, one completed with entries and scores
**Videos (10):** Across categories (tutorial, talk, demo, stream, review)
**Learning paths (2):** With modules, lessons, enrollments, some progress
**Social:** Comments, likes, follows, bookmarks scattered realistically
**Notifications:** For several users
**Messages:** 2 conversations with back-and-forth

### 5.2 — Unit test gaps

- Product CRUD, BOM linking, gallery queries
- Hub type-specific behavior (community vs product vs company features)
- Contest state machine + judge authorization
- Content visibility enforcement by hub membership
- Denormalized counter accuracy under concurrent operations
- Soft delete behavior (queries filter, cascade works)
- Follow system CRUD + notification creation
- File upload + storage adapter
- Content versioning on publish
- Conversation normalization (participant join table)

### 5.3 — E2E tests (Playwright)

**Flow 1: Content + BOM lifecycle**
Register → Create project → Add products to BOM from catalog → Save → Publish → Verify project appears in product hub gallery → View project → Parts list shows product links → Comment → Like → View profile → project in content tab

**Flow 2: Hub lifecycle**
Create community hub → Invite member → Member joins → Create post → Reply → Pin post → Share content → Content appears in hub → Browse hub gallery

**Flow 3: Learning lifecycle**
Browse paths → Enroll → Complete lessons → Progress bar updates → Finish path → Certificate issued → Certificate verifiable by code

**Flow 4: Discovery**
Search by keyword → Results across content, hubs, products → Filter by type → Browse product hub → See project gallery → Click through to project

### 5.4 — Component tests

For every `@commonpub/ui` component:
- Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- Screen reader (axe-core violations = 0)
- All interactive states (hover, focus, active, disabled)
- Props/slots contract
- Responsive breakpoints

---

## Phase 6: Production Hardening — COMPLETE

### 6.1 — Security
- [x] CSP headers (implemented in security.ts)
- [x] Rate limiting (implemented, needs per-endpoint tuning)
- [x] Input sanitization: DOMPurify on editor HTML output (session 036)
- [x] File upload validation: MIME type whitelist, max size (session 036)
- [x] CORS: configured in nuxt.config.ts routeRules (session 040)
- [ ] Session rotation on role/status change
- [x] Audit log for all admin actions

### 6.2 — Performance
- [ ] DB indexes (Phase 1.3)
- [ ] Connection pooling (Drizzle pool config or PgBouncer)
- [ ] Cache headers: immutable for hashed assets, stale-while-revalidate for public content
- [ ] Lazy-load: editors, explainer interactives, heavy components
- [x] Image optimization: WebP variants via sharp (session 036)
- [x] Pagination: enforced on search, videos, content listings (session 040)
- [ ] Meilisearch: for search pages when Postgres FTS becomes bottleneck

### 6.3 — Email
- [x] Email adapter interface via Better Auth emailSender callbacks (session 039)
- [x] Email verification on signup (session 039 — ConsoleEmailAdapter for dev)
- [x] Password reset flow (session 039 — forgot-password/reset-password pages)
- [ ] Notification digest emails (daily/weekly configurable per user)
- [ ] Contest announcement emails
- [ ] Certificate issuance emails
- [ ] Simple template system (header + body + footer, CSS inline)
- [ ] Production email provider (Resend/SendGrid/SES)

### 6.4 — Observability
- [ ] Structured logging (pino)
- [ ] Request correlation IDs
- [ ] Error tracking integration point (Sentry-compatible)
- [ ] Health check at `/api/health` (exists)
- [ ] Readiness check: DB connection + migration status

### 6.5 — Deployment
- [x] Docker Compose: Postgres 16 + Redis + Meilisearch (deploy/docker-compose.yml)
- [x] `.env.example` with all required variables documented
- [ ] Migration runner in CI pipeline
- [ ] Backup/restore scripts for Postgres
- [x] Nginx config with SSL termination (deploy/nginx.conf)
- [ ] Systemd service file for bare-metal deploys

### 6.6 — Documentation
- [ ] OpenAPI spec auto-generated from Zod schemas
- [x] Self-hosting guide (docs/deployment.md — Docker, DO App Platform, Supabase, generic Docker)
- [x] Contributing guide (docs/contributing.md)
- [x] Reference documentation (docs/reference/ — 30+ files covering all packages, server modules, guides)
- [x] ADRs 001-026 covering all major architectural decisions
- [x] Feature flags reference (docs/reference/guides/feature-flags.md)
- [ ] API endpoint reference (auto-generated)

---

## Phase 7: Federation (Post-Launch) — COMPLETE

**Per CLAUDE.md rule #10: "No federation before two instances exist with real content."**

### 7.1 — Activity delivery worker
- Nitro task or separate process that polls `activities` table for `status = 'pending'`
- HTTP POST to target inbox with HTTP Signatures
- Retry with exponential backoff (max 5 attempts)
- Mark delivered/failed
- Activity deduplication by AP object ID

### 7.2 — Hub federation (AP Group)
- Each hub = AP Group actor (identified by `hubs.apActorId`)
- Follow a hub = AP Follow → hub's Group actor
- Content published to hub = AP Create → all hub followers' inboxes
- Hub discovery: WebFinger `@hub-slug@instance.domain`

### 7.3 — Content mirroring
- Remote content cached locally with `canonicalUrl` pointing to origin
- AP Create/Update/Delete activities keep mirror in sync
- Local users can comment/like — interactions federate back

### 7.4 — Cross-instance auth
- Model B: AP Actor SSO (designed in `@commonpub/auth`)
- Model C: Shared auth DB (operator opt-in for multi-instance)
- Account linking: user on instance A links to user on instance B
- Publishing to multiple instances

### 7.5 — Cross-instance product catalog
- Product hubs federable as AP actors
- BOM can reference products on remote instances
- Gallery aggregation: instance A sees projects from instance B that use a product hosted on instance A

---

## Execution Order & Dependencies

```
Phase 0: Decisions (this document) ✓

Phase 1: Schema (foundation — everything depends on this)
  1.1 Hub rename (Step A: code only) ← do first, touches most files
  1.2 Product catalog ← new tables
  1.3 Hardening ← indexes, conversations, columns, soft delete, versioning
  1.4 Validators ← Zod schemas for everything
  1.1b Hub rename (Step B: DB migration) ← after 1.1-1.4 tested

Phase 2: Server (business logic — depends on schema)
  2.1 Hub + product functions ← new features
  2.2 Missing functions ← profile, follows, uploads, storage, images, search, versioning
  2.3 Hardening ← fix contest auth, visibility enforcement, counter safety

Phase 3: API (endpoints — depends on server)
  3.1 New endpoints ← uploads, profile, follows, products, BOM, RSS, sitemap
  3.2 Validation sweep ← Zod on all 25 unvalidated endpoints
  3.3 Consistency ← error format, pagination, headers
  3.4 SEO ← JSON-LD, OG images, sitemap

Phase 4: Frontend (UI — depends on API)
  4.1 View pages ← article, blog, explainer, project (highest visual impact)
  4.2 Hub page ← 3 variants (community, product, company)
  4.3 Other pages ← contest, learning, video hub, profile editor
  4.4 Editor consolidation + product catalog integration
  4.5 Wire up unused components
  4.6 Real-time ← SSE notifications, WebSocket messaging
  4.7 Dead code removal

Phase 5: Data & Testing (can partially parallel with Phase 4)
  5.1 Seed script ← essential for visual testing
  5.2 Unit tests
  5.3 E2E tests
  5.4 Component tests

Phase 6: Production Hardening (parallel tasks)
  6.1 Security | 6.2 Performance | 6.3 Email | 6.4 Observability | 6.5 Deployment | 6.6 Docs

Phase 7: Federation (post-launch, post-two-instances)
```

**Critical path:** 1.1 → 1.2 → 2.1 → 3.1 → 4.2 (hub page with product gallery)
This is the path to the Hackster killer feature. Everything else can be parallelized around it.

---

## Design Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Hub types in single table | Shared infrastructure (routing, UI, federation, permissions). Type discriminator controls feature availability. Cleaner than 3 table hierarchies. |
| 2 | Separate `products` table (not on hubs) | Products can exist without hub pages. Product-specific fields (specs, pricing, purchase URL) don't belong on hubs. One company hub → many products. |
| 3 | Hybrid BOM: JSONB + relational | JSONB for fast display, `contentProducts` for relational gallery queries. Freeform parts (resistors, wires) stay JSONB-only. Catalog products get both. |
| 4 | Two-step rename (code then DB) | Isolates risk. Code rename is testable. DB rename is mechanical. Neither depends on the other working perfectly. |
| 5 | Keep Better Auth `organizations` | Auth concern, not content concern. Company hubs are separate. Can link later. |
| 6 | Remove `guide` content type | No editor, no view, no mockup. Adds confusion. Four types are enough: project, article, blog, explainer. |
| 7 | `files` table + storage adapter | Schema exists but no implementation. Adapter pattern supports local dev (filesystem) and production (S3). |
| 8 | SSE for notifications, WebSocket for messaging | SSE is simpler + sufficient for one-way push. WebSocket needed for bi-directional chat. |
| 9 | Content versioning on publish only | Every save would generate too many versions. Publish = meaningful checkpoint. |
| 10 | Hub privacy separate from join policy | "Can people find this hub?" (public/unlisted/private) is orthogonal to "Can people join?" (open/approval/invite). |
| 11 | Federation-readiness columns now | Adding nullable `apActorId`, `apObjectId`, `canonicalUrl` costs nothing now. Avoids breaking migration when federation ships. |
| 12 | Config-driven editor shell | 4 editors share ~900 lines of identical code (tags, collapse, cover, visibility). Config objects + one shell = same UX, 75% less code. |

---

## CLAUDE.md Updates — DONE

All updates applied in sessions 028-040:
- [x] Rule #6: "Hub is the umbrella concept" with three types
- [x] Products in `products` table, not JSONB
- [x] No `guide` content type
- [x] Architecture table updated
- [x] File naming updated (community.ts → hub.ts)
- [x] Plan reference updated to plan-v2.md
