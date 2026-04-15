# Session 122 — Deep Audit + Login Fix + Hub Resources + Products + Federation (2026-04-15)

Full codebase audit (19 deep-dive agents) + critical login fix + hub resources/products features.
4 commits (commonpub) + 1 commit (deveco-io). Both instances deploying.

## Verification
- 23/23 typecheck, 30/30 test suites — verified throughout
- Test count: 2852 (unchanged — no new tests yet this session)

## Phase 1 — Deep Audit (19 agents)

Complete audit of every surface: schema (64 tables), server (18K LOC), protocol, auth, UI, editor,
explainer, docs, learning, config, infra, layer (169 components, 77 pages, 218 routes),
deveco consumer, all docs, tests, CI/CD, deployment, Docker.

Findings saved to `memory/audit_session_122.md`. Key discoveries:
- "Hackster killer feature" (BOM→product hub gallery) IS fully implemented end-to-end
- Explainer: 5/6 interactive modules fail WCAG 2.1 AA (quiz, checkpoint, toggle, reveal cards, clickable cards)
- Editor: blocks not Tab-navigable, toolbar hover-only, no ARIA on format buttons
- Database migrations: 2 confirmed production incidents from drizzle-kit push (sessions 090, 092)
- "For You" homepage = just viewCount sort, not personalized
- Videos: categoryId FK missing from videos table
- Notification preferences UI incomplete
- Auth/password reset: fully working (confirmed)

## Phase 2 — Login CSRF Fix (CRITICAL)

**Commit:** `a8ec0f3`

Both commonpub.io and deveco.io login broken — 403 Forbidden on `/api/auth/sign-in-username`.

**Root cause:** Better Auth 1.6.x CSRF protection requires valid Origin header on POST requests.
The sign-in-username handler proxied to `/api/auth/sign-in/email` internally but didn't forward
the browser's Origin/Referer headers.

**Fix:** Forward `Origin` and `Referer` headers from original request to internal proxy call.
Published @commonpub/layer@0.8.9. Both instances deployed.

## Phase 3 — UI Fixes

**Commit:** `a8ec0f3` (same commit)

- **deveco-io card borders:** Wildcard CSS selector `[class*="cpub-"][class*="-card"]` was applying
  borders to every child element (author card name, handle, stats, related card title, etc.).
  Replaced with explicit class list targeting only card containers.
- **Related posts cover images:** Template used placeholder icon instead of `coverImageUrl` which
  was already in the API response. Added `<img>` with fallback to icon.
- **Explore hubs grid:** Added 1024px breakpoint (was only 768px → 2-column overflow on medium screens).

## Phase 4 — Hub Resources (NEW FEATURE)

### Commit 1: `c178db4` — Schema + Server + API

**Schema:**
- New `resourceCategoryEnum`: documentation, tools, tutorials, community, hardware, software, other
- New `hubResources` table: id, hubId (cascade), title, url, description, category, sortOrder, addedById (cascade), timestamps
- New `federatedHubResources` table for mirrored remote hub resources
- New `federatedHubProducts` table for mirrored remote hub products
- Validators: `createHubResourceSchema`, `updateHubResourceSchema`, `reorderHubResourcesSchema`

**Server (resources.ts):**
- `listHubResources(db, hubId)` — ordered by sortOrder, joins user
- `createHubResource(db, hubId, userId, input)` — requires hub member, auto-assigns sortOrder
- `updateHubResource(db, resourceId, userId, input)` — mod+ or author
- `deleteHubResource(db, resourceId, userId)` — mod+ or author
- `reorderHubResources(db, hubId, userId, ids)` — mod+ only
- New `manageResources` permission at moderator level

**API routes:**
- GET /api/hubs/[slug]/resources
- POST /api/hubs/[slug]/resources
- PUT /api/hubs/[slug]/resources/[id]
- DELETE /api/hubs/[slug]/resources/[id]
- POST /api/hubs/[slug]/resources/reorder

Also fixed pre-existing Drizzle type error in docs.ts (satisfies cast).

**Published:** @commonpub/schema@0.9.12, @commonpub/server@2.30.0

### Commit 2: `50dec0a` — UI + Tab Expansion

- New `HubResources.vue` component: grouped by category, add form for members, delete for mod+/author, external link icons, empty state
- Resources tab added to ALL hub types (community, product, company)
- Products tab expanded from Company-only to ALL hub types
- `HubProducts.vue` updated with "Add Product" inline form for moderators

### Commit 3: `bb4af63` — Federation

- Group actor now exposes `cpub:resources` and `cpub:products` collection URIs
- New AP routes: GET /hubs/[slug]/resources and /hubs/[slug]/products (content-negotiated)
- Returns OrderedCollection of cpub:Resource/cpub:Product objects
- Hub sync worker extends `refreshFederatedHubMetadata` to pull resources and products collections
- `syncFederatedHubCollection` function upserts items, removes stale entries
- Non-CommonPub instances gracefully ignore cpub:* extensions

## Schema Changes (need drizzle-kit push on both instances)

New tables: `hub_resources`, `federated_hub_resources`, `federated_hub_products`
New enum: `resource_category`

## Phases 5-10 — Remaining v1.0 Tasks (ALL COMPLETED)

### Phase 5 — Accessibility
- **Explainer a11y** (`c9468b7`): aria-live on quiz/checkpoint, aria-pressed on toggle, aria-label+expanded on cards, focus management on section nav
- **Editor a11y** (`810607a`): aria-label on block controls/toolbar, :focus-within for keyboard visibility, aria-pressed on format toggles

### Phase 6 — Infrastructure + Polish
- **Database migration script** (`386c663`): scripts/db-migrate.mjs + docs/migration-switch.md
- **Video categories FK** (`deb1f0a`): categoryId on videos table, index, relations, server wiring. schema@0.9.13
- **Admin search reindex** (`1626c10`): POST /api/admin/search/reindex
- **Stale docs** (`a53591c`): architecture.md counts, deployment.md Caddy note

### Phase 7 — Contest + Notifications + Final
- **Contest notifications** (`1e772b7`): entrants notified on status transitions
- **Notification preferences** (`2879b78`): wired to emailNotifications column, digest dropdown
- **Docs editor gaps**: Already implemented in session 118 (sidebarLabel, duplicate page)
- **Publish** (`7d71dd7`): server@2.31.0, layer@0.9.1

### Phase 8 — Audit Fixes + UX Polish
- **Audit cleanup** (`7908026`): dead import, missing categories, aria-label, CSS, hex fallback
- **Layer deps fix** (`d20e355`): layer pinned to server@^2.31.0, published layer@0.9.2
- **Smart tab visibility** (`7d4cdd3`): Products/Resources tabs hidden when empty, count badges
- **UX polish** (`93c986f`): responsive breakpoints 1024→768px, touch targets, description clamp

## deveco-io Changes

| Commit | Change |
|--------|--------|
| `6c708e8` | Layer bump 0.8.9 — login CSRF fix + card border cleanup |
| `91ca988` | Layer 0.9.0, schema 0.9.12, server 2.30.0 |
| `a20f81c` | Layer 0.9.1, schema 0.9.13, server 2.31.0 |
| `7754221` | Layer 0.9.2 — federation collection fix |
| `dfd0a61` | Force rebuild for new routes |
| `3cdbb7a` | Fix lockfile — was stuck at layer@0.8.9 |

## All 16 v1.0 Tasks — COMPLETE

All schema changes applied to both production instances via manual SQL.
Both instances verified live: health OK, login OK, resources OK, products OK, AP collections OK.
