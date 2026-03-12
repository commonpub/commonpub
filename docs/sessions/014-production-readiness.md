# Session 014 — Production Readiness Fixes

**Date**: 2026-03-10
**Phase**: Post-QA hardening

## What was done

Deep audit of the entire codebase (41 tables, 68 routes, 24 enums) identified 20 unique issues across security, data integrity, and concurrency. All 15 fix groups implemented:

### P0 — Security Hotfixes (5 fixes)
1. **XSS via markdown pipeline**: Added `rehype-sanitize` to unified pipeline, disabled `allowDangerousHtml`, added `sanitizeHtml()` defense-in-depth wrapper on all `{@html}` usages
2. **IDOR on federation follow DELETE**: Added ownership check — verifies `followerActorUri` matches current user's actor URI before allowing deletion
3. **Admin form actions bypass layout guard**: Added explicit `role !== 'admin' && role !== 'staff'` checks to all 6 form actions across 4 admin `+page.server.ts` files
4. **Social API missing validation**: Added Zod validation schemas to like, comments, and bookmark endpoints; validates targetType against enum + targetId as UUID
5. **Banned users can reply**: Added `checkBan()` call in `createReply` after membership verification

### P1 — Data Integrity (3 fixes)
1. **Wrong denormalized count targets**: `toggleLike` now routes comment→`comments.likeCount`, post→`communityPosts.likeCount`. `createComment`/`deleteComment` route post→`communityPosts.replyCount`
2. **CASCADE delete doesn't decrement counts**: Added `deleteUser()` in admin.ts — counts affected likes/comments/memberships/enrollments, batch-decrements counters, then deletes (all in transaction)
3. **Enum/validator mismatches**: Added `'guide'` to `likeTargetTypeEnum`, `'explainer'` to `commentTargetTypeSchema` + `reportTargetTypeEnum` + `createReportSchema`

### P2 — Concurrency Hardening (7 fixes)
1. **toggleLike TOCTOU**: Wrapped in `db.transaction()`
2. **toggleBookmark TOCTOU**: Wrapped in `db.transaction()`
3. **Slug uniqueness race**: Added `isUniqueViolation()` helper for callers
4. **joinCommunity race**: Transaction + `INSERT...ON CONFLICT DO NOTHING`, only increments if actually inserted
5. **validateAndUseInvite race**: Atomic `UPDATE...WHERE (not expired AND not maxed)...RETURNING`
6. **markLessonComplete race**: Transaction + `SELECT...FOR UPDATE` on enrollment
7. **setDefaultVersion + reorders**: Wrapped all in `db.transaction()`

## Files modified
- `packages/docs/src/render/pipeline.ts` — rehype-sanitize + sanitizeHtml
- `packages/docs/src/index.ts` — export sanitizeHtml
- `packages/schema/src/enums.ts` — guide, explainer additions
- `packages/schema/src/validators.ts` — explainer additions
- `apps/reference/src/lib/server/social.ts` — count routing + transactions
- `apps/reference/src/lib/server/community.ts` — ban check, transaction, atomic invite
- `apps/reference/src/lib/server/learning.ts` — transaction wrapping
- `apps/reference/src/lib/server/docs.ts` — transaction wrapping
- `apps/reference/src/lib/server/admin.ts` — deleteUser function
- `apps/reference/src/lib/utils/slug.ts` — isUniqueViolation helper
- `apps/reference/src/lib/components/docs/DocsViewer.svelte` — sanitizeHtml
- `apps/reference/src/lib/components/docs/DocsSearch.svelte` — sanitizeHtml
- `apps/reference/src/routes/api/federation/follow/[id]/+server.ts` — ownership check
- `apps/reference/src/routes/(app)/admin/**` — role guards on actions
- `apps/reference/src/routes/api/social/**` — Zod validation
- `apps/reference/src/__tests__/social.test.ts` — mock updates
- `apps/reference/src/__tests__/community.test.ts` — mock updates

## Dependencies added
- `rehype-sanitize@^6.0.0` to `@commonpub/docs`
- `zod@^3.24.0` to `apps/reference` (was transitive, now explicit)

## Verification
- **Typecheck**: 0 errors, 71 warnings (pre-existing Svelte state refs)
- **Tests**: 944 tests pass across all 14 packages
- **Build**: Pre-existing `better-auth@1.5.4` incompatibility with zod v3 (uses `.meta()` from zod v4) — not caused by these changes

## Known issues (pre-existing)
- `better-auth@1.5.4` uses `z.coerce.boolean().meta()` which requires zod v4, but project uses zod v3 — causes reference app build failure. Needs better-auth upgrade or pin.

## Next steps
- Fix better-auth/zod compatibility (upgrade better-auth or add zod v4 compat shim)
- Deep sweep for any remaining issues
- Run locally with Docker, Lighthouse audit
- Tag v1.0.0
