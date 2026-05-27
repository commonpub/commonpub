/**
 * Component-level tests for SectionContentFeed — the first DATA section.
 *
 * The contract: builds an /api/content query from config, renders a
 * ContentCard per item in a responsive grid, surfaces a friendly empty
 * state, drops empty config fields from the query (per `feedback_*` —
 * empty string ≠ filter).
 *
 * useFetch is stubbed globally because it's a Nuxt auto-import not present
 * in the vitest jsdom env. Per docs/plans/layout-and-pages.md §10.2 +
 * `feedback_integration_test_full_output_path`: the assertion targets are
 * the actual query the section builds + the rendered DOM — NOT the
 * implementation's call ordering.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/vue';
import { ref, defineComponent, h } from 'vue';
import SectionContentFeed from '../SectionContentFeed.vue';

const meta = {
  route: '/',
  zone: 'main',
  isPreview: false,
  effectiveColSpan: 12,
  sectionId: 'feed-1',
};

// Explicit union types so spread + override (`{ ...baseConfig, sort: 'popular' }`)
// works. Without this, `as const` would narrow sort/columns to their literal
// values and vue-tsc strict (NOT vitest+esbuild) rejects assignments to other
// valid union members. Closes feedback_vue_tsc_strict_vs_vitest pattern at
// the test-fixture level.
interface FeedConfigForTest extends Record<string, unknown> {
  heading: string;
  contentType: string;
  sort: 'recent' | 'popular' | 'featured' | 'editorial';
  limit: number;
  columns: 1 | 2 | 3 | 4;
  tag: string;
  featured: boolean;
}

const baseConfig: FeedConfigForTest = {
  heading: '',
  contentType: '',
  sort: 'recent',
  limit: 6,
  columns: 3,
  tag: '',
  featured: false,
};

// Capture every useFetch call so tests can assert the resolved query.
type FetchCall = { url: string; query: Record<string, unknown>; key?: string };
let calls: FetchCall[] = [];

// Stub ContentCard — exposes a testid + the item id so we can count + verify
const ContentCardStub = defineComponent({
  name: 'ContentCard',
  props: { item: { type: Object, required: true } },
  setup(props) {
    return () => h('div', {
      'data-testid': 'content-card',
      'data-item-id': (props.item as { id: string }).id,
    });
  },
});

/**
 * Test harness — the section calls useFetch without top-level await, so
 * no Suspense wrapper is needed. The mock returns refs that are already
 * populated, and the component renders against them on first paint.
 */
function mountFeed(
  props: { config: typeof baseConfig; meta: typeof meta },
  fetchResult: { items?: Array<{ id: string }>; pending?: boolean } = {},
): void {
  (globalThis as Record<string, unknown>).useFetch = vi.fn().mockImplementation(
    (url: string, opts: { query: { value: Record<string, unknown> } | Record<string, unknown>; key?: string }) => {
      // Query in this component is a `computed` Ref, so it comes through as
      // `{ value: {...} }`. Unwrap for the captured call record.
      const rawQuery = opts?.query;
      const query =
        rawQuery && typeof rawQuery === 'object' && 'value' in rawQuery
          ? (rawQuery as { value: Record<string, unknown> }).value
          : (rawQuery as Record<string, unknown>) ?? {};
      calls.push({ url, query, key: opts?.key });
      return {
        data: ref({ items: fetchResult.items ?? [], total: (fetchResult.items ?? []).length }),
        pending: ref(fetchResult.pending ?? false),
      };
    },
  );

  render(SectionContentFeed, {
    props,
    global: { components: { ContentCard: ContentCardStub } },
  });
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).useFetch;
  document.body.innerHTML = '';
});

describe('SectionContentFeed — query building', () => {
  it('forwards sort + limit + status=published always', async () => {
    mountFeed({ meta, config: { ...baseConfig, sort: 'popular', limit: 9 } });
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe('/api/content');
    expect(calls[0].query).toMatchObject({ status: 'published', sort: 'popular', limit: 9 });
  });

  it('clamps limit into [1, 24]', async () => {
    mountFeed({ meta, config: { ...baseConfig, limit: 999 } });
    expect((calls[0].query as { limit: number }).limit).toBe(24);

    calls = [];
    mountFeed({ meta, config: { ...baseConfig, limit: 0 } });
    expect((calls[0].query as { limit: number }).limit).toBe(1);
  });

  it('omits empty contentType / tag (no empty-string filter trap)', async () => {
    mountFeed({ meta, config: { ...baseConfig, contentType: '', tag: '' } });
    const q = calls[0].query as Record<string, unknown>;
    expect('type' in q).toBe(false);
    expect('tag' in q).toBe(false);
  });

  it('forwards contentType + tag when set', async () => {
    mountFeed({
      meta,
      config: { ...baseConfig, contentType: 'project', tag: 'electronics' },
    });
    expect(calls[0].query).toMatchObject({ type: 'project', tag: 'electronics' });
  });

  it('forwards featured: true only when explicitly true', async () => {
    mountFeed({ meta, config: { ...baseConfig, featured: true } });
    expect((calls[0].query as { featured: boolean }).featured).toBe(true);

    calls = [];
    mountFeed({ meta, config: { ...baseConfig, featured: false } });
    expect('featured' in (calls[0].query as Record<string, unknown>)).toBe(false);
  });
});

describe('SectionContentFeed — render', () => {
  it('renders one ContentCard per item', async () => {
    mountFeed({ meta, config: baseConfig }, {
      items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    });
    const cards = screen.queryAllByTestId('content-card');
    expect(cards.length).toBe(3);
    expect(cards.map((c) => c.getAttribute('data-item-id'))).toEqual(['a', 'b', 'c']);
  });

  it('shows the empty state when items is [] and pending is false', async () => {
    mountFeed({ meta, config: baseConfig }, { items: [], pending: false });
    expect(screen.queryAllByTestId('content-card').length).toBe(0);
    expect(document.querySelector('.cpub-section-content-feed-empty')?.textContent?.trim()).toBe(
      'No content yet.',
    );
  });

  it('shows the loading state while pending', async () => {
    mountFeed({ meta, config: baseConfig }, { items: [], pending: true });
    expect(document.querySelector('.cpub-section-content-feed-loading')).not.toBeNull();
    expect(document.querySelector('.cpub-section-content-feed-empty')).toBeNull();
  });

  it('renders heading <h2> only when config.heading is set', async () => {
    mountFeed({ meta, config: { ...baseConfig, heading: '' } }, { items: [{ id: 'a' }] });
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();

    document.body.innerHTML = '';
    calls = [];
    mountFeed(
      { meta, config: { ...baseConfig, heading: 'Latest builds' } },
      { items: [{ id: 'a' }] },
    );
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2.textContent?.trim()).toBe('Latest builds');
  });

  it('exposes data-columns for CSS to consume', async () => {
    mountFeed({ meta, config: { ...baseConfig, columns: 2 } }, { items: [{ id: 'a' }] });
    const grid = document.querySelector('.cpub-section-content-feed-grid');
    expect(grid?.getAttribute('data-columns')).toBe('2');
  });
});
