/**
 * Component-level tests for SectionContests.
 *
 * Asserts: limit forward + clamp, contest rows render with title +
 * entry count + days-left countdown, empty + loading states.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/vue';
import { ref, defineComponent, h } from 'vue';
import SectionContests from '../SectionContests.vue';

const meta = {
  route: '/',
  zone: 'sidebar',
  isPreview: false,
  effectiveColSpan: 4,
  sectionId: 'contests-1',
};

interface ContestsConfigForTest extends Record<string, unknown> {
  heading: string;
  limit: number;
}

const baseConfig: ContestsConfigForTest = { heading: 'Active Contests', limit: 3 };

type FetchCall = { url: string; query: Record<string, unknown> };
let calls: FetchCall[] = [];

const NuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, required: true } },
  setup(props, { slots }) {
    return () => h('a', { href: props.to }, slots.default?.());
  },
});

function mountContests(
  fetchResult: { items?: Array<{ id: string; slug: string; title: string; entryCount?: number; endDate?: string }>; pending?: boolean } = {},
  config: ContestsConfigForTest = baseConfig,
): void {
  (globalThis as Record<string, unknown>).useFetch = vi.fn().mockImplementation(
    (url: string, opts: { query: { value: Record<string, unknown> } | Record<string, unknown> }) => {
      const rawQuery = opts?.query;
      const query =
        rawQuery && typeof rawQuery === 'object' && 'value' in rawQuery
          ? (rawQuery as { value: Record<string, unknown> }).value
          : (rawQuery as Record<string, unknown>) ?? {};
      calls.push({ url, query });
      return {
        data: ref({ items: fetchResult.items ?? [] }),
        pending: ref(fetchResult.pending ?? false),
      };
    },
  );

  render(SectionContests, {
    props: { meta, config },
    global: { components: { NuxtLink: NuxtLinkStub } },
  });
}

beforeEach(() => { calls = []; });
afterEach(() => {
  delete (globalThis as Record<string, unknown>).useFetch;
  document.body.innerHTML = '';
});

describe('SectionContests — query building', () => {
  it('forwards limit to /api/contests', () => {
    mountContests({}, { ...baseConfig, limit: 5 });
    expect(calls[0].url).toBe('/api/contests');
    expect((calls[0].query as { limit: number }).limit).toBe(5);
  });

  it('clamps limit into [1, 10]', () => {
    mountContests({}, { ...baseConfig, limit: 999 });
    expect((calls[0].query as { limit: number }).limit).toBe(10);

    calls = [];
    mountContests({}, { ...baseConfig, limit: 0 });
    expect((calls[0].query as { limit: number }).limit).toBe(1);
  });
});

describe('SectionContests — render', () => {
  it('renders title + entry count for each contest', () => {
    mountContests({
      items: [
        { id: '1', slug: 'a', title: 'Build-off', entryCount: 12 },
        { id: '2', slug: 'b', title: 'Quickdraw', entryCount: 0 },
      ],
    });
    expect(document.body.textContent).toContain('Build-off');
    expect(document.body.textContent).toContain('12 entries');
    expect(document.body.textContent).toContain('Quickdraw');
    expect(document.body.textContent).toContain('0 entries');
  });

  it('renders "Nd left" countdown when endDate is set', () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
    mountContests({
      items: [{ id: '1', slug: 'a', title: 'X', entryCount: 0, endDate: future }],
    });
    expect(document.body.textContent).toMatch(/\d+d left/);
  });

  it('clamps past deadlines to 0d left', () => {
    const past = new Date(Date.now() - 10 * 86_400_000).toISOString();
    mountContests({
      items: [{ id: '1', slug: 'a', title: 'X', entryCount: 0, endDate: past }],
    });
    expect(document.body.textContent).toContain('0d left');
  });

  it('omits deadline UI when endDate missing', () => {
    mountContests({
      items: [{ id: '1', slug: 'a', title: 'X', entryCount: 0 }],
    });
    expect(document.querySelector('.cpub-section-contests-deadline')).toBeNull();
  });

  it('shows empty state for no contests', () => {
    mountContests({ items: [] });
    expect(document.querySelector('.cpub-section-contests-empty')).not.toBeNull();
  });

  it('renders Enter Contest CTA per row', () => {
    mountContests({
      items: [{ id: '1', slug: 'a', title: 'X', entryCount: 0 }],
    });
    const cta = document.querySelector('.cpub-section-contests-cta') as HTMLAnchorElement;
    expect(cta?.getAttribute('href')).toBe('/contests/a');
    expect(cta?.textContent?.trim()).toBe('Enter Contest');
  });
});
