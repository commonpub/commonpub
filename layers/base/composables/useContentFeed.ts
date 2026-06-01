import type { Serialized, ContentListItem } from '@commonpub/server';

/**
 * Unified content-feed loader with transparent keyset/offset pagination.
 *
 * Why this exists: the homepage, the homepage section renderer, and the deveco custom
 * homepage each hand-rolled the SAME load-more block (fetch next page, push, set
 * allLoaded) — three copies that drifted and each re-implemented the offset window
 * behind the load-more dup saga. This centralises it.
 *
 * Pagination strategy is chosen by sort, not by the caller:
 *  - RECENCY feeds (sort 'recent' / 'following' / undefined) use the scalable keyset
 *    endpoint `GET /api/content/feed` (O(limit)/page, no offset window, no COUNT) and
 *    page by the opaque `nextCursor`. This is what structurally fixes load-more dups.
 *  - NON-recency feeds (sort 'popular'/'featured'/'editorial') stay on the offset
 *    `GET /api/content` — keyset needs a stable total order, and viewCount/featured
 *    mutate, so a viewCount cursor would drift mid-scroll. Offset-popular is already
 *    dup-stable since the `id` tiebreaker (server 2.68), so this is not a regression.
 *
 * The caller passes a reactive query (the same shape it already builds). When the query
 * identity changes (tab switch), the feed re-fetches from the first page and pagination
 * state resets. Uniform surface regardless of strategy: { items, pending, loadMore,
 * canLoadMore, loadingMore }.
 */

type FeedQuery = Record<string, unknown> & { sort?: string; limit?: number };
/** Public item type callers consume (for ContentCard). */
export type FeedItem = Serialized<ContentListItem>;

// Wire response shape for BOTH endpoints (keyset → nextCursor, offset → total). The
// items are typed `Record<string, unknown>[]`, NOT `Serialized<ContentListItem>[]`, on
// purpose: feeding the deeply-recursive Serialized<…> mapped type through useFetch's own
// generic wrapper tripped TS2589 "excessively deep" under the consumer apps' stricter
// typecheck (deveco). We cast to FeedItem[] once, at the `items` boundary callers read.
interface FeedResponse { items: Array<Record<string, unknown>>; nextCursor?: string | null; total?: number }

export function useContentFeed(query: Ref<FeedQuery> | ComputedRef<FeedQuery>) {
  const toast = useToast();

  // Recency is the keyset-eligible order (sort 'recent', or unset → server default
  // recency). 'popular'/'featured'/'editorial' use mutable keys → stay on offset.
  const isKeyset = computed(() => {
    const s = query.value.sort;
    return s === undefined || s === 'recent';
  });
  const limit = computed(() => Number(query.value.limit ?? 12));

  // Keyset cursor for the current query identity (reset on query change below).
  const cursor = ref<string | null>(null);
  const loadingMore = ref(false);
  const exhausted = ref(false);

  // Initial page — SSR-friendly via useFetch. Both endpoints accept the same query;
  // the keyset one returns { items, nextCursor }, the offset one { items, total }.
  //
  // No explicit useFetch<…> generic: parameterising it makes TS instantiate useFetch's
  // own deep transform/pick generic machinery, which trips TS2589 "excessively deep"
  // under the consumer apps' stricter typecheck (deveco already @ts-ignores the same on
  // its own useFetch calls). We let it infer and read `data` through a typed `page`
  // computed cast to the shallow FeedResponse instead.
  const endpoint = computed(() => (isKeyset.value ? '/api/content/feed' : '/api/content'));
  // @ts-ignore TS2589: a computed endpoint that is a UNION of two typed routes makes
  // Nuxt's useFetch resolve typed route data for both, blowing the instantiation depth
  // under the consumer apps' stricter typecheck (deveco @ts-ignores the same on its own
  // useFetch calls). Runtime is unaffected; `data` is read through the typed `page` below.
  const { data, pending } = useFetch(endpoint, { query, watch: [query] });
  const page = computed<FeedResponse | null>(() => (data.value as FeedResponse | null) ?? null);

  // Local accumulator: the first page from useFetch, plus any load-more pages. Kept
  // separate from `data` so we never mutate the useFetch payload (which it re-creates
  // on refetch) — and so a tab switch cleanly replaces the list.
  const extra = ref<Array<Record<string, unknown>>>([]);
  // Single cast from the shallow wire type to the public FeedItem[] callers consume.
  const items = computed<FeedItem[]>(
    () => [...(page.value?.items ?? []), ...extra.value] as FeedItem[],
  );

  // Reset pagination whenever the underlying query (tab/filter) changes.
  watch(
    query,
    () => {
      extra.value = [];
      cursor.value = null;
      exhausted.value = false;
    },
    { deep: true },
  );

  // Seed the keyset cursor from the first page once it arrives.
  watch(
    page,
    (p) => {
      if (isKeyset.value) {
        cursor.value = p?.nextCursor ?? null;
        if (cursor.value === null) exhausted.value = true;
      }
    },
    { immediate: true },
  );

  const canLoadMore = computed(() => {
    if (!items.value.length) return false;
    if (exhausted.value) return false;
    if (isKeyset.value) return cursor.value !== null;
    // Offset: stop once a page comes back short.
    return true;
  });

  async function loadMore(): Promise<void> {
    if (loadingMore.value || exhausted.value) return;
    loadingMore.value = true;
    try {
      if (isKeyset.value) {
        if (!cursor.value) { exhausted.value = true; return; }
        const res = await $fetch<FeedResponse>('/api/content/feed', {
          query: { ...query.value, cursor: cursor.value },
        });
        if (res.items?.length) extra.value.push(...res.items);
        cursor.value = res.nextCursor ?? null;
        if (!res.nextCursor) exhausted.value = true;
      } else {
        const offset = items.value.length;
        const res = await $fetch<FeedResponse>('/api/content', {
          query: { ...query.value, offset },
        });
        if (res.items?.length) extra.value.push(...res.items);
        if (!res.items?.length || res.items.length < limit.value) exhausted.value = true;
      }
    } catch {
      toast.error('Failed to load more');
    } finally {
      loadingMore.value = false;
    }
  }

  return { items, pending, loadMore, canLoadMore, loadingMore };
}
