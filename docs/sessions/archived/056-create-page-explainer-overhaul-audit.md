# Session 056: Create Page, Explainer Overhaul & Deep Audit

## Scope

Full session: deep security/correctness audit (18 fixes across 3 passes), create page redesign, explainer overhaul with `sectionHeader` block type, snap-to-viewport view, section-aware editor, and explainer preview fix.

## Audit — Pass 1: Security (5 fixes)

1. **CSP blocks Font Awesome** — Added `cdnjs.cloudflare.com` to `style-src` and `font-src` in `buildCspDirectives()` and dev-mode override in security middleware
2. **CSP blocks external iframes** — Added `frame-src` directive allowing `youtube-nocookie.com`, `youtube.com`, `player.vimeo.com`
3. **Open redirect on login/register** — Both `/auth/login` and `/auth/register` now validate redirect param is relative path only (`/`-prefixed, not `//`)
4. **CORS wildcard removed** — Removed `Access-Control-Allow-Origin: *` from API route rules in `nuxt.config.ts`
5. **BlockEmbedView URL validation** — Only allows `http://` and `https://` URLs in iframe src; blocks `javascript:`, `data:` URIs

## Audit — Pass 1: Performance/Correctness (5 fixes)

6. **Rate limiter `/_nuxt/` skip** — Added `/_nuxt/` to `shouldSkipRateLimit()` — was only checking `/_app/`, so all Nuxt static assets were rate-limited in production
7. **View count dedup** — Added in-memory IP+content dedup with 5-minute cooldown to `/api/content/[id]/view` POST, preventing trivial inflation
8. **SSE stream double-close** — Refactored notification stream with shared `cleanup()` function and `closed` guard — interval error + req close were both calling `controller.close()`
9. **`await requireAuth()` fix** — Removed unnecessary `await` on synchronous function in `messages/index.get.ts` and `messages/[conversationId].get.ts`
10. **`beforeunload` leak** — Edit page listener was added outside lifecycle hooks, never cleaned up on SPA navigation. Moved to `onMounted`/`onUnmounted`

## Audit — Pass 2: Post-Implementation (5 fixes)

11. **Edit page `v-if` chain broken** — Explainer preview used `v-if` instead of `v-else-if`, creating a separate conditional chain. Code mode `v-else` rendered alongside write mode. Fixed to single chain: `v-if` (write+specialized) → `v-else-if` (write+fallback) → `v-else-if` (preview+explainer) → `v-else-if` (preview+generic) → `v-else` (code)
12. **ExplainerView final fallback skips first block** — When no sectionHeader or H2 blocks exist, `blockIndex: 0` + 1 = 1 skipped the first content block. Fixed by setting `blockIndex: -1` in the fallback so `start = -1 + 1 = 0`
13. **ExplainerView scroll target wrong** — Watch handler scrolled `.cpub-explainer-main` (which has `overflow: hidden`) instead of `.cpub-section-viewport` (which has `overflow-y: auto`)
14. **Duplicate checkpoint in editor** — `checkpoint` block appeared in both Interactive and Structure groups in ExplainerEditor. Removed from Structure
15. **Dead code cleanup** — Removed unused `transitionDir` ref and unused `sanitizeBlockHtml` import

## Audit — Pass 3: Deep Re-Audit (3 fixes)

16. **BlockVideoView URL validation** — Fallback case returned raw user URL as iframe src (same issue as BlockEmbedView). Added http/https validation for non-YouTube/Vimeo URLs
17. **Comments pagination broken** — `comments.get.ts` Zod schema only had `targetType` + `targetId`, silently stripping `limit`/`offset` params sent by CommentSection. Added pagination to schema and `listComments()` function (paginate root-level comments after threading)
18. **Keyboard navigation** — Added left/right arrow key support for explainer section traversal

## `sectionHeader` Block Type

Added across the full stack:

**Package level:**
- `packages/editor/src/blocks/schemas.ts` — `sectionHeaderContentSchema` (tag: string, title: string, body?: string)
- `packages/editor/src/blocks/types.ts` — `SectionHeaderContent` type added to `TypedBlockTuple` union
- `packages/editor/src/blocks/registry.ts` — Registered in `registerCoreBlocks()` (now 20 core blocks)
- `packages/editor/src/index.ts` — Exported schema and type
- `packages/editor/src/__tests__/registry.test.ts` — Updated count 19→20, added assertion

**Reference app level:**
- `composables/useBlockEditor.ts` — Added `sectionHeader: () => ({ tag: '', title: '', body: '' })`
- **NEW** `editors/blocks/SectionHeaderBlock.vue` — Tag input (monospace, uppercase), title input (26px heading), body textarea
- **NEW** `blocks/BlockSectionHeaderView.vue` — Read-only view: tag with accent dash, large heading, intro paragraph
- `editors/BlockCanvas.vue` — Added `sectionHeader → SectionHeaderBlock` to component map
- `blocks/BlockContentRenderer.vue` — Added `sectionHeader → BlockSectionHeaderView` to component map

## Explainer Overhaul

### ExplainerView.vue — Snap-to-viewport sections (full rewrite)
- Derives sections from `sectionHeader` blocks (falls back to H2 headings, then single-section fallback with `blockIndex: -1`)
- Shows ONE section at a time — `.cpub-section-viewport` scrolls within section if content overflows
- Section header data (tag, title, body) rendered from sectionHeader block data
- Block ranges computed between sectionHeader blocks, skipping the header block itself
- Prev/next navigation scrolls viewport to top on section change
- Sidebar TOC with active/completed state, progress dots, checkpoint animation
- Keyboard navigation: left/right arrow keys traverse sections
- Disabled state on prev/next buttons at boundaries

### ExplainerEditor.vue — Section-aware
- `sectionHeader` added to Structure group in Modules panel
- `horizontal_rule` (Section Divider) added to Structure group
- Removed duplicate `checkpoint` from Structure (kept in Interactive)
- Renamed "Rich" group to "Data & Viz"
- Structure tab derives sections from `sectionHeader` blocks (with heading fallback)
- Empty state updated to reference Section Header blocks

### Edit page — Explainer preview fix
- Explainers in preview mode render using `ExplainerView` component with mock `ContentViewData`
- Generic preview for other types simplified to use `BlockContentRenderer`
- Properly chained in `v-else-if` (not a new `v-if`)

## Create Page Redesign
- Horizontal card layout with colored icon area, description body, and arrow indicator
- Each type has distinct accent color (project=blue/accent, article=teal, explainer=yellow, blog=pink)
- "Popular" badge on projects (absolute-positioned, monospace)
- Better descriptions explaining each content format's purpose
- Hover: offset shadow grows, card translates
- Responsive: stacks vertically on mobile with arrow at bottom-right

## Dark Mode CSS Gaps
- Added missing `--color-on-accent: #ffffff`, `--color-on-primary: #ffffff`, `--color-primary-hover: #4a8be5` to `packages/ui/theme/dark.css`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `sectionHeader` as explicit block type vs derived from H2 headings | Mockup shows a rich section header with tag + title + intro body — can't be expressed as a simple heading. Also makes section boundaries unambiguous. |
| Fallback `blockIndex: -1` for content without section markers | `sectionRanges` does `blockIndex + 1` to skip the sectionHeader block. In the fallback case there's no block to skip, so `-1 + 1 = 0` starts at the first block. |
| Arrow key navigation on ExplainerView | Mockup shows prev/next buttons; keyboard nav is natural for section-based content and matches accessibility best practices. |
| Removed `ProgressTracker` from ExplainerView | Replaced by the fixed progress bar at top + section dots in footer. ProgressTracker component still exists for other potential uses. |
| Comments pagination at root level after threading | Can't paginate the SQL query directly because that would break parent-child relationships. Instead fetch all, build thread tree, then slice root comments. |

## Verification

- All 14 Turborepo build tasks pass
- All tests pass: editor (69), protocol (119), server (175), reference (1)
- Registry test updated: 19 → 20 core block types
- v-if chain verified: single chain from write → preview → code mode

## File Change Summary

| File | Change |
|------|--------|
| `packages/infra/src/security.ts` | CSP: cdnjs in style/font-src, frame-src for video, `/_nuxt/` skip |
| `packages/editor/src/blocks/schemas.ts` | Added `sectionHeaderContentSchema` |
| `packages/editor/src/blocks/types.ts` | Added `SectionHeaderContent` to union |
| `packages/editor/src/blocks/registry.ts` | Registered `sectionHeader` |
| `packages/editor/src/index.ts` | Exported schema + type |
| `packages/editor/src/__tests__/registry.test.ts` | 19→20, added assertion |
| `packages/ui/theme/dark.css` | Added missing dark mode properties |
| `packages/server/src/social/social.ts` | Added limit/offset params to `listComments()` |
| `apps/reference/server/middleware/security.ts` | Dev CSP: cdnjs in style-src |
| `apps/reference/nuxt.config.ts` | Removed CORS wildcard |
| `apps/reference/pages/auth/login.vue` | Open redirect prevention |
| `apps/reference/pages/auth/register.vue` | Open redirect prevention |
| `apps/reference/pages/create.vue` | Full redesign |
| `apps/reference/pages/[type]/[slug]/edit.vue` | Explainer preview, v-if chain fix, beforeunload fix, removed unused import |
| `apps/reference/composables/useBlockEditor.ts` | Added `sectionHeader` defaults |
| `apps/reference/components/editors/BlockCanvas.vue` | Added SectionHeaderBlock |
| `apps/reference/components/editors/ExplainerEditor.vue` | Section-aware, sectionHeader in modules, removed duplicate checkpoint |
| **NEW** `apps/reference/components/editors/blocks/SectionHeaderBlock.vue` | Section header editor |
| `apps/reference/components/blocks/BlockContentRenderer.vue` | Added BlockSectionHeaderView |
| **NEW** `apps/reference/components/blocks/BlockSectionHeaderView.vue` | Section header view |
| `apps/reference/components/views/ExplainerView.vue` | Full rewrite: snap-to-viewport, keyboard nav |
| `apps/reference/components/blocks/BlockEmbedView.vue` | URL validation |
| `apps/reference/components/blocks/BlockVideoView.vue` | URL validation for fallback case |
| `apps/reference/server/api/content/[id]/view.post.ts` | View count dedup |
| `apps/reference/server/api/notifications/stream.get.ts` | SSE double-close fix |
| `apps/reference/server/api/messages/index.get.ts` | Removed `await` on sync fn |
| `apps/reference/server/api/messages/[conversationId].get.ts` | Removed `await` on sync fn |
| `apps/reference/server/api/social/comments.get.ts` | Added limit/offset to query schema |

## Known Remaining

| Issue | Severity | Notes |
|-------|----------|-------|
| HTTP signature verification on inbox | P1 | Both inbox routes accept unsigned POSTs. TODO in code. |
| Must run `drizzle-kit push` | P1 | Session 055 added 50+ DB indexes that need to be applied. |
| Hub bans/invites auth scope | P2 | `requireAuth` is called but `user.id` is unused — any authenticated user can list bans/invites for any hub. Server-side authorization may exist in `listBans()`/`listInvites()` but should be verified. |
| Content versions/products no auth | P3 | `versions.get.ts` and `products.get.ts` don't require auth — version history is public. Acceptable for published content but could leak draft metadata. |
| Avatar component duplication | P3 | 7+ ad-hoc letter-initial implementations vs `CpubAvatar` from `@commonpub/ui`. |
| Tab CSS migration | P3 | `dashboard.vue`, `explore.vue` use custom tab styles instead of `CpubTabs`. |
| Editor zoom controls | P3 | Mockup shows zoom in/out/100% in canvas toolbar — not implemented. |
| DNS rebinding in SSRF | P3 | SSRF check validates hostname pre-fetch, not resolved IPs. |
| Orphaned ProgressTracker component | P4 | No longer imported anywhere. Not harmful. |
