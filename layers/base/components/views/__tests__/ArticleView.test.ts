/**
 * Smoke render tests for ArticleView.
 *
 * Regression net for the author-avatar dedup (audit-203). Asserts the title,
 * author display name, and avatar (img when avatarUrl present, initials
 * fallback when absent) render. ArticleView renders the byline avatar AND an
 * author-card avatar; these tests target the byline ('cpub-av-lg').
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/vue';
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
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
  useContentUrl: () => ({ contentPath: (u: string, t: string, s: string) => `/u/${u}/${t}/${s}` }),
  useJsonLd: vi.fn(),
  useRuntimeConfig: () => ({ public: { siteUrl: 'https://example.test' } }),
  navigateTo: vi.fn(),
  $fetch: vi.fn(),
});

import ArticleView from '../ArticleView.vue';
// Real component (renders the .cpub-av markup the assertions check); the app
// auto-imports it, but vitest needs it registered explicitly.
import ContentAvatar from '../../ContentAvatar.vue';
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
  ContentAttachments: true,
  CommentSection: true,
};

const components = { ContentAvatar };

// Minimal smoke fixture; cast to the full type (the view only reads the byline
// fields these tests assert on).
function makeContent(overrides: Record<string, unknown> = {}): ContentViewData {
  return {
    id: 'art-1',
    type: 'blog',
    slug: 'getting-started',
    title: 'Getting Started With Makers',
    description: 'An intro post',
    content: [],
    tags: [],
    category: 'Blog Post',
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

describe('ArticleView — smoke', () => {
  it('renders the title and author display name', () => {
    const { container } = render(ArticleView, { props: { content: makeContent() }, global: { stubs, components } });
    expect(container.querySelector('h1.cpub-article-title')?.textContent).toBe('Getting Started With Makers');
    // displayName appears in byline + author card; at least one render.
    expect(screen.getAllByText('Alice Builder').length).toBeGreaterThanOrEqual(1);
  });

  it('renders an avatar <img> with the src when avatarUrl is present', () => {
    const { container } = render(ArticleView, {
      props: { content: makeContent() },
      global: { stubs, components },
    });
    const byline = container.querySelector('.cpub-author-row img.cpub-av');
    expect(byline).toBeTruthy();
    expect(byline?.getAttribute('src')).toBe('https://example.test/avatars/alice.png');
  });

  it('renders initials fallback when avatarUrl is absent', () => {
    const { container } = render(ArticleView, {
      props: {
        content: makeContent({
          author: { id: 'u-2', username: 'bob', displayName: 'Bob Maker', avatarUrl: null },
        }),
      },
      global: { stubs, components },
    });
    expect(container.querySelector('.cpub-author-row img.cpub-av')).toBeFalsy();
    const initials = container.querySelector('.cpub-author-row div.cpub-av');
    expect(initials).toBeTruthy();
    expect(initials?.textContent?.trim()).toBe('BO');
  });
});
