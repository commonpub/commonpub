# Session 073 — Content Management UI, Auth Fix, Edge AI Removal

**Date:** 2026-03-25
**Scope:** Dashboard delete/unpublish UI, auth origin fix, edge AI removal, Discord link
**Status:** Complete

## Changes

### 1. Dashboard Content Actions (commonpub + deveco-io)

Added unpublish and delete buttons to the user dashboard in both repos.

**Files changed:**
- `apps/reference/pages/dashboard.vue` (commonpub)
- `pages/dashboard.vue` (deveco-io)

**What was added:**
- **Unpublish button** (eye-slash icon) on published content rows — sets status to `draft` via `PUT /api/content/[id]`
- **Delete button** (trash icon) on both draft and published rows — soft deletes via `DELETE /api/content/[id]`
- Confirmation dialogs before both actions
- Loading spinner per-item while action is in progress
- Toast feedback on success/failure
- `refreshNuxtData()` to re-fetch dashboard data after mutations

**Backend already existed** — no server changes needed:
- `deleteContent()` in `@commonpub/server` → sets `status='archived'`, `deletedAt=now()`
- `updateContent()` with `{ status: 'draft' }` → unpublishes
- Both enforce ownership (authorId match)

### 2. Auth "Invalid Origin" Fix

**Root cause:** Better Auth validates request origin against `baseURL`. When Nuxt picks a different port (3000 occupied → 3003), auth requests are rejected.

**Fix:**
- Added `trustedOrigins` parameter to `@commonpub/auth` (`createAuth.ts`, `types.ts`)
- Server middleware passes localhost ports 3000-3005 as trusted in dev mode
- Production uses only the configured `siteUrl`

**Files changed:**
- `packages/auth/src/createAuth.ts`
- `packages/auth/src/types.ts`
- `apps/reference/server/middleware/auth.ts`

### 3. Remove Edge AI References

Replaced all edge AI / TinyML / hardware-specific content in the reference app with generic maker community content.

**Files changed:**
- `pages/index.vue` — SEO meta
- `pages/learn/index.vue` — hero title
- `pages/videos/index.vue` — hero subtitle
- `pages/search.vue` — tag suggestions, categories
- `pages/contests/create.vue` — placeholder
- `pages/products/index.vue` — description
- `scripts/seed.ts` — all user bios, content, hubs, tags, videos, contests, learning paths
- `e2e/seo.spec.ts` — meta assertion
- `__tests__/contest-slug.test.ts` — test case

### 4. Discord Link

Updated footer Discord link from placeholder `discord.gg/commonpub` to `discord.gg/uncPaJ5SwV`.

**File:** `apps/reference/layouts/default.vue`

## Test Results

- Reference app: 47/47 passed
- Server package: 312/312 passed (1 skipped, pre-existing)
- Auth package: 42/42 passed
- Pre-existing failure: `@commonpub/docs` markdown rendering timeout (unrelated)

## Decisions

- **Soft delete only** — user delete sets `status='archived'` + `deletedAt`, no hard delete
- **Confirmation required** — both unpublish and delete require `confirm()` dialog
- **Per-item loading** — action buttons show spinner only for the item being acted on
- **trustedOrigins in dev** — hardcoded port range 3000-3005 rather than wildcard, keeps security meaningful

## Open Questions

- Should there be an "undo" / "restore from archive" UI? Currently archived content is invisible to users.
- Should the content detail page (view mode) also show unpublish/delete for the author?
