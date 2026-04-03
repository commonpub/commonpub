/**
 * Unit tests for useMirrorContent composable.
 *
 * Tests the contentType resolution logic which determines how federated
 * content is displayed — critical for distinguishing CommonPub vs non-CommonPub
 * content types.
 */
import { describe, it, expect } from 'vitest';
import { ref, nextTick } from 'vue';
import { useMirrorContent } from '../useMirrorContent';

function makeFedContent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fed-1',
    objectUri: 'https://remote.example.com/content/test',
    apType: 'Article',
    cpubType: null,
    title: 'Test Content',
    content: '<p>Hello world</p>',
    summary: 'A test',
    url: 'https://remote.example.com/article/test',
    coverImageUrl: null,
    tags: [],
    attachments: [],
    cpubMetadata: null,
    cpubBlocks: null,
    localLikeCount: 0,
    localCommentCount: 0,
    localViewCount: 0,
    publishedAt: '2026-03-20T10:00:00Z',
    receivedAt: '2026-03-20T11:00:00Z',
    originDomain: 'remote.example.com',
    actor: {
      actorUri: 'https://remote.example.com/users/alice',
      preferredUsername: 'alice',
      displayName: 'Alice',
      avatarUrl: null,
      instanceDomain: 'remote.example.com',
    },
    ...overrides,
  };
}

describe('useMirrorContent', () => {
  // --- contentType resolution ---

  describe('contentType', () => {
    it('returns cpubType when present (CommonPub project)', () => {
      const fedContent = ref(makeFedContent({ cpubType: 'project' }));
      const { contentType } = useMirrorContent(fedContent);
      expect(contentType.value).toBe('project');
    });

    it('returns cpubType when present (CommonPub article)', () => {
      const fedContent = ref(makeFedContent({ cpubType: 'article' }));
      const { contentType } = useMirrorContent(fedContent);
      expect(contentType.value).toBe('article');
    });

    it('returns cpubType when present (CommonPub blog)', () => {
      const fedContent = ref(makeFedContent({ cpubType: 'blog' }));
      const { contentType } = useMirrorContent(fedContent);
      expect(contentType.value).toBe('blog');
    });

    it('returns cpubType when present (CommonPub explainer)', () => {
      const fedContent = ref(makeFedContent({ cpubType: 'explainer' }));
      const { contentType } = useMirrorContent(fedContent);
      expect(contentType.value).toBe('explainer');
    });

    it('falls back to apType lowercase for non-CommonPub Article', () => {
      const fedContent = ref(makeFedContent({ cpubType: null, apType: 'Article' }));
      const { contentType } = useMirrorContent(fedContent);
      expect(contentType.value).toBe('article');
    });

    it('falls back to apType lowercase for Note', () => {
      const fedContent = ref(makeFedContent({ cpubType: null, apType: 'Note' }));
      const { contentType } = useMirrorContent(fedContent);
      expect(contentType.value).toBe('note');
    });

    it('falls back to "article" when both cpubType and apType are null', () => {
      const fedContent = ref(makeFedContent({ cpubType: null, apType: null }));
      const { contentType } = useMirrorContent(fedContent);
      expect(contentType.value).toBe('article');
    });

    it('prefers cpubType over apType', () => {
      const fedContent = ref(makeFedContent({ cpubType: 'project', apType: 'Article' }));
      const { contentType } = useMirrorContent(fedContent);
      expect(contentType.value).toBe('project');
    });
  });

  // --- transformedContent ---

  describe('transformedContent', () => {
    it('returns null when fedContent is null', () => {
      const fedContent = ref(null);
      const { transformedContent } = useMirrorContent(fedContent);
      expect(transformedContent.value).toBeNull();
    });

    it('maps title correctly', () => {
      const fedContent = ref(makeFedContent({ title: 'LED Cube Build' }));
      const { transformedContent } = useMirrorContent(fedContent);
      expect(transformedContent.value?.title).toBe('LED Cube Build');
    });

    it('uses "Untitled" when title is null', () => {
      const fedContent = ref(makeFedContent({ title: null }));
      const { transformedContent } = useMirrorContent(fedContent);
      expect(transformedContent.value?.title).toBe('Untitled');
    });

    it('preserves cpubBlocks when present (CommonPub-to-CommonPub)', () => {
      const blocks = [['paragraph', { text: 'Hello' }], ['heading', { level: 2, text: 'World' }]];
      const fedContent = ref(makeFedContent({ cpubBlocks: blocks }));
      const { transformedContent } = useMirrorContent(fedContent);
      expect(transformedContent.value?.content).toEqual(blocks);
    });

    it('wraps HTML content as paragraph block (non-CommonPub)', () => {
      const fedContent = ref(makeFedContent({
        cpubBlocks: null,
        content: '<p>Hello from Mastodon</p>',
      }));
      const { transformedContent } = useMirrorContent(fedContent);
      expect(transformedContent.value?.content).toEqual([
        ['paragraph', { html: '<p>Hello from Mastodon</p>' }],
      ]);
    });

    it('extracts metadata from cpubMetadata', () => {
      const fedContent = ref(makeFedContent({
        cpubType: 'project',
        cpubMetadata: { difficulty: 'intermediate', buildTime: '4h', estimatedCost: '$50' },
      }));
      const { transformedContent } = useMirrorContent(fedContent);
      expect(transformedContent.value?.difficulty).toBe('intermediate');
      expect(transformedContent.value?.buildTime).toBe('4h');
      expect(transformedContent.value?.estimatedCost).toBe('$50');
    });

    it('maps tags to expected format', () => {
      const fedContent = ref(makeFedContent({
        tags: [
          { type: 'Hashtag', name: '#electronics' },
          { type: 'Hashtag', name: '#led' },
        ],
      }));
      const { transformedContent } = useMirrorContent(fedContent);
      expect(transformedContent.value?.tags).toHaveLength(2);
      expect(transformedContent.value?.tags[0]?.name).toBe('#electronics');
    });

    it('maps actor to author format', () => {
      const fedContent = ref(makeFedContent({
        actor: {
          actorUri: 'https://remote.example.com/users/bob',
          preferredUsername: 'bob',
          displayName: 'Bob Builder',
          avatarUrl: 'https://remote.example.com/avatar.png',
          instanceDomain: 'remote.example.com',
          followerCount: 42,
        },
      }));
      const { transformedContent } = useMirrorContent(fedContent);
      expect(transformedContent.value?.author.username).toBe('bob');
      expect(transformedContent.value?.author.displayName).toBe('Bob Builder');
      expect(transformedContent.value?.author.avatarUrl).toBe('https://remote.example.com/avatar.png');
    });
  });

  // --- originDomain ---

  describe('originDomain', () => {
    it('extracts origin domain', () => {
      const fedContent = ref(makeFedContent({ originDomain: 'mastodon.social' }));
      const { originDomain } = useMirrorContent(fedContent);
      expect(originDomain.value).toBe('mastodon.social');
    });

    it('falls back to "unknown" when null', () => {
      const fedContent = ref(makeFedContent({ originDomain: null }));
      const { originDomain } = useMirrorContent(fedContent);
      expect(originDomain.value).toBe('unknown');
    });
  });

  // --- authorHandle ---

  describe('authorHandle', () => {
    it('formats as @user@domain', () => {
      const fedContent = ref(makeFedContent());
      const { authorHandle } = useMirrorContent(fedContent);
      expect(authorHandle.value).toBe('@alice@remote.example.com');
    });

    it('returns empty string when no actor', () => {
      const fedContent = ref(makeFedContent({ actor: null }));
      const { authorHandle } = useMirrorContent(fedContent);
      expect(authorHandle.value).toBe('');
    });
  });
});
