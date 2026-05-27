/**
 * Component-level tests for SectionEditorial — Phase 1c data section.
 *
 * Mirrors SectionContentFeed.test.ts shape: stub useFetch, assert the
 * resolved /api/content query, then assert render branches (heading,
 * grid, empty, loading).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/vue';
import { ref, defineComponent, h } from 'vue';
import SectionEditorial from '../SectionEditorial.vue';

const meta = {
  route: '/',
  zone: 'main',
  isPreview: false,
  effectiveColSpan: 12,
  sectionId: 'editorial-1',
};

interface EditorialConfigForTest extends Record<string, unknown> {
  heading: string;
  limit: number;
  columns: 1 | 2 | 3 | 4;
}

const baseConfig: EditorialConfigForTest = {
  heading: 'Staff Picks',
  limit: 3,
  columns: 3,
};

type FetchCall = { url: string; query: Record<string, unknown>; key?: string };
let calls: FetchCall[] = [];

const ContentCardStub = defineComponent({
  name: 'ContentCard',
  props: { item: { type: Object, required: true } },
  setup(props) {
    return () => h('div', {
      'data-testid': 'editorial-card',
      'data-item-id': (props.item as { id: string }).id,
    });
  },
});

function mountEditorial(
  props: { config: typeof baseConfig; meta: typeof meta },
  fetchResult: { items?: Array<{ id: string }>; pending?: boolean } = {},
): void {
  (globalThis as Record<string, unknown>).useFetch = vi.fn().mockImplementation(
    (url: string, opts: { query: { value: Record<string, unknown> } | Record<string, unknown>; key?: string }) => {
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

  render(SectionEditorial, {
    props,
    global: { components: { ContentCard: ContentCardStub } },
  });
}

beforeEach(() => { calls = []; });
afterEach(() => {
  delete (globalThis as Record<string, unknown>).useFetch;
  document.body.innerHTML = '';
});

describe('SectionEditorial — query building', () => {
  it('sets editorial=true + sort=editorial + status=published', () => {
    mountEditorial({ meta, config: baseConfig });
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe('/api/content');
    expect(calls[0].query).toMatchObject({
      status: 'published',
      editorial: true,
      sort: 'editorial',
      limit: 3,
    });
  });

  it('clamps limit into [1, 12]', () => {
    mountEditorial({ meta, config: { ...baseConfig, limit: 999 } });
    expect((calls[0].query as { limit: number }).limit).toBe(12);

    calls = [];
    mountEditorial({ meta, config: { ...baseConfig, limit: 0 } });
    expect((calls[0].query as { limit: number }).limit).toBe(1);
  });
});

describe('SectionEditorial — render', () => {
  it('renders one card per item', () => {
    mountEditorial({ meta, config: baseConfig }, {
      items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    });
    expect(screen.queryAllByTestId('editorial-card').length).toBe(3);
  });

  it('shows the empty state when items is [] and not pending', () => {
    mountEditorial({ meta, config: baseConfig }, { items: [], pending: false });
    expect(document.querySelector('.cpub-section-editorial-empty')?.textContent?.trim())
      .toBe('No staff picks yet.');
  });

  it('shows the loading state while pending', () => {
    mountEditorial({ meta, config: baseConfig }, { items: [], pending: true });
    expect(document.querySelector('.cpub-section-editorial-loading')).not.toBeNull();
  });

  it('renders heading <h2> only when config.heading is set', () => {
    mountEditorial({ meta, config: { ...baseConfig, heading: '' } }, { items: [{ id: 'a' }] });
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();

    document.body.innerHTML = '';
    calls = [];
    mountEditorial({ meta, config: baseConfig }, { items: [{ id: 'a' }] });
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Staff Picks');
  });

  it('exposes data-columns for CSS to consume', () => {
    mountEditorial({ meta, config: { ...baseConfig, columns: 2 } }, { items: [{ id: 'a' }] });
    const grid = document.querySelector('.cpub-section-editorial-grid');
    expect(grid?.getAttribute('data-columns')).toBe('2');
  });
});
