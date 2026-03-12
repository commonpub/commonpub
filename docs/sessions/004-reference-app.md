# Session 004 — Reference App + Content System (Phase 4)

**Date**: 2026-03-09

## What Was Done

### Pre-Implementation

- Created 3 research docs: `sveltekit-form-actions.md`, `sveltekit-seo-patterns.md`, `drizzle-sveltekit-integration.md`
- Created 2 ADRs: `013-content-crud-architecture.md`, `014-seo-strategy.md`

### Feature Flags (Step 1)

- Added `content: boolean` and `social: boolean` to `FeatureFlags` interface and Zod schema (default `true`)
- Updated test-utils `createTestConfig` to include new flags
- Added 4 new config tests

### App Foundation (Steps 2-3)

- Updated `app.d.ts` with typed `App.Locals` (user, session, db)
- Created `hooks.server.ts` with pg.Pool, Drizzle, auth hook composition via `sequence()`
- Created `drizzle.config.ts` pointing at `@commonpub/schema`
- Added dependencies: `@commonpub/editor`, `drizzle-orm`, `pg`, `@types/pg`, `drizzle-kit`, `@testing-library/svelte`, `axe-core`
- Created `slug.ts` utility with `generateSlug()` and `ensureUniqueSlug()` — 8 tests

### Content Service (Step 4)

- Created `lib/types.ts` with `ContentListItem`, `ContentDetail`, `CreateContentInput`, `UpdateContentInput`, `ContentFilters`
- Created `lib/server/content.ts` with 7 functions: `listContent`, `getContentBySlug`, `createContent`, `updateContent`, `deleteContent`, `publishContent`, `incrementViewCount`
- Tag syncing via `syncTags()` helper (upsert tags, manage content-tag associations)
- 15 content service tests (mocked Drizzle DB)

### Layout + Navigation (Step 5)

- Created root `+layout.server.ts` (passes user to all pages)
- Created `+layout.svelte` with responsive app shell
- Created `Nav.svelte` with logo, links, auth state, avatar
- Created `Footer.svelte`

### Auth Pages (Step 6)

- Created sign-in and sign-up pages using Better Auth client API
- Email/password forms with validation, error handling, loading states

### Content Listing (Step 7)

- Home feed at `/` (all published content)
- Type-specific pages: `/projects`, `/blog`, `/articles`
- `ContentCard.svelte` — cover image, title, author, type badge, stats
- `ContentList.svelte` — grid of cards + empty state
- `content-helpers.ts` — type↔URL segment mapping

### Content Detail + SEO (Step 8)

- Dynamic route `[type]/[slug]` with slug lookup, auth check, view count increment
- BlockTuple rendering (text, heading, code, image, quote, callout)
- `SeoHead.svelte` — title, OG, Twitter Cards, JSON-LD (Article/HowTo), canonical
- `ContentMeta.svelte` — author, date, difficulty, view count

### Content Editor (Step 9)

- `ContentEditor.svelte` wrapping `createCommonPubEditor()` from `@commonpub/editor`
- Create page at `/create` with form action, title/type/description/content/tags
- Edit page at `[type]/[slug]/edit` with ownership check, pre-populated form
- Both use `use:enhance` for progressive enhancement

### Dashboard (Step 10)

- `/dashboard` with auth guard, tab filtering (All/Drafts/Published/Archived)
- Content list with edit/delete actions, confirmation dialog for delete
- Soft delete (status → archived)

### Social Service (Step 11)

- Created `lib/server/social.ts` with: `toggleLike`, `isLiked`, `listComments`, `createComment`, `deleteComment`, `toggleBookmark`
- Threaded comment structure (parentId → replies)
- Denormalized count updates on like/comment mutations
- 11 social service tests (mocked Drizzle DB)

### Social API + UI (Step 12)

- JSON API routes: `/api/social/like`, `/api/social/bookmark`, `/api/social/comments`
- `LikeButton.svelte` — heart icon, count, optimistic toggle
- `BookmarkButton.svelte` — bookmark icon, optimistic toggle
- `CommentSection.svelte` — threaded comments with create/delete

### Editor Toolbar + Slash Menu (Step 13)

- `FloatingToolbar.svelte` — anchored to selection, Bold/Italic/Code/Heading toggles
- `SlashMenu.svelte` — `/` command menu, keyboard navigable, 6 block types

### SEO Finishing (Step 14)

- `/sitemap.xml` — queries all published content, generates XML
- `/static/robots.txt` — allows all, references sitemap

## Decisions Made

- Form actions for CRUD mutations (progressive enhancement), JSON API only for social interactions
- Content body stored as BlockTuple[] in JSONB, rendered to HTML at read time
- Soft delete (archived status) instead of hard delete
- Optimistic UI for like/bookmark toggles
- Route structure: `(app)` group for all content routes
- No tRPC — direct Drizzle queries in server functions

## Test Counts

| Area                             | Tests         |
| -------------------------------- | ------------- |
| Config (new flags)               | +4 (21 total) |
| Slug utility                     | 8             |
| Content service                  | 15            |
| Social service                   | 11            |
| Setup placeholder                | 1             |
| **Reference app total**          | **35**        |
| **Running total (all packages)** | **386**       |

## Post-Implementation Audit Fixes

- **XSS**: Added `isomorphic-dompurify` for HTML sanitization in BlockTuple rendering
- **XSS**: Added `escapeJsonLd()` for safe JSON-LD script tag content
- **Broken code**: Fixed `ContentEditor.getContent()` to properly use `docToBlockTuples()`
- **Client/server boundary**: Moved `CommentItem` type to `$lib/types.ts` (was imported from server file)
- **Feature flags**: Added `config` to `App.Locals`, checked `features.content` on create/dashboard and `features.social` on all social API routes
- **Input validation**: Added content type enum validation on create form action
- **Error handling**: Added try-catch around `request.json()` in all social API routes

## What's Deferred

- Component tests (ContentCard, SeoHead, Nav) — need browser environment setup
- Integration tests with real DB — need Docker Postgres in CI
- Svelte NodeView rendering for editor (Phase 5)
- Image upload (Phase 5+)
- Content search with Meilisearch (Phase 7)
- Author profile pages (Phase 5)

## Open Questions

- Should we add component tests before Phase 5? (Would add ~15 tests)
- Do we need rate limiting on social API routes?
- Should the floating toolbar use TipTap's BubbleMenu extension instead of custom positioning?

## Next Steps

- Phase 5: Svelte NodeView rendering, drag-and-drop, image upload, author profiles
