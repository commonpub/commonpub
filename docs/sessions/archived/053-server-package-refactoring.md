# Session 053: @commonpub/server Package Refactoring & Abstraction

## What Was Done

Major refactoring of the 8,665-line monolithic `@commonpub/server` package across 6 workstreams. Phase 1 (WS1-WS3) complete, Phase 2-3 (WS4-WS6) in progress.

### WS1: Generic Query Helpers (Complete)

Created `packages/server/src/query.ts` with shared helpers to eliminate ~500 lines of duplication:

- **`ensureUniqueSlugFor(db, table, slugCol, idCol, slug, fallback, excludeId?)`** — generic slug uniqueness check replacing 5 identical copy-pasted functions across utils.ts, hub.ts, product.ts, docs.ts, learning.ts
- **`USER_REF_SELECT` / `USER_REF_WITH_BIO_SELECT` / `USER_REF_WITH_HEADLINE_SELECT`** — const select shapes replacing 20+ inline `{ id: users.id, username: users.username, ... }` objects
- **`normalizePagination(opts)`** — `{ limit: Math.min(opts.limit ?? 20, 100), offset: opts.offset ?? 0 }` replacing identical 2-liner in 15+ list functions
- **`countRows(db, table, where?)`** — count query helper replacing identical `sql\`count(*)::int\`` subqueries
- **`buildPartialUpdates(input, fieldMap?)`** — filters undefined, adds updatedAt, optional key remapping

Files modified: content.ts, hub.ts, product.ts, learning.ts, docs.ts, social.ts, admin.ts, contest.ts, notification.ts, video.ts, utils.ts, index.ts

### WS2: Extract @commonpub/infra (Complete)

Created new `packages/infra/` package for framework-agnostic infrastructure:
- `storage.ts` — StorageAdapter, LocalStorageAdapter, S3StorageAdapter
- `image.ts` — processImage, getBestVariant, IMAGE_VARIANTS (sharp)
- `email.ts` — EmailAdapter, SmtpEmailAdapter, ConsoleEmailAdapter
- `security.ts` — CSP, security headers, rate limiting

Server originals replaced with thin re-export proxies. `@aws-sdk/client-s3` and `sharp` moved from `@commonpub/server` to `@commonpub/infra` deps.

### WS3: API Route Helpers (Complete)

Created `apps/reference/server/utils/validate.ts` with:
- **`parseBody(event, schema)`** — Zod parse + throw 400
- **`parseQueryParams(event, schema)`** — query string validation
- **`parseParams(event, { id: 'uuid', slug: 'slug' })`** — param extraction + type validation

Updated ALL 142 API route files:
- 42 files: replaced Zod `.safeParse` + `createError` boilerplate with `parseBody`
- 67 files: replaced `getRouterParam()!` / `getRouterParam() as string` with `parseParams`
- Removed ~30 redundant null checks that were superseded by `parseParams` validation
- Only 2 files retain `.safeParse` — they merge body + params before parsing (intentional)

### WS4: Internal Module Restructuring (Complete)

Moved all 13 domain modules into their own directories with index.ts re-exports:
- `content/`, `hub/`, `social/`, `learning/`, `product/`, `docs/`, `contest/`, `admin/`, `notification/`, `messaging/`, `video/`, `profile/`, `federation/`
- Root-level files kept: types.ts, query.ts, utils.ts, theme.ts, oauthCodes.ts, storage.ts (proxy), image.ts (proxy), email.ts (proxy), security.ts (proxy)
- Main index.ts updated to import from `./domain/index.js` paths
- package.json exports map updated with all 16 sub-path exports
- Test imports updated for new directory structure
- Did NOT sub-split hub.ts/product.ts/learning.ts further — they're cohesive within their directories and can be split later if needed

### WS5: Learning Consolidation (Complete)

- Verified clean layering: `@commonpub/learning` (pure logic) imported only by `packages/server/src/learning/learning.ts`
- JSDoc added to `packages/server/src/learning/index.ts` documenting the relationship

### WS6: Types Organization (Deferred)

- Decided to keep types.ts as single source of truth — it's a pure type file with no runtime cost
- Types are already well-organized by domain section with clear headers
- Moving types to domain directories would require updating imports in every domain module with minimal benefit
- Can be revisited if types.ts grows significantly larger

## Decisions Made

- **Re-export proxy pattern** for infra extraction: server files become thin re-exports from @commonpub/infra, maintaining full backward compatibility
- **Separate column params** for ensureUniqueSlugFor instead of generic constraint: `(db, table, slugCol, idCol, ...)` avoids TypeScript fights with Drizzle's complex column types
- **`USER_REF_SELECT` as const object** instead of function: can be spread directly into Drizzle `.select()` calls
- **parseBody/parseParams in server/utils** (not a package): these are Nitro/H3-specific, not framework-agnostic

## Open Questions

- Should the remaining 7 route files (that merge body fields before parse, e.g. `{ ...body, postId }`) be converted to use parseBody? They need the body + param merge first.
- Should hub.ts (1,310 lines) be further split into bans.ts, invites.ts, shares.ts in a future session?
- WS6 types co-location was deferred — revisit if types.ts grows beyond ~400 lines

## Final Audit Results

- `pnpm typecheck` for `@commonpub/server`: PASS (0 errors)
- `pnpm typecheck` for `@commonpub/infra`: PASS (0 errors)
- `getRouterParam` remaining in API routes: **0** (all converted to `parseParams`)
- `.safeParse` remaining in API routes: **2** (intentional — merge body+param before parse)
- Old slug functions remaining: **0** (only in JSDoc comments)
- `USER_REF_SELECT` unconverted: **14** (all are specialized selects with different field subsets — correct)
- Server src total lines: **8,047** (down from 8,665 — net reduction of 618 lines despite adding query.ts and index.ts files)

## Full Codebase Audit (Post-Refactoring)

Three-agent deep audit covering schema/validators, API routes/middleware, and server business logic.

### Critical Bugs Fixed

1. **Content product management missing ownership checks** (3 routes) — any authenticated user could modify products for ANY content
2. **Hub posts double readBody** — `readBody()` then `parseBody()` fails with "body already consumed"
3. **Sanitization fallback XSS** — silently passed unsanitized HTML; now strips all tags as fallback

### High Bugs Fixed

4. **Contest entries missing unique constraint** — added `unique(contestId, userId, contentId)`
5. **Certificates missing unique constraint** — added `unique(userId, pathId)`
6. **Build mark race condition** — wrapped in `db.transaction()`
7. **Pricing allows negative values** — added `.min(0)` to validators

### Medium Bugs Fixed

8. **Docs page circular parent** — now rejects `parentId === pageId`
9. **Comment deletion orphaning** — now cascades to child replies
10. **Duplicate JSDoc comment** — removed

### Second Audit — Additional Bugs Fixed

11. **CRITICAL: Lesson completion passing `undefined` as lessonId** — `complete.post.ts` called `lesson.id` but `getLessonBySlug` returns `{ lesson, module, pathId }` — so `lesson.id` was undefined. Fixed to `result.lesson.id`. Lesson completion was silently broken.

12. **HIGH: Hub join missing invite token passthrough** — `join.post.ts` never read request body to get `inviteToken`. Invite-only hubs were impossible to join via API. Now reads `body.inviteToken`.

13. **MEDIUM: like.get.ts used raw `.parse()` instead of `parseQueryParams()`** — inconsistent error format on validation failure. Fixed.

### Known Issues Documented (Not Fixed)

- **XSS in block renderers**: `BlockTextView.vue` and `BlockContentRenderer.vue` render `v-html` without client-side sanitization. Server sanitizes on save, but legacy data or sanitizer bypass would be exploitable. Should add DOMPurify client-side.
- Federation SSRF in `resolveRemoteActor()` — validate URLs against private IPs
- AP inbox signature verification missing — need HTTP Signatures per spec
- 12+ FK columns missing DB indexes — add before production scale
- Profile visibility enum exists but no validator/API to update it
- `estimatedMinutes` column exists but not in content validators
- 26 GET route query parsers still use `.parse()` instead of `parseQueryParams()` — functional but inconsistent error format
- `notifications/read.post.ts` doesn't validate `body.notificationId` as UUID

## Next Steps

- `drizzle-kit push` to apply unique constraint changes
- Add client-side DOMPurify to `BlockTextView.vue` and `BlockContentRenderer.vue`
- Add DB indexes for FK columns before scaling
- Add HTTP signature verification for AP inbox
- Convert remaining 26 `.parse(getQuery())` calls to `parseQueryParams()`
- Run full test suite when DB is available
