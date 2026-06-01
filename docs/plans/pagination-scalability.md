# Pagination scalability audit + elegant target

**Question (from the user):** is the feed pagination "the most efficient and elegant way…
we don't want to be a bottleneck at thousands of users"?

**Verdict:** the recent fixes made it **correct** (chronological federated merge + unique `id`
tiebreaker), and the tiebreaker is the prerequisite for the elegant target. But the current
**OFFSET + in-app federated merge + per-request `COUNT(*)` + no sort indexes** design is **not**
scale-optimal. Below: the bottlenecks (with big-O) and the elegant target.

## Where the bottlenecks are (`packages/server/src/content/content.ts` `listContent`)

1. **No composite indexes back the ORDER BY.** `contentItems` has only single-column indexes
   (`status`, `type`, `published_at`, `is_editorial`, …). So:
   - `sort:'popular'` → `ORDER BY view_count DESC, …` — **there is no `view_count` index at all**
     → full scan + top-N sort on every popular query.
   - default/recency → only `published_at` is indexed; the `(created_at,id)` tiebreak still sorts.
   - **Every feed load does a sort.** At thousands of concurrent users this is the dominant cost.

2. **`COUNT(*)` on every request, unused by the feed clients.** `countRows` runs
   `SELECT count(*)` over the filtered set on every `listContent` call (in the `Promise.all`).
   The homepage/feed clients (`ContentGridSection`, `pages/index.vue`, deveco `index.vue`) decide
   "has more" via `items.length < limit` and **never read `.total`**. Search/listing read `total`
   only on the **first** page. So load-more requests pay a full count for nothing.

3. **OFFSET pagination is O(offset).** `LIMIT n OFFSET m` scans and discards `m` rows each page.
   Bounded by browse depth (most users shallow), but deep infinite-scroll degrades.

4. **Federated-merge is O(offset) per page → O(M²) to scroll M pages.** For seamless-federation
   instances (commonpub.io, deveco), each page fetches `offset+limit` rows from **each** source,
   merges + sorts in app memory, slices `[offset, offset+limit)`. Page N redoes all prior work.
   This is the least scalable part.

## Elegant target (industry-standard for feeds)

**A. Composite indexes** (safe, additive, no API change — do first):
- partial `WHERE status='published'` on `(published_at DESC, id DESC)` — recency feed.
- partial on `(view_count DESC, id DESC)` — popular feed (non-federation instances).
- `(status, type, published_at DESC, id DESC)` — type-filtered listings.
- Turns the per-query sort into an index range scan. Verify with `EXPLAIN ANALYZE` on seeded data
  (memory: Drizzle indexes only used if the WHERE/ORDER BY matches — design + measure, don't guess).

**B. Count only on the first page** (safe, no client breakage):
- `const total = offset === 0 ? await countRows(...) : -1;` — load-more skips the COUNT entirely.
  First-page search/listing still get the exact count they display.

**C. Keyset / cursor pagination** (the elegant core — API + client change):
- `WHERE (sort_val, id) < (:cursorVal, :cursorId) ORDER BY sort_val DESC, id DESC LIMIT n+1`.
  O(limit) per page regardless of depth; `n+1` row tells you `hasMore` (no COUNT). The unique `id`
  tiebreaker already shipped is exactly the cursor's total-order requirement.
- Federated merge becomes keyset-merge: fetch `n+1` from each source `WHERE (key,id) < cursor`,
  merge two small sorted lists (O(limit)), emit the new cursor. Kills the O(M²).
- API: `?cursor=…` instead of `?offset=…`; clients send back the last item's cursor. Backward-compat
  by accepting both for a transition window.

**D. Long-term — unified timeline table** (only if federation grows large):
- Materialize local + federated content into one `feed_items` table with a common indexed sort key,
  so a merged feed is a SINGLE keyset query over one index — no in-app merge at all.

## Phasing
1. **A + B now** — composite indexes + first-page-only count. Safe, additive, biggest per-request
   win, no API/client change. (~1 migration + a few lines in `listContent`.)
2. **C** — keyset pagination for feed endpoints + client updates. The elegant core; removes deep-page
   and federated O(M²). Accept `offset` and `cursor` during transition.
3. **D** — unified timeline table, if/when federated volume warrants.

## Note
The chronological-merge + tiebreaker fixes (server 2.68→2.70) are **not throwaway** — keyset needs
the total-order tiebreaker, and the merge must stay chronological. They're the foundation for C.
