/**
 * Tests for useProfileContent — the per-tab keyset loader for the profile page.
 *
 * Locks the behaviour that matters: pages by nextCursor, stops when it's null,
 * threads the cursor into the load-more $fetch, and resets the accumulator when
 * the query (tab) changes. useFetch / $fetch / useToast are Nuxt auto-imports
 * shimmed on globalThis; useFetch is modelled as an eager one-shot that re-runs
 * when its watched query changes. Vue primitives come from test-setup.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, computed, nextTick, watch, type Ref } from 'vue';

interface Item { id: string }
interface FetchCall { url: string; query: Record<string, unknown> }

const g = globalThis as Record<string, unknown>;

let fetchCalls: FetchCall[];
let fetchQueue: Array<{ items: Item[]; nextCursor?: string | null }>;
let initialPageProvider: (query: Record<string, unknown>) => { items: Item[]; nextCursor?: string | null };

function installShims(): void {
  g.useToast = () => ({ error: vi.fn(), success: vi.fn() });
  g.$fetch = vi.fn((url: string, opts?: { query?: Record<string, unknown> }) => {
    fetchCalls.push({ url, query: opts?.query ?? {} });
    const next = fetchQueue.shift() ?? { items: [], nextCursor: null };
    return Promise.resolve(next);
  });
  g.useFetch = (endpoint: unknown, opts: { query: Ref<Record<string, unknown>> }) => {
    const data = ref<{ items: Item[]; nextCursor?: string | null } | null>(null);
    const pending = ref(true);
    const run = (): void => {
      data.value = initialPageProvider(opts.query.value);
      pending.value = false;
    };
    run();
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

const { useProfileContent } = await import('../useProfileContent');

describe('useProfileContent', () => {
  it('threads nextCursor through load-more and appends pages', async () => {
    initialPageProvider = () => ({ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'CUR1' });
    const query = computed(() => ({ type: 'project', limit: 2 }));
    const feed = useProfileContent('alice', query);
    await nextTick();

    expect(feed.items.value.map((i) => i.id)).toEqual(['a', 'b']);
    expect(feed.canLoadMore.value).toBe(true);

    fetchQueue = [{ items: [{ id: 'c' }, { id: 'd' }], nextCursor: 'CUR2' }];
    await feed.loadMore();

    expect(fetchCalls[0]!.url).toBe('/api/users/alice/content');
    expect(fetchCalls[0]!.query).toMatchObject({ type: 'project', cursor: 'CUR1' });
    expect(feed.items.value.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(feed.canLoadMore.value).toBe(true);
  });

  it('stops loading once nextCursor is null', async () => {
    initialPageProvider = () => ({ items: [{ id: 'a' }], nextCursor: 'CUR1' });
    const query = computed(() => ({ type: 'project', limit: 1 }));
    const feed = useProfileContent('alice', query);
    await nextTick();

    fetchQueue = [{ items: [{ id: 'b' }], nextCursor: null }];
    await feed.loadMore();
    expect(feed.canLoadMore.value).toBe(false);

    await feed.loadMore(); // no-op now
    expect(fetchCalls.length).toBe(1);
  });

  it('resets the accumulator when the query (tab) changes', async () => {
    initialPageProvider = (q) => q.drafts
      ? { items: [{ id: 'draft-1' }], nextCursor: null }
      : { items: [{ id: 'pub-1' }], nextCursor: 'CUR1' };
    const drafts = ref(false);
    const query = computed(() => ({ type: 'project', ...(drafts.value ? { drafts: 'true' } : {}), limit: 12 }));
    const feed = useProfileContent('alice', query);
    await nextTick();

    fetchQueue = [{ items: [{ id: 'pub-2' }], nextCursor: 'CUR2' }];
    await feed.loadMore();
    expect(feed.items.value.map((i) => i.id)).toEqual(['pub-1', 'pub-2']);

    // Switch to the Drafts tab — accumulator + cursor reset, first page replaced.
    drafts.value = true;
    await nextTick();
    expect(feed.items.value.map((i) => i.id)).toEqual(['draft-1']);
    expect(feed.canLoadMore.value).toBe(false);
  });
});
