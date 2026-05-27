/**
 * Component-level tests for SectionHubs.
 *
 * Stubs useFetch + useAuth + useToast + navigateTo + $fetch. Asserts:
 * limit clamping in the query, hub list renders, Join button toggles
 * to Joined on success, anonymous click redirects to login.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { ref, defineComponent, h } from 'vue';
import SectionHubs from '../SectionHubs.vue';

const meta = {
  route: '/',
  zone: 'sidebar',
  isPreview: false,
  effectiveColSpan: 4,
  sectionId: 'hubs-1',
};

interface HubsConfigForTest extends Record<string, unknown> {
  heading: string;
  limit: number;
}

const baseConfig: HubsConfigForTest = { heading: 'Trending Hubs', limit: 4 };

type FetchCall = { url: string; query: Record<string, unknown> };
let calls: FetchCall[] = [];
let joinCalls: string[] = [];
let navigateCalls: string[] = [];

const NuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, required: true } },
  setup(_props, { slots }) {
    return () => h('a', { 'data-testid': 'nuxt-link', href: _props.to }, slots.default?.());
  },
});

function mountHubs(
  fetchResult: { items?: Array<{ id: string; slug: string; name: string; memberCount?: number; source?: 'local' | 'federated'; iconUrl?: string | null }>; pending?: boolean } = {},
  opts: { authenticated?: boolean; joinFails?: boolean; config?: HubsConfigForTest } = {},
): void {
  (globalThis as Record<string, unknown>).useFetch = vi.fn().mockImplementation(
    (url: string, fetchOpts: { query: { value: Record<string, unknown> } | Record<string, unknown> }) => {
      const rawQuery = fetchOpts?.query;
      const query =
        rawQuery && typeof rawQuery === 'object' && 'value' in rawQuery
          ? (rawQuery as { value: Record<string, unknown> }).value
          : (rawQuery as Record<string, unknown>) ?? {};
      calls.push({ url, query });
      return {
        data: ref({ items: fetchResult.items ?? [], total: (fetchResult.items ?? []).length }),
        pending: ref(fetchResult.pending ?? false),
      };
    },
  );

  (globalThis as Record<string, unknown>).useAuth = vi.fn(() => ({
    user: ref(opts.authenticated ? { id: 'u1', username: 'alice' } : null),
  }));

  (globalThis as Record<string, unknown>).useToast = vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
  }));

  (globalThis as Record<string, unknown>).navigateTo = vi.fn((to: string) => {
    navigateCalls.push(to);
    return Promise.resolve();
  });

  (globalThis as Record<string, unknown>).$fetch = vi.fn((url: string) => {
    joinCalls.push(url);
    return opts.joinFails ? Promise.reject(new Error('boom')) : Promise.resolve({});
  });

  render(SectionHubs, {
    props: { meta, config: opts.config ?? baseConfig },
    global: { components: { NuxtLink: NuxtLinkStub } },
  });
}

beforeEach(() => {
  calls = [];
  joinCalls = [];
  navigateCalls = [];
});

afterEach(() => {
  for (const key of ['useFetch', 'useAuth', 'useToast', 'navigateTo', '$fetch']) {
    delete (globalThis as Record<string, unknown>)[key];
  }
  document.body.innerHTML = '';
});

describe('SectionHubs — query building', () => {
  it('forwards limit to /api/hubs', () => {
    mountHubs({}, { config: { ...baseConfig, limit: 7 } });
    expect(calls[0].url).toBe('/api/hubs');
    expect((calls[0].query as { limit: number }).limit).toBe(7);
  });

  it('clamps limit into [1, 20]', () => {
    mountHubs({}, { config: { ...baseConfig, limit: 999 } });
    expect((calls[0].query as { limit: number }).limit).toBe(20);

    calls = [];
    mountHubs({}, { config: { ...baseConfig, limit: 0 } });
    expect((calls[0].query as { limit: number }).limit).toBe(1);
  });
});

describe('SectionHubs — render', () => {
  it('renders one item per hub with name + member count', () => {
    mountHubs({
      items: [
        { id: '1', slug: 'a', name: 'Alpha', memberCount: 12 },
        { id: '2', slug: 'b', name: 'Beta', memberCount: 7 },
      ],
    });
    const items = document.querySelectorAll('.cpub-section-hubs-item');
    expect(items.length).toBe(2);
    expect(document.body.textContent).toContain('Alpha');
    expect(document.body.textContent).toContain('12 members');
  });

  it('shows empty state for no hubs', () => {
    mountHubs({ items: [] });
    expect(document.querySelector('.cpub-section-hubs-empty')).not.toBeNull();
  });

  it('shows loading state while pending', () => {
    mountHubs({ items: [], pending: true });
    expect(document.querySelector('.cpub-section-hubs-loading')).not.toBeNull();
  });
});

describe('SectionHubs — join behavior', () => {
  it('anonymous click → navigateTo /auth/login', async () => {
    mountHubs(
      { items: [{ id: '1', slug: 'a', name: 'Alpha', memberCount: 1 }] },
      { authenticated: false },
    );
    const btn = document.querySelector('.cpub-section-hubs-join') as HTMLButtonElement;
    await fireEvent.click(btn);
    expect(navigateCalls[0]).toBe('/auth/login?redirect=/');
    expect(joinCalls.length).toBe(0);
  });

  it('authenticated click → POST /api/hubs/:slug/join + flip to Joined', async () => {
    mountHubs(
      { items: [{ id: '1', slug: 'a', name: 'Alpha', memberCount: 1 }] },
      { authenticated: true },
    );
    const btn = document.querySelector('.cpub-section-hubs-join') as HTMLButtonElement;
    await fireEvent.click(btn);
    expect(joinCalls[0]).toBe('/api/hubs/a/join');
    // After successful join the join button is gone, Joined button is shown
    expect(document.querySelector('.cpub-section-hubs-joined')).not.toBeNull();
  });

  it('federated hubs link to /federated-hubs/:id', () => {
    mountHubs({
      items: [{ id: 'fed-99', slug: 'fed', name: 'Federated', memberCount: 0, source: 'federated' }],
    });
    const link = document.querySelector('.cpub-section-hubs-name') as HTMLAnchorElement;
    expect(link?.getAttribute('href')).toBe('/federated-hubs/fed-99');
  });
});
