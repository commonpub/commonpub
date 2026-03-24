# Session 036 — Functional Audit, Storage Pipeline, BOM Feature, Missing Pages

Date: 2026-03-16

## What Was Done

### Storage Pipeline (S3/DO Spaces/MinIO/Local)
- Rewrote `S3StorageAdapter` with `@aws-sdk/client-s3` (was broken — raw fetch without AWS Signature V4)
- Added `createStorageFromEnv()` factory: reads env vars, returns Local or S3 adapter
- DO Spaces: `S3_ENDPOINT=https://nyc3.digitaloceanspaces.com`, MinIO: `S3_ENDPOINT=http://localhost:9000` + `S3_FORCE_PATH_STYLE=true`, AWS: just bucket+keys, Local: no S3 vars → `./uploads/`
- Nitro serves `./uploads/` for local dev

### Image Processing
- New `packages/server/src/image.ts` — sharp resizes to WebP variants (150/300/600/1200px)
- Upload API (`POST /api/files/upload`) processes images automatically
- Delete API cleans up from storage adapter

### Product Autocomplete in PartsListBlock (BOM → Gallery)
- PartsListBlock has debounced product catalog search (`GET /api/products?q=...`)
- Selecting a product stores `productId` on the part
- Edit page syncs `content_products` join table on every save via `PUT /api/content/:id/products`
- This is the end-to-end BOM→product hub gallery feature

### DOMPurify Sanitization
- `isomorphic-dompurify` sanitizes all HTML in block tuples before DB write
- Applied in both `createContent()` and `updateContent()`

### Critical API Bug Fixes
- **CommentSection** was completely broken — wrong params (`contentId` vs `targetType`+`targetId`), wrong field names (`body` vs `content`), wrong auth check. Fixed + updated all 5 view page usages.
- **EngagementBar** was sending `{ contentId }`, APIs expect `{ targetType, targetId }`. Fixed.
- **Contest `updateContest()`** had no ownership check. Added userId param + 403.

### New Functionality
- `listUserBookmarks()` server function + `GET /api/social/bookmarks` route
- Dashboard rewritten: stats row, 3 tabs (content/bookmarks/learning), drafts+published sections
- Messages "New Message" dialog wired to create conversation + navigate

### New Pages
- `/explore` — Content/Hubs/Learn tabs with type filters and sort
- `/tags/[slug]` — Tag content listing with pagination
- `/videos/[id]` — Video detail with YouTube/Vimeo embed

### Editor Polish (from session start)
- Slash command (`/` in TextBlock), floating text toolbar, auto-save (30s + Ctrl+S), beforeunload guard
- `replaceBlock()` composable method

### Cleanup
- Deleted 3 dead components (EditorBlockLibrary, EditorToolbar, FloatingToolbar)
- Restored 2 needed for Phase 4.4 (EditorShell, EditorPropertiesPanel)

### Dependencies Added
- `sharp`, `@aws-sdk/client-s3`, `isomorphic-dompurify`, `@types/sharp`

## Build & Test
- 11 build tasks, 12 test tasks, zero failures, 1,021+ tests pass

### Editor Fixes (end of session)
Thorough audit of all 14 block components, BlockCanvas, BlockWrapper, BlockPicker, and mockup comparison. Found and fixed:

1. **Block picker showed at bottom of canvas** — When clicking an insert zone, the picker rendered after the entire block list instead of at the insert position. Fixed: picker now renders inline right after the insert zone that triggered it, using `pickerInsertIndex` to determine which zone.

2. **Empty state was non-interactive** — User saw "Start writing" but had to find and click the tiny insert zone. Fixed: clicking the empty state creates a first paragraph block. Added hover styling to signal clickability.

3. **ImageBlock file upload was fake** — Used `URL.createObjectURL()` which is lost on reload. Now actually uploads to `/api/files/upload`, gets back a permanent URL, shows upload progress and error states.

4. **Block controls overlapped content** — The move/clone/delete buttons were positioned `top: -1px` overlapping the block's top-right corner. Moved to `top: -30px` so they float above the block.

5. **No keyboard navigation between blocks** — Added Enter-at-end (creates new paragraph below) and Backspace-in-empty (deletes block) via TipTap keyboard shortcuts extension. Events bubble from TextBlock to BlockCanvas.

6. **ROOT CAUSE: Blocks rendered as empty/uneditable** — `<component :is="'EditorsBlocksTextBlock'">` with a string name does NOT work with Nuxt auto-imports. Nuxt auto-imports are compile-time transforms — they transform `<EditorsBlocksTextBlock />` in templates into actual imports at build time. But `<component :is>` with a raw string tries to look up the component in Vue's runtime global registry, where Nuxt auto-imported components DON'T exist. Vue silently renders nothing (an empty element with the string as tag name). **Fix:** Changed `blockComponentName()` (returned strings) to `getBlockComponent()` (returns `resolveComponent()` results). `resolveComponent()` is the Nuxt-provided runtime function that bridges this gap.

## What's Remaining (Priority Order)
1. **Fix editors** — blocks not working after insertion, UX doesn't match mockups, fragmented
2. **Homepage richness** — Feed cards, featured makers, learning paths
3. **Profile editor** — Dedicated layout matching mockup
4. **Editor consolidation** — Merge 4 editors into EditorShell
5. **Full lifecycle E2E tests** — Content+BOM, hub, learning flows
6. **Seed script** — Realistic data with BOM links
7. **WebSocket messaging**
8. **Password recovery / email verification**
