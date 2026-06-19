/**
 * Smoke render tests for ProjectView.
 *
 * Regression net for the author-avatar dedup (audit-203). Asserts the title,
 * author display name, and avatar (img when avatarUrl present, initials
 * fallback when absent) all render. NOT an exhaustive test of the (large,
 * tab-heavy) view — just the load-bearing byline surface the refactor touches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';

// --- Stub Nuxt auto-imports on globalThis (Nuxt provides these at build time) ---
const engagement = {
  liked: ref(false),
  bookmarked: ref(false),
  likeCount: ref(0),
  isFederated: ref(false),
  toggleLike: vi.fn(),
  toggleBookmark: vi.fn(),
  share: vi.fn(),
  fetchInitialState: vi.fn(),
};

Object.assign(globalThis, {
  useEngagement: () => engagement,
  useFeatures: () => ({ hubs: ref(false) }),
  useAuth: () => ({ user: ref(null), isAuthenticated: ref(false) }),
  useFetch: () => ({ data: ref([]) }),
  useJsonLd: vi.fn(),
  useRuntimeConfig: () => ({ public: { siteUrl: 'https://example.test' } }),
  navigateTo: vi.fn(),
  $fetch: vi.fn(),
});

import ProjectView from '../ProjectView.vue';
// Real component (renders the .cpub-av markup the assertions check); the app
// auto-imports it, but vitest needs it registered explicitly.
import ContentAvatar from '../../ContentAvatar.vue';
import type { ContentViewData } from '../../../composables/useEngagement';

// --- Component stubs ---
const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: [String, Object], external: Boolean, target: String },
  setup(props, { slots }) {
    return () => h('a', { href: typeof props.to === 'string' ? props.to : '#' }, slots.default?.());
  },
});

const stubs = {
  NuxtLink,
  BlocksBlockContentRenderer: true,
  ContentAttachments: true,
  CommentSection: true,
};

const components = { ContentAvatar };

// Minimal smoke fixture; cast to the full type (the view only reads the byline
// fields these tests assert on).
function makeContent(overrides: Record<string, unknown> = {}): ContentViewData {
  return {
    id: 'proj-1',
    type: 'project',
    slug: 'led-cube',
    title: 'LED Cube Build',
    description: 'A 4x4x4 LED cube',
    content: [],
    tags: [],
    parts: null,
    publishedAt: '2026-06-01T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    likeCount: 0,
    commentCount: 0,
    forkCount: 0,
    author: {
      id: 'u-1',
      username: 'alice',
      displayName: 'Alice Builder',
      avatarUrl: 'https://example.test/avatars/alice.png',
    },
    ...overrides,
  } as unknown as ContentViewData;
}

beforeEach(() => {
  engagement.isFederated.value = false;
});

describe('ProjectView — smoke', () => {
  it('renders the title and author display name', () => {
    const { container } = render(ProjectView, { props: { content: makeContent() }, global: { stubs, components } });
    // Title appears in the breadcrumb + the <h1>; assert the page heading.
    expect(container.querySelector('h1.cpub-project-title')?.textContent).toBe('LED Cube Build');
    expect(screen.getByText('Alice Builder')).toBeInTheDocument();
  });

  it('renders an avatar <img> with the src when avatarUrl is present', () => {
    const { container } = render(ProjectView, {
      props: { content: makeContent() },
      global: { stubs, components },
    });
    const img = container.querySelector('img.cpub-av, img[src="https://example.test/avatars/alice.png"]');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://example.test/avatars/alice.png');
  });

  it('renders initials fallback when avatarUrl is absent', () => {
    const { container } = render(ProjectView, {
      props: {
        content: makeContent({
          author: { id: 'u-2', username: 'bob', displayName: 'Bob Maker', avatarUrl: null },
        }),
      },
      global: { stubs, components },
    });
    // No avatar image
    expect(container.querySelector('img.cpub-av')).toBeFalsy();
    // Initials element renders the first two letters uppercased
    const initials = container.querySelector('div.cpub-av');
    expect(initials).toBeTruthy();
    expect(initials?.textContent?.trim()).toBe('BO');
  });
});
