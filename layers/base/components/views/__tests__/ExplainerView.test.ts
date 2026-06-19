/**
 * Smoke render tests for ExplainerView.
 *
 * Regression net for the author-avatar dedup (audit-203). Asserts the title,
 * author display name, and avatar (img when avatarUrl present, single-char
 * initials fallback when absent) render in the sidebar byline.
 *
 * NOTE: ExplainerView's avatar uses a DISTINCT design ('.cpub-sidebar-author-*',
 * 24px round, single-letter initials), NOT the shared '.cpub-av' block used by
 * Project/Article views — see the dedup report for why it is not converted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';

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
  useAuth: () => ({ user: ref(null), isAuthenticated: ref(false) }),
  useJsonLd: vi.fn(),
  useRuntimeConfig: () => ({ public: { siteUrl: 'https://example.test' } }),
  navigateTo: vi.fn(),
  $fetch: vi.fn(),
});

import ExplainerView from '../ExplainerView.vue';
import type { ContentViewData } from '../../../composables/useEngagement';

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
  ScrollViewer: true,
};

// Minimal smoke fixture; cast to the full type (the view only reads the byline
// fields these tests assert on).
function makeContent(overrides: Record<string, unknown> = {}): ContentViewData {
  return {
    id: 'exp-1',
    type: 'explainer',
    slug: 'how-pwm-works',
    title: 'How PWM Works',
    description: 'An interactive explainer',
    // Block-based (non-document) format so the block viewer branch renders.
    content: [['heading', { text: 'Intro', level: 2 }]],
    tags: [],
    publishedAt: '2026-06-01T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    likeCount: 0,
    commentCount: 0,
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

describe('ExplainerView — smoke', () => {
  it('renders the title and author display name', () => {
    const { container } = render(ExplainerView, { props: { content: makeContent() }, global: { stubs } });
    expect(container.querySelector('.cpub-topbar-title')?.textContent).toBe('How PWM Works');
    expect(container.querySelector('.cpub-sidebar-author-name')?.textContent?.trim()).toBe('Alice Builder');
  });

  it('renders an avatar <img> with the src when avatarUrl is present', () => {
    const { container } = render(ExplainerView, {
      props: { content: makeContent() },
      global: { stubs },
    });
    const img = container.querySelector('.cpub-sidebar-author-avatar img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://example.test/avatars/alice.png');
  });

  it('renders initials fallback when avatarUrl is absent', () => {
    const { container } = render(ExplainerView, {
      props: {
        content: makeContent({
          author: { id: 'u-2', username: 'bob', displayName: 'Bob Maker', avatarUrl: null },
        }),
      },
      global: { stubs },
    });
    expect(container.querySelector('.cpub-sidebar-author-avatar img')).toBeFalsy();
    const initials = container.querySelector('.cpub-sidebar-author-initials');
    expect(initials).toBeTruthy();
    expect(initials?.textContent?.trim()).toBe('B');
  });
});
