# CommonPub Restructure — Master Checklist

## Phase 0: Preparation
- [x] Tag current commit: `pre-commonpub-rename`
- [x] Create tracking files
- [x] Verify `pnpm build && pnpm test` passes

## Phase 1: Global Rename (snaplify → commonpub)
- [x] Leaf packages: schema, config
- [x] Mid-tier: protocol, test-utils, auth, docs, editor
- [x] Upper-tier: explainer, learning
- [x] UI package (CSS prefixes)
- [x] Apps: reference, landing
- [x] Tools: worker, create-commonpub
- [x] Deploy: docker-compose, nginx, droplet-setup, app-spec
- [x] Root: package.json, CLAUDE.md, README
- [x] Docs: all markdown files
- [x] Fresh pnpm install
- [x] Verify: build + test + typecheck
- [x] Grep check: zero snaplify outside node_modules/.git/target

## Phase 2: Delete & Prepare for Framework Switch
- [x] Extract server patterns from apps/reference
- [x] Delete apps/landing
- [x] Delete apps/reference (SvelteKit)
- [x] Delete Svelte components from packages/ui
- [x] Remove Svelte dependencies
- [x] Add Vue/Nuxt dependencies
- [x] Clean up old mockup files

## Phase 3: Server Logic Library + Protocol/Auth Fixes
- [x] Create packages/server
- [x] Move business logic (content, community, social, learning, docs, admin, profile, security, theme, federation, oauthCodes)
- [x] Update auth for framework-agnostic middleware
- [x] Write tests (13 test files)

## Phase 4: Design Token System Rebuild
- [x] Rewrite base.css with unified-v2 tokens
- [x] Rewrite theme.ts token validation
- [x] Add dark theme
- [x] Remove old theme files (hackbuild, deepwood, deveco)

## Phase 5: UI Component Library Rebuild (Vue 3)
- [x] Foundation: VisuallyHidden, Button, IconButton, Input, Textarea, Select, Badge, Avatar, Separator, Stack
- [x] Compound: Tooltip, Popover, Menu, MenuItem, Dialog, Tabs
- [x] New: Card, Toggle, TagInput, ProgressBar, Alert, Toolbar
- [x] Tests (7 test files, 78 tests)

## Phase 6: Reference App Rebuild (Nuxt 3)
- [x] Scaffold Nuxt 3 app
- [x] Layouts (default, auth)
- [x] Pages (index, search, dashboard, auth/login, auth/register, [type]/index, [type]/[slug], u/[username])
- [x] Server routes (health, webfinger, nodeinfo)
- [x] Server middleware (auth)
- [x] Composables (useTheme)
- [x] Build passes

## Phase 7: Documentation & Cleanup
- [x] Rewrite CLAUDE.md
- [x] New ADR 024 (rename)
- [x] New ADR 025 (Nuxt switch)
- [x] New ADR 026 (design direction)
- [x] Mark ADR 001 as superseded
- [x] Session log 023
- [x] Update active docs for Nuxt/Vue
- [x] Remove Svelte deps from auth package
- [x] Fix stale Svelte comments in code
- [x] Update eslint ignores
- [x] Final grep check: zero snaplify in active code
- [x] Final build: 13/13 tasks pass
- [x] Final tests: 27/27 tasks pass

## Phase 8: Reference App — Full Implementation (Session 024)

### Phase 8.1: Database Connection & Runtime Config
- [x] `server/utils/db.ts` — singleton Drizzle from DATABASE_URL
- [x] `server/utils/config.ts` — singleton CommonPubConfig from runtimeConfig
- [x] `server/utils/auth.ts` — requireAuth, requireAdmin, getOptionalUser helpers
- [x] `nuxt.config.ts` — runtimeConfig block (databaseUrl, authSecret, public domain/siteName/siteDescription)
- [x] `package.json` — pg + drizzle-orm dependencies
- [x] `server/middleware/auth.ts` — refactored to use useDB()/useConfig()

### Phase 8.2: Security Middleware & Auth Composables
- [x] `server/middleware/security.ts` — rate limiting + security headers
- [x] `plugins/auth.ts` — client-side session fetch on init
- [x] `composables/useAuth.ts` — reactive auth state + signIn/signUp/signOut
- [x] `composables/useEditor.ts` — TipTap editor wrapper
- [x] `middleware/auth.ts` — client-side route guard

### Phase 8.3: Content & Social API Routes (16 routes)
- [x] Content CRUD: index.get, index.post, [slug].get, [id].put, [id].delete, [id]/publish.post, [id]/view.post
- [x] Social: like.post, like.get, comments.get, comments.post, comments/[id].delete, bookmark.post
- [x] Search: search.get
- [x] Users: [username].get, [username]/content.get

### Phase 8.4: Wire Stub Pages to Real Data
- [x] index.vue — useFetch for feed + trending
- [x] search.vue — debounced search API with filters
- [x] dashboard.vue — auth guard + user content fetch
- [x] [type]/index.vue — content listing by type
- [x] [type]/[slug].vue — content detail with view tracking, engagement, tags
- [x] u/[username].vue — profile + user content

### Phase 8.5: Missing Pages
- [x] create.vue — content type selector grid
- [x] [type]/[slug]/edit.vue — content editor (new + existing)
- [x] feed.vue — paginated activity feed

### Phase 8.6: Community System (19 API routes + 5 pages)
- [x] API: communities CRUD, join/leave, members, posts, replies, bans, invites, share
- [x] Pages: index, create, [slug], [slug]/members, [slug]/settings

### Phase 8.7: Admin Panel (11 API routes + 1 layout + 5 pages)
- [x] API: stats, users CRUD, reports, audit, settings, content removal
- [x] layouts/admin.vue with sidebar nav
- [x] Pages: dashboard, users, reports, audit, settings

### Phase 8.8: Learning System (15 API routes + 5 pages)
- [x] API: paths CRUD, publish, enroll/unenroll, modules, lessons, complete, enrollments, certificates
- [x] Pages: index, create, [slug], [slug]/edit, [slug]/[lessonSlug]

### Phase 8.9: Docs System (11 API routes + 4 pages)
- [x] API: sites CRUD, pages CRUD, nav, versions, search
- [x] Pages: index, [siteSlug], [siteSlug]/[...pagePath], [siteSlug]/edit

### Phase 8.10: Federation Routes
- [x] webfinger.ts — real DB user lookup
- [x] nodeinfo/2.1.ts — real DB stats
- [x] users/[username].ts — AP actor JSON-LD
- [x] users/[username]/inbox.ts — per-actor inbox
- [x] users/[username]/outbox.ts — outbox collection
- [x] users/[username]/followers.ts — followers collection
- [x] users/[username]/following.ts — following collection
- [x] inbox.ts — shared inbox

### Phase 8.11: Navigation & Layout Polish
- [x] layouts/default.vue — full nav (Communities, Learn, Docs, Admin)
- [x] Auth-aware user menu + sign out
- [x] :focus-visible styles on all interactive elements
- [x] Sidebar updated (Home, Feed, Projects, Articles, Guides, Blog)

### Verification
- [x] `pnpm build` — 13/13 tasks pass
- [x] `pnpm test` — 27/27 tasks pass
- [x] Total: 73 API routes, 30 pages, 128 files in reference app
