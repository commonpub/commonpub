/**
 * Component tests for FederatedContentCard.
 *
 * Tests rendering of federated content from CommonPub and non-CommonPub sources,
 * computed properties (typeLabel, actorHandle, timeAgo), event emission, and
 * conditional rendering (avatar, cover image, tags, title link).
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import FederatedContentCard from '../FederatedContentCard.vue';

// Stub NuxtLink as a plain <a> tag
const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: String },
  setup(props, { slots }) {
    return () => h('a', { href: props.to }, slots.default?.());
  },
});

const stubs = { NuxtLink };

function makeContent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fed-1',
    objectUri: 'https://remote.example.com/content/test',
    apType: 'Article',
    title: 'LED Cube Build',
    content: '<p>Build a 4x4x4 LED cube</p>',
    summary: '<p>A <strong>complete</strong> LED cube tutorial</p>',
    url: 'https://remote.example.com/project/led-cube',
    coverImageUrl: null,
    tags: [],
    attachments: [],
    inReplyTo: null,
    cpubType: 'project',
    cpubMetadata: null,
    cpubBlocks: null,
    localLikeCount: 5,
    localCommentCount: 2,
    localViewCount: 100,
    publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    receivedAt: new Date().toISOString(),
    originDomain: 'remote.example.com',
    actor: {
      actorUri: 'https://remote.example.com/users/alice',
      preferredUsername: 'alice',
      displayName: 'Alice Builder',
      avatarUrl: 'https://remote.example.com/avatars/alice.png',
      instanceDomain: 'remote.example.com',
    },
    ...overrides,
  };
}

describe('FederatedContentCard', () => {
  // --- Basic rendering ---

  it('renders title', () => {
    render(FederatedContentCard, {
      props: { content: makeContent() },
      global: { stubs },
    });
    expect(screen.getByText('LED Cube Build')).toBeInTheDocument();
  });

  it('renders actor name and handle', () => {
    render(FederatedContentCard, {
      props: { content: makeContent() },
      global: { stubs },
    });
    expect(screen.getByText('Alice Builder')).toBeInTheDocument();
    expect(screen.getByText('@alice@remote.example.com')).toBeInTheDocument();
  });

  it('renders origin domain badge', () => {
    render(FederatedContentCard, {
      props: { content: makeContent() },
      global: { stubs },
    });
    expect(screen.getByText('remote.example.com')).toBeInTheDocument();
  });

  it('strips HTML from summary', () => {
    render(FederatedContentCard, {
      props: { content: makeContent() },
      global: { stubs },
    });
    const summary = screen.getByText('A complete LED cube tutorial');
    expect(summary).toBeInTheDocument();
    // Should NOT contain HTML tags
    expect(summary.innerHTML).not.toContain('<strong>');
    expect(summary.innerHTML).not.toContain('<p>');
  });

  // --- Type label computed ---

  it('shows cpubType as type badge when present', () => {
    render(FederatedContentCard, {
      props: { content: makeContent({ cpubType: 'project' }) },
      global: { stubs },
    });
    expect(screen.getByText('project')).toBeInTheDocument();
  });

  it('shows "article" for AP Article without cpubType', () => {
    render(FederatedContentCard, {
      props: { content: makeContent({ cpubType: null, apType: 'Article' }) },
      global: { stubs },
    });
    expect(screen.getByText('article')).toBeInTheDocument();
  });

  it('shows "post" for AP Note without cpubType', () => {
    render(FederatedContentCard, {
      props: { content: makeContent({ cpubType: null, apType: 'Note' }) },
      global: { stubs },
    });
    expect(screen.getByText('post')).toBeInTheDocument();
  });

  // --- Avatar rendering ---

  it('renders avatar image when actor has avatarUrl', () => {
    render(FederatedContentCard, {
      props: { content: makeContent() },
      global: { stubs },
    });
    const img = screen.getByAltText('Alice Builder avatar');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://remote.example.com/avatars/alice.png');
  });

  it('renders placeholder when actor has no avatarUrl', () => {
    const { container } = render(FederatedContentCard, {
      props: {
        content: makeContent({
          actor: {
            actorUri: 'https://remote.example.com/users/bob',
            preferredUsername: 'bob',
            displayName: 'Bob',
            avatarUrl: null,
            instanceDomain: 'remote.example.com',
          },
        }),
      },
      global: { stubs },
    });
    const placeholder = container.querySelector('.cpub-fed-card__avatar--placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder?.textContent).toBe('B');
  });

  // --- Cover image ---

  it('renders cover image through proxy when coverImageUrl present', () => {
    const { container } = render(FederatedContentCard, {
      props: {
        content: makeContent({
          coverImageUrl: 'https://remote.example.com/img/cover.jpg',
        }),
      },
      global: { stubs },
    });
    const cover = container.querySelector('.cpub-fed-card__cover img');
    expect(cover).toBeInTheDocument();
    expect(cover?.getAttribute('src')).toContain('/api/image-proxy');
    expect(cover?.getAttribute('src')).toContain(encodeURIComponent('https://remote.example.com/img/cover.jpg'));
  });

  it('does not render cover image when coverImageUrl is null', () => {
    const { container } = render(FederatedContentCard, {
      props: { content: makeContent({ coverImageUrl: null }) },
      global: { stubs },
    });
    expect(container.querySelector('.cpub-fed-card__cover')).not.toBeInTheDocument();
  });

  // --- Tags ---

  it('renders tags when present', () => {
    render(FederatedContentCard, {
      props: {
        content: makeContent({
          tags: [
            { type: 'Hashtag', name: '#electronics' },
            { type: 'Hashtag', name: '#led' },
          ],
        }),
      },
      global: { stubs },
    });
    expect(screen.getByText('#electronics')).toBeInTheDocument();
    expect(screen.getByText('#led')).toBeInTheDocument();
  });

  it('limits tags to 5', () => {
    const tags = Array.from({ length: 8 }, (_, i) => ({
      type: 'Hashtag',
      name: `#tag${i}`,
    }));
    const { container } = render(FederatedContentCard, {
      props: { content: makeContent({ tags }) },
      global: { stubs },
    });
    const tagElements = container.querySelectorAll('.cpub-fed-card__tag');
    expect(tagElements.length).toBe(5);
  });

  it('hides tags section when empty', () => {
    const { container } = render(FederatedContentCard, {
      props: { content: makeContent({ tags: [] }) },
      global: { stubs },
    });
    expect(container.querySelector('.cpub-fed-card__tags')).not.toBeInTheDocument();
  });

  // --- Like count ---

  it('shows like count when > 0', () => {
    render(FederatedContentCard, {
      props: { content: makeContent({ localLikeCount: 5 }) },
      global: { stubs },
    });
    expect(screen.getByLabelText('Like this project')).toHaveTextContent('5 Like');
  });

  it('hides like count when 0', () => {
    render(FederatedContentCard, {
      props: { content: makeContent({ localLikeCount: 0 }) },
      global: { stubs },
    });
    expect(screen.getByLabelText('Like this project')).toHaveTextContent('Like');
    expect(screen.getByLabelText('Like this project').textContent?.trim()).toBe('Like');
  });

  // --- Events ---

  it('emits like event with content id', async () => {
    const { emitted } = render(FederatedContentCard, {
      props: { content: makeContent() },
      global: { stubs },
    });
    await fireEvent.click(screen.getByLabelText('Like this project'));
    expect(emitted().like).toBeTruthy();
    expect(emitted().like[0]).toEqual(['fed-1']);
  });

  it('emits boost event with content id', async () => {
    const { emitted } = render(FederatedContentCard, {
      props: { content: makeContent() },
      global: { stubs },
    });
    await fireEvent.click(screen.getByLabelText('Boost this project'));
    expect(emitted().boost).toBeTruthy();
    expect(emitted().boost[0]).toEqual(['fed-1']);
  });

  // --- Title link ---

  it('renders title as link when url is present', () => {
    render(FederatedContentCard, {
      props: { content: makeContent() },
      global: { stubs },
    });
    const link = screen.getByText('LED Cube Build').closest('a');
    expect(link).toHaveAttribute('href', 'https://remote.example.com/project/led-cube');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders title as plain text when url is null', () => {
    render(FederatedContentCard, {
      props: { content: makeContent({ url: null }) },
      global: { stubs },
    });
    const title = screen.getByText('LED Cube Build');
    expect(title.tagName).toBe('SPAN');
  });

  // --- View Original link ---

  it('shows View Original link when url present', () => {
    render(FederatedContentCard, {
      props: { content: makeContent() },
      global: { stubs },
    });
    const link = screen.getByText('View Original');
    expect(link).toHaveAttribute('href', 'https://remote.example.com/project/led-cube');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('hides View Original when no url', () => {
    render(FederatedContentCard, {
      props: { content: makeContent({ url: null }) },
      global: { stubs },
    });
    expect(screen.queryByText('View Original')).not.toBeInTheDocument();
  });

  // --- Time ago ---

  it('shows relative time for recent content', () => {
    const { container } = render(FederatedContentCard, {
      props: {
        content: makeContent({
          publishedAt: new Date(Date.now() - 30 * 60000).toISOString(),
        }),
      },
      global: { stubs },
    });
    const time = container.querySelector('.cpub-fed-card__time');
    expect(time?.textContent).toBe('30m');
  });

  it('shows hours for content from today', () => {
    const { container } = render(FederatedContentCard, {
      props: {
        content: makeContent({
          publishedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
        }),
      },
      global: { stubs },
    });
    const time = container.querySelector('.cpub-fed-card__time');
    expect(time?.textContent).toBe('5h');
  });

  // --- Fallback values ---

  it('shows Unknown when actor is null', () => {
    render(FederatedContentCard, {
      props: { content: makeContent({ actor: null }) },
      global: { stubs },
    });
    // Both actorName and actorHandle render "Unknown" fallback
    const unknowns = screen.getAllByText('Unknown');
    expect(unknowns.length).toBeGreaterThanOrEqual(1);
  });
});
