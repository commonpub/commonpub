# Session 179 — keyset pagination, server core (Steps 1–3)

2026-05-31, continued from 178. Implemented the server-side half of the keyset
(cursor) pagination plan (`docs/plans/pagination-scalability.md`), TDD, additive,
nothing shipped yet. The offset path is untouched; the cutover is Step 4.

## What was done

### Step 1 — cursor helper (commit `0353f6c`)
`packages/server/src/query.ts` (next to `normalizePagination`/`countRows`):
- `encodeCursor(value, id)` — opaque base64url of `{v,id}`; `Date`→ISO string.
- `decodeCursor(cursor)` — returns `null` on ANY malformed input (caller falls back
  to page 1).
- `keysetWhere(sortCol, idCol, cursor)` — `NULLS LAST` total-order predicate, with a
  separate null-tail branch.
- `cursor.test.ts` (6 tests): pure round-trips + a DB-backed walk proving `keysetWhere`
  reproduces `ORDER BY publishedAt DESC NULLS LAST, id DESC` with no dups/gaps across
  page sizes 3/4/7/20, boundaries inside the tie-block and the null tail.

### Step 2 — composite indexes, migration 0012 (commit `37ccaf0`)
`packages/schema/src/content.ts` — two **partial** btree indexes over the always-true
feed predicate (`status='published' AND deleted_at IS NULL`):
- `idx_content_items_feed_recency` `(published_at DESC NULLS LAST, id DESC NULLS FIRST)`
- `idx_content_items_feed_popular`  `(view_count DESC NULLS FIRST, id DESC NULLS FIRST)`
- `feed-indexes.integration.test.ts` (2 tests): EXPLAIN under `enable_seqscan=off` +
  `ANALYZE` proves the planner USES each index (no Sort node).

**Two real bugs caught before shipping** (both = the "indexes only used if order
matches" memory):
1. NULLS placement is matched **syntactically**. `ORDER BY id DESC` is `id DESC NULLS
   FIRST` (Postgres' DESC default); an index spelling `id DESC NULLS LAST` is deemed
   inapplicable → query falls back to Sort, **even though `id` is NOT NULL**. Index
   must spell NULLS FIRST on id/view_count.
2. `pushSchema` (the PGlite test helper) **silently skips partial `WHERE` indexes** —
   the first EXPLAIN test was testing absent indexes. The test now executes the exact
   migration DDL itself (also validating the shipped SQL).

### Step 3 — listContentKeyset, keyset-merge (commit `7f491b7`)
`packages/server/src/content/content.ts`, additive:
- Extracted `listContent`'s inline WHERE block into shared `buildContentConditions`
  (offset path behavior-identical — verified by existing tests).
- `queryFederatedAsListItems` gains an optional `cursor` param.
- New `listContentKeyset(db, {...filters, cursor}, options) → { items, nextCursor }`:
  order fixed to recency; federated case = keyset-merge (fetch `limit+1` from each
  source past the cursor in one shared `compareFeedOrder`, merge, take `limit`);
  `hasMore` via the `(limit+1)`th row (no COUNT); `nextCursor` = last emitted item.
  popular/featured/editorial stay on the offset path (shallow listing views).
- Exported from the content barrel.
- `content-keyset.integration.test.ts` (5 tests): cursor walk = every item once in
  canonical order, no dups/gaps, through tie-block + null tail + the interleaved
  local+federated merge (20 items, every page disjoint, strictly descending).

### Audit + hardening (commit `04a78fb`)
Adversarial audit of the Step 1-3 core before any cutover:
- **Mutation-tested the suite** to prove it has teeth: flipping the JS tiebreaker
  direction in `compareFeedOrder` AND dropping the `isNull(sortCol)` branch in
  `keysetWhere` each produce dup/gap failures the new tests catch. The suite would
  have caught the byte-align bug class.
- **Fixed a real defensive bug**: `listContentKeyset` limit had no lower-bound floor
  (`Math.min(limit ?? 20, 100)`), so `limit<=0` → `.limit(limit+1)<=0` → Postgres
  rejects a negative LIMIT → 500. Now clamped to `[1,100]` (mirrors the offset path's
  `normalizePagination`). The endpoint's zod also guards this, but the fn is callable
  internally — defense in depth.
- **New `uuid-ordering-invariant.test.ts`**: empirically proves Postgres `uuid DESC`
  == JS string-desc over 500 random uuids. This is the load-bearing assumption under
  the cross-source merge (a JS-built cursor is fed back into a SQL `WHERE id < :id`);
  if it ever broke, cursors would mis-partition the SQL at a shared-timestamp tie.
- **Closed the biggest test gap**: the old federated test seeded local/federated 1 day
  apart, so the cross-source id tiebreaker (the exact byte-align-bug shape) was NEVER
  exercised. Added a cohort with local AND federated rows sharing the same publishedAt
  (+ a shared null cohort), walked at page sizes 1/2/3/5/7/30 against ground-truth.
- Robustness: malformed cursor → first page (never throws), empty set → null cursor,
  limit clamp, re-feed nextCursor advances without overlap.
- **Precision note (no code change needed)**: the driver returns ms-precision JS Date,
  but `published_at` is microsecond `timestamptz`. A sub-ms value would let a
  ms-truncated cursor skip rows. Verified ALL `publishedAt` write paths go through JS
  `Date` (ms) — `publishContent` does `new Date()`, federation does `new Date(iso)`,
  no DB-side `now()` default. So the round-trip is exact today. If a raw-SQL/migration
  ever writes sub-ms `published_at`, revisit (tolerance in keysetWhere or truncate on
  write). Left as a documented invariant.

## State
- Full server suite: **80 files, 1193 tests pass** (1175 + 18 new across 4 keyset test
  files), 0 regressions. New test files strict-`tsc` clean (note: `src/__tests__` is
  excluded from the server `typecheck` script — 43 PRE-EXISTING type errors in other
  test files are why; verified mine add zero).
- Migrations now **13** (0012 latest). server/layer npm still 2.70.0/0.42.0 — NOTHING
  published; all changes are server-internal + additive.
- The deferred byte-align release (2.71.0/0.43.0) is STILL pending — fold it into the
  Step 4 release.

## Next (Step 4 — the client cutover, ships)
1. Endpoint `layers/base/server/api/content/index.get.ts`: accept `?cursor=` + `limit`,
   return `{ items, nextCursor }` (keep `page`/`offset` working — dual-read).
2. Clients: `loadMore` in `ContentGridSection.vue`, base `pages/index.vue`, deveco
   `index.vue` (+ feed/search if infinite-scroll) → store + send `nextCursor`. ~8 funcs
   across the 3 repos. Mechanical but coordinate the release.
3. Release **server 2.71.0 / layer 0.43.0** (folds in the byte-align fix) + bump
   deveco/heatsync pins. Verify OVERLAP=0 on the live API (the session-178 method).

Backlog unchanged from 178: deveco-parity B–D, RBAC 2–4, E2E CI drift.
