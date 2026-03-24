# Session 035 — E2E Tests + DB Step B + Validation + Component Tests + Editors + UI Audit

Date: 2026-03-16

## What Was Done

### E2E Test Suite (Playwright)
Created 5 E2E test files at `apps/reference/e2e/`:

- **smoke.spec.ts** — Verifies every public page loads without fatal errors (homepage, search, auth pages, hubs, contests, learn, videos, content type pages). Tests hero banner, tabs, sidebar, footer rendering. Also checks for console errors on all pages.

- **navigation.spec.ts** — Tests tab switching on homepage, hero banner dismiss, footer links, auth page cross-links (login ↔ register), search input/filter interactions, sidebar navigation.

- **seo.spec.ts** — Tests robots.txt (Disallow /api/, /admin/, /settings/, Sitemap reference), sitemap.xml (valid XML with urlset), RSS feed.xml (valid RSS with CommonPub), meta tags on all key pages (titles, descriptions), RSS link tag in layout, security headers.

- **api.spec.ts** — Tests all public API endpoints (/api/health, /api/stats, /api/content, /api/hubs, /api/search, /api/contests, /api/learn, /api/videos, /api/videos/categories). Verifies protected endpoints return 401 without auth (/api/profile, POST /api/content, /api/notifications/count). Tests federation endpoints (/.well-known/nodeinfo, /.well-known/webfinger).

- **auth.spec.ts** — Tests login/register form rendering, field types, required attributes, autocomplete attributes, form labels, aria-labels, input acceptance, cross-links.

- **responsive.spec.ts** — Tests homepage, search, and auth pages at desktop (1280px), tablet (768px), and mobile (375px) viewports. Verifies layout adaptation (two-column → single-column), sidebar visibility, form usability on mobile.

Playwright config was already in place (`playwright.config.ts`) pointing at `apps/reference/e2e/`, running chromium + firefox + mobile-chrome, with webServer auto-starting the dev server.

### DB Step B Rename (Code Only)
Updated all Drizzle schema and server code to use the new table/column names that match the migration:

**Schema (`packages/schema/src/hub.ts`):**
- `pgTable('communities', ...)` → `pgTable('hubs', ...)`
- `pgTable('community_members', ...)` → `pgTable('hub_members', ...)`
- `pgTable('community_posts', ...)` → `pgTable('hub_posts', ...)`
- `pgTable('community_post_replies', ...)` → `pgTable('hub_post_replies', ...)`
- `pgTable('community_bans', ...)` → `pgTable('hub_bans', ...)`
- `pgTable('community_invites', ...)` → `pgTable('hub_invites', ...)`
- `pgTable('community_shares', ...)` → `pgTable('hub_shares', ...)`
- All `communityId: uuid('community_id')` → `hubId: uuid('hub_id')`
- All relation fields updated to use `.hubId`

**Server (`packages/server/src/`):**
- `hub.ts`: ~50+ references of `communityId` → `hubId` (Drizzle column refs, insert values, result mappings)
- `admin.ts`: 2 references updated
- `product.ts`: 1 reference updated

**Seed script:** `apps/reference/scripts/seed.ts` — 2 insert calls updated

**IMPORTANT:** The SQL migration (`deploy/migrations/001-rename-communities-to-hubs.sql`) must be run on the database BEFORE deploying this code. The migration script was already written in session 034.

### Validation Sweep (Session 035)
Added Zod validation to 28 previously unvalidated POST/PUT endpoints:

**Contests:** index.post (createContestSchema), [slug].put (updateContestSchema), entries.post (submitEntrySchema), judge.post (judgeEntrySchema)

**Videos:** index.post (createVideoSchema)

**Learning:** index.post (createLearningPathSchema), [slug].put (updateLearningPathSchema), modules.post (createModuleSchema), [moduleId].put (updateModuleSchema), lessons.post (createLessonSchema)

**Docs:** index.post (createDocsSiteSchema), [siteSlug].put (updateDocsSiteSchema), pages.post (createDocsPageSchema), [pageId].put (updateDocsPageSchema), versions.post (createDocsVersionSchema)

**Social:** like.post (likeTargetTypeSchema + uuid), bookmark.post (bookmarkTargetTypeSchema + uuid)

**Hubs:** bans.post (banUserSchema), invites.post (createInviteSchema), replies.post (createReplySchema), share.post (shareContentSchema), members/[userId].put (changeRoleSchema)

**Messages:** index.post (createConversationSchema), [conversationId].post (sendMessageSchema)

**Admin:** settings.put (adminSettingSchema), role.put (adminUpdateRoleSchema), status.put (adminUpdateStatusSchema), resolve.post (resolveReportSchema)

Remaining endpoints without body validation are action-only (no request body): publish, view, join, leave, enroll, unenroll, complete, follow, read — these correctly don't need body validation.

**Total: 39 of 51 POST/PUT endpoints now have Zod validation.** The 12 without are action-only endpoints that take no body.

Also fixed 4 "Community not found" error messages → "Hub not found" during the sweep.

### Component Tests (Session 035)
Added 2 new test files to `packages/ui/src/components/__tests__/`:

**accessibility.test.ts** — axe-core a11y scans for 17 components (Button, IconButton, Input, Textarea, Select, Badge, Avatar, Separator, Stack, Card, Toggle, TagInput, ProgressBar, Alert, Toolbar, Tabs, VisuallyHidden). All pass with 0 violations. Color contrast disabled (jsdom has no computed styles), region disabled (components render in isolation).

**keyboard.test.ts** — Keyboard navigation tests for interactive components:
- Tabs: ArrowRight/Left navigation, wrapping, Home/End keys (6 tests)
- Dialog: Escape closes, aria-modal, aria-label (2 tests)
- Menu: Enter/Space opens, click toggle (3 tests)
- Toggle: click toggles, aria-checked true/false (3 tests)

UI package now: **26 test files, 214 tests** (up from 24 files, 190 tests).

### Migration Execution (Session 035)
Ran `deploy/migrations/001-rename-communities-to-hubs.sql` on dev Postgres:
- Created 7 new enum types (hub_type, hub_privacy, hub_join_policy, hub_role, hub_member_status, product_status, product_category)
- Migrated join_policy (community_join_policy → hub_join_policy) and role (community_role → hub_role) columns
- Added missing columns to hubs (hub_type, privacy, parent_hub_id, website, categories, ap_actor_id, deleted_at), hub_members (status), hub_posts (last_edited_at)
- Created products, content_products, content_versions tables
- Added missing columns to content_items (license_type, series, estimated_minutes, canonical_url, ap_object_id, deleted_at), users (pronouns, timezone, email_notifications, deleted_at), files (original_name, content_id, hub_id, width, height)
- Renamed 7 tables: communities → hubs, community_* → hub_*
- Renamed 5 foreign key columns: community_id → hub_id
- Renamed 3 indexes and constraint names
- Created 17 performance indexes
- Dropped stale community_join_policy and community_role enum types
- Fixed migration script to handle missing defaults on enum type conversion and non-existent indexes

## Build & Test Results
- 13 packages build, all tests pass (214 UI component tests + unit tests across all packages)
- Zero regressions from all changes

## Decisions
- E2E tests are structured as smoke/navigation/SEO/API/auth/responsive — not as full lifecycle flows yet. Full lifecycle tests (content creation → publish → view, hub management, learning enrollment) require a running Postgres with seeded data and would be a separate iteration.
- Step B code changes are committed separately from running the actual migration, preserving the two-step safety model from the plan.

### Block Editor Rewrite (Session 035)
Complete rewrite of the editor canvas from a monolithic TipTap document to a proper block-based editor with full interaction UI matching the mockups.

**Architecture change:**
- TipTap demoted from document manager to inline rich-text engine (used inside text blocks only)
- New `useBlockEditor` composable manages blocks as a reactive array with add/remove/move/duplicate/update
- Each block rendered by type-specific Vue component wrapped in universal BlockWrapper

**New composable:**
- `composables/useBlockEditor.ts` — Block array CRUD, serialization to/from BlockTuple format

**New editor components (6 infrastructure + 12 block types):**
- `BlockCanvas.vue` — Orchestrates block list rendering with insert zones and block picker
- `BlockWrapper.vue` — Wraps every block: drag handle, clone/delete controls, selected state
- `BlockInsertZone.vue` — "+ Insert block" button between blocks, appears on hover
- `BlockPicker.vue` — Searchable block type picker (search, keyboard nav, grouped display)

- `blocks/TextBlock.vue` — Paragraph with scoped TipTap micro-editor (bold/italic/code/link/lists)
- `blocks/HeadingBlock.vue` — Editable heading with level selector
- `blocks/CodeBlock.vue` — Language selector, filename, copy button, dark theme textarea
- `blocks/ImageBlock.vue` — Upload placeholder, URL input, preview, alt text, caption
- `blocks/QuoteBlock.vue` — Styled blockquote with contenteditable body + attribution input
- `blocks/CalloutBlock.vue` — Variant cycler (info/tip/warning/danger) + editable body
- `blocks/DividerBlock.vue` — Simple horizontal rule
- `blocks/PartsListBlock.vue` — Full BOM table: part/qty/notes/price with add/remove rows
- `blocks/BuildStepBlock.vue` — Numbered step: title, time estimate, instruction textarea
- `blocks/ToolListBlock.vue` — Tool items with name, notes, add/remove
- `blocks/VideoBlock.vue` — URL input with preview
- `blocks/EmbedBlock.vue` — URL input for external embeds
- `blocks/DownloadsBlock.vue` — File list with name/URL
- `blocks/QuizBlock.vue` — Question, options with correct toggle, add/remove

**Updated editors:**
- All 4 editors (Article, Blog, Project, Explainer) updated to use `blockEditor` composable
- Edit page (`[type]/[slug]/edit.vue`) now initializes `useBlockEditor`, passes to specialized editors
- EditorBlocks sidebar updated to call `blockEditor.addBlock()` instead of TipTap commands
- Preview mode renders blocks from the composable array
- Code mode shows serialized BlockTuple JSON

## What's Remaining
1. **WebSocket messaging** — Real-time bidirectional chat
2. **Image processing** — sharp-based thumbnail generation
3. **Full lifecycle E2E tests** — Content+BOM, hub, learning, discovery flows (requires seeded DB)
4. **Editor polish** — Slash command (/ trigger), drag-and-drop between blocks, floating toolbar for text selection
5. **Meilisearch integration** — When Postgres FTS becomes bottleneck
6. **Federation (Phase 7)** — Deferred per CLAUDE.md rule #10
