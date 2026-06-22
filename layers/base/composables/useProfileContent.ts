import type { Serialized, ContentListItem } from '@commonpub/server';

/**
 * Per-tab keyset content loader for a user profile.
 *
 * The profile page used to fetch one page of all the user's published content
 * and split it into tabs client-side, so a tab with many items was silently
 * truncated and an owner never saw their drafts. This loads the active tab's
 * slice from `GET /api/users/[username]/content` with keyset pagination (the
 * server endpoint orders by publishedAt DESC NULLS LAST, id DESC) and pages by
 * the opaque `nextCursor` — the same dup-safe strategy as useContentFeed, but
 * pointed at the per-user endpoint (kept separate so the homepage feed loader
 * stays untouched).
 *
 * The caller passes a reactive query ({ type?, drafts?, limit }). When the query
 * identity changes (tab switch) the feed re-fetches from the first page and the
 * accumulator resets. Draft visibility is enforced server-side from the
 * authenticated viewer; `drafts: 'true'` is only a request.
 */
export type ProfileFeedItem = Serialized<ContentListItem>;

type ProfileQuery = Record<string, unknown> & { limit?: number };

// Shallow wire type. Items are Array<Record<string, unknown>> (not the deep
// Serialized<…> mapped type) to avoid TS2589 "excessively deep" through
// useFetch's own generic machinery under the consumer apps' stricter typecheck;
// we cast once to ProfileFeedItem[] at the `items` boundary callers read.
interface ProfileFeedResponse { items: Array<Record<string, unknown>>; nextCursor?: string | null }

export function useProfileContent(username: string, query: Ref<ProfileQuery> | ComputedRef<ProfileQuery>) {
  const toast = useToast();

  const endpoint = `/api/users/${username}/content`;
  // @ts-ignore TS2589: parameterising useFetch with the deep Serialized type blows
  // the instantiation depth under the consumer apps' stricter typecheck. Runtime is
  // unaffected; `data` is read through the typed `page` computed below.
  const { data, pending } = useFetch(endpoint, { query, watch: [query] });
  const page = computed<ProfileFeedResponse | null>(() => (data.value as ProfileFeedResponse | null) ?? null);

  // Accumulator for load-more pages, kept separate from the useFetch payload so a
  // tab switch cleanly replaces the list.
  const extra = ref<Array<Record<string, unknown>>>([]);
  const cursor = ref<string | null>(null);
  const loadingMore = ref(false);
  const exhausted = ref(false);

  const items = computed<ProfileFeedItem[]>(
    () => [...(page.value?.items ?? []), ...extra.value] as ProfileFeedItem[],
  );

  // Reset pagination whenever the tab/filter changes.
  watch(query, () => {
    extra.value = [];
    cursor.value = null;
    exhausted.value = false;
  }, { deep: true });

  const canLoadMore = computed(() => {
    if (exhausted.value) return false;
    // The next cursor is whatever the last load-more returned, else the first page's.
    return (cursor.value ?? page.value?.nextCursor ?? null) != null;
  });

  async function loadMore(): Promise<void> {
    if (loadingMore.value || !canLoadMore.value) return;
    const next = cursor.value ?? page.value?.nextCursor ?? null;
    if (!next) return;
    loadingMore.value = true;
    try {
      const res = await $fetch<ProfileFeedResponse>(endpoint, {
        query: { ...query.value, cursor: next },
      });
      extra.value.push(...res.items);
      cursor.value = res.nextCursor ?? null;
      if (!res.nextCursor) exhausted.value = true;
    } catch {
      toast.error('Failed to load more');
    } finally {
      loadingMore.value = false;
    }
  }

  return { items, pending, loadMore, canLoadMore, loadingMore };
}
