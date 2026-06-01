/**
 * Tests for useContentFeed — the unified keyset/offset feed loader.
 *
 * The composable's job is to choose the right pagination strategy by sort and thread
 * the cursor/offset correctly through load-more, exposing one uniform surface. These
 * lock the behaviour that matters for the load-more dup fix:
 *   - recency sort (or unset) → keyset endpoint, pages by nextCursor, stops when null
 *   - popular/featured → offset endpoint, pages by items.length, stops on a short page
 *   - switching the query (tab change) resets accumulated items + cursor
 *
 * useFetch / $fetch / useToast are Nuxt auto-imports; we shim them on globalThis.
 * useFetch is modelled as an eager one-shot that resolves the initial page and
 * re-runs when its watched query changes (enough to exercise the composable's logic
 * without a real Nuxt runtime). Vue primitives come from test-setup.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, computed, nextTick, watch, type Ref } from 'vue';

interface Item { id: string }
interface FetchCall { url: string; query: Record<string, unknown> }

const g = globalThis as Record<string, unknown>;

// Records every $fetch (load-more) call so tests can assert cursor/offset threading.
let fetchCalls: FetchCall[];
// Queue of responses $fetch returns, in order.
let fetchQueue: Array<{ items: Item[]; nextCursor?: string | null }>;

// useFetch shim: resolves `query` (a ref/computed or getter) to its current value,
// returns { data, pending } refs, and re-runs the loader when watched deps fire. We
// model the INITIAL page as a synchronous resolve from a per-test provider.
let initialPageProvider: (query: Record<string, unknown>) => { items: Item[]; nextCursor?: string | null };

function installShims(): void {
  g.useToast = () => ({ error: vi.fn(), success: vi.fn() });
  g.$fetch = vi.fn((url: string, opts?: { query?: Record<string, unknown> }) => {
    fetchCalls.push({ url, query: opts?.query ?? {} });
    const next = fetchQueue.shift() ?? { items: [], nextCursor: null };
    return Promise.resolve(next);
  });
  // useFetch(endpoint, { query, watch }) — endpoint may be a ref/computed.
  g.useFetch = (endpoint: unknown, opts: { query: Ref<Record<string, unknown>> }) => {
    const data = ref<{ items: Item[]; nextCursor?: string | null } | null>(null);
    const pending = ref(true);
    const run = (): void => {
      const q = opts.query.value;
      data.value = initialPageProvider(q);
      pending.value = false;
    };
    run();
    // Re-run when the query changes (Nuxt's watch: [query]).
    watch(opts.query, run, { deep: true });
    return { data, pending };
  };
}

beforeEach(() => {
  fetchCalls = [];
  fetchQueue = [];
  installShims();
});

afterEach(() => {
  vi.clearAllMocks();
  delete g.useToast; delete g.$fetch; delete g.useFetch;
});

const { useContentFeed } = await import('../useContentFeed');

describe('useContentFeed — keyset (recency) strategy', () => {
  it('uses /api/content/feed and threads nextCursor through load-more', async () => {
    initialPageProvider = () => ({ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'CUR1' });
    const query = computed(() => ({ status: 'published', sort: 'recent', limit: 2 }));
    const feed = useContentFeed(query);
    await nextTick();

    expect(feed.items.value.map((i) => i.id)).toEqual(['a', 'b']);
    expect(feed.canLoadMore.value).toBe(true);

    fetchQueue = [{ items: [{ id: 'c' }, { id: 'd' }], nextCursor: 'CUR2' }];
    await feed.loadMore();
    expect(fetchCalls[0]!.url).toBe('/api/content/feed');
    expect(fetchCalls[0]!.query.cursor).toBe('CUR1'); // threaded the FIRST page's cursor
    expect(feed.items.value.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(feed.canLoadMore.value).toBe(true);

    fetchQueue = [{ items: [{ id: 'e' }], nextCursor: null }];
    await feed.loadMore();
    expect(fetchCalls[1]!.query.cursor).toBe('CUR2'); // threaded the SECOND page's cursor
    expect(feed.items.value.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(feed.canLoadMore.value).toBe(false); // nextCursor null → exhausted
  });

  it('treats an unset sort as recency (keyset)', async () => {
    initialPageProvider = () => ({ items: [{ id: 'x' }], nextCursor: 'C' });
    const feed = useContentFeed(computed(() => ({ status: 'published', limit: 12 })));
    await nextTick();
    fetchQueue = [{ items: [{ id: 'y' }], nextCursor: null }];
    await feed.loadMore();
    expect(fetchCalls[0]!.url).toBe('/api/content/feed');
  });

  it('does not load more when the first keyset page has a null cursor', async () => {
    initialPageProvider = () => ({ items: [{ id: 'only' }], nextCursor: null });
    const feed = useContentFeed(computed(() => ({ sort: 'recent', limit: 12 })));
    await nextTick();
    expect(feed.canLoadMore.value).toBe(false);
  });
});

describe('useContentFeed — offset (popular) strategy', () => {
  it('uses /api/content with offset and stops on a short page', async () => {
    initialPageProvider = () => ({ items: [{ id: 'p1' }, { id: 'p2' }] });
    const query = computed(() => ({ status: 'published', sort: 'popular', limit: 2 }));
    const feed = useContentFeed(query);
    await nextTick();
    expect(feed.canLoadMore.value).toBe(true);

    fetchQueue = [{ items: [{ id: 'p3' }, { id: 'p4' }] }];
    await feed.loadMore();
    expect(fetchCalls[0]!.url).toBe('/api/content');
    expect(fetchCalls[0]!.query.offset).toBe(2); // items.length so far
    expect(fetchCalls[0]!.query.cursor).toBeUndefined();
    expect(feed.items.value.map((i) => i.id)).toEqual(['p1', 'p2', 'p3', 'p4']);

    fetchQueue = [{ items: [{ id: 'p5' }] }]; // short page (< limit 2)
    await feed.loadMore();
    expect(fetchCalls[1]!.query.offset).toBe(4);
    expect(feed.canLoadMore.value).toBe(false);
  });
});

describe('useContentFeed — query change resets pagination', () => {
  it('clears accumulated items + cursor when the query identity changes', async () => {
    const sort = ref('recent');
    initialPageProvider = (q) => (q.sort === 'recent'
      ? { items: [{ id: 'r1' }], nextCursor: 'RC' }
      : { items: [{ id: 'pop1' }] });
    const feed = useContentFeed(computed(() => ({ sort: sort.value, limit: 12 })));
    await nextTick();

    // load a second keyset page
    fetchQueue = [{ items: [{ id: 'r2' }], nextCursor: 'RC2' }];
    await feed.loadMore();
    expect(feed.items.value.map((i) => i.id)).toEqual(['r1', 'r2']);

    // switch tab → query identity changes → reset + refetch first page of new feed
    sort.value = 'popular';
    await nextTick();
    expect(feed.items.value.map((i) => i.id)).toEqual(['pop1']); // accumulated 'r2' cleared
  });
});
