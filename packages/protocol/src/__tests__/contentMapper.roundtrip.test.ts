/**
 * Round-trip fidelity tests for content mapper.
 * Verifies: content → AP object → content preserves all fields.
 */
import { describe, it, expect } from 'vitest';
import { contentToArticle, contentToNote, articleToContent, noteToComment } from '../contentMapper';
import { AP_CONTEXT, AP_PUBLIC } from '../activityTypes';

const DOMAIN = 'hack.build';

describe('content → Article → content round-trip', () => {
  it('preserves all fields for a full article', () => {
    const original = {
      id: 'uuid-rt-1',
      type: 'article' as const,
      title: 'Building a Robot Arm with 6 Degrees of Freedom',
      slug: 'building-robot-arm-6dof',
      description: 'A comprehensive guide to building a desktop robot arm using servos and an Arduino',
      content: '<h1>Introduction</h1><p>This guide covers everything you need to build a 6-DOF robot arm.</p><h2>Parts List</h2><ul><li>Arduino Nano</li><li>6x MG996R Servos</li></ul>',
      coverImageUrl: 'https://hack.build/files/robot-arm-cover.webp',
      publishedAt: new Date('2026-03-15T10:30:00Z'),
      updatedAt: new Date('2026-03-18T14:00:00Z'),
    };
    const author = { username: 'alice', displayName: 'Alice Chen' };

    // Forward: content → Article
    const article = contentToArticle(original, author, DOMAIN);

    // Verify AP object structure
    expect(article.type).toBe('Article');
    expect(article['@context']).toBe(AP_CONTEXT);
    expect(article.to).toEqual([AP_PUBLIC]);
    expect(article.attributedTo).toBe(`https://${DOMAIN}/users/alice`);
    expect(article.name).toBe(original.title);
    expect(article.content).toBe(original.content);
    expect(article.summary).toBe(original.description);
    expect(article.published).toBe('2026-03-15T10:30:00.000Z');
    expect(article.updated).toBe('2026-03-18T14:00:00.000Z');
    expect(article.attachment).toHaveLength(1);
    expect(article.attachment![0]!.url).toBe(original.coverImageUrl);

    // Reverse: Article → content
    const restored = articleToContent(article);

    // Compare
    expect(restored.title).toBe(original.title);
    expect(restored.content).toBe(original.content);
    expect(restored.description).toBe(original.description);
    expect(restored.coverImageUrl).toBe(original.coverImageUrl);
    expect(restored.publishedAt).toEqual(original.publishedAt);
  });

  it('preserves minimal article (no optional fields)', () => {
    const original = {
      id: 'uuid-rt-2',
      type: 'blog' as const,
      title: 'Quick Update',
      slug: 'quick-update',
    };
    const author = { username: 'bob', displayName: null };

    const article = contentToArticle(original, author, DOMAIN);
    const restored = articleToContent(article);

    expect(restored.title).toBe(original.title);
    expect(restored.description).toBeUndefined();
    expect(restored.publishedAt).toBeUndefined();
    expect(restored.coverImageUrl).toBeUndefined();
  });

  it('preserves HTML content with complex formatting', () => {
    const htmlContent = [
      '<h2>Getting Started</h2>',
      '<p>First, install the dependencies:</p>',
      '<pre><code class="language-bash">npm install @commonpub/protocol</code></pre>',
      '<blockquote><p>This is important!</p></blockquote>',
      '<ul><li>Item 1</li><li>Item 2 with <strong>bold</strong></li></ul>',
      '<p>See the <a href="https://docs.example.com">documentation</a>.</p>',
    ].join('');

    const original = {
      id: 'uuid-rt-3',
      type: 'article' as const,
      title: 'Complex Content Test',
      slug: 'complex-content',
      content: htmlContent,
    };

    const article = contentToArticle(original, { username: 'alice' }, DOMAIN);
    const restored = articleToContent(article);

    expect(restored.content).toBe(htmlContent);
  });

  it('renders BlockTuple content to HTML', () => {
    const jsonContent = [
      ['heading', { level: 2, text: 'Title' }],
      ['paragraph', { text: 'Hello' }],
    ];

    const original = {
      id: 'uuid-rt-4',
      type: 'project' as const,
      title: 'JSON Content',
      slug: 'json-content',
      content: jsonContent,
    };

    const article = contentToArticle(original, { username: 'alice' }, DOMAIN);

    // BlockTuple content is rendered to HTML, not JSON-stringified
    expect(typeof article.content).toBe('string');
    expect(article.content).toContain('<h2>Title</h2>');
    expect(article.content).toContain('<p>Hello</p>');
    expect(article.content).not.toContain('["heading"');
  });
});

describe('comment → Note → comment round-trip', () => {
  it('preserves comment with inReplyTo', () => {
    const original = {
      id: 'comment-rt-1',
      content: 'Great tutorial! I built one too.',
      targetId: 'uuid-1',
      targetType: 'article',
      createdAt: new Date('2026-03-16T08:00:00Z'),
    };
    const parentUri = 'https://hack.build/content/robot-arm';
    const author = { username: 'carol', displayName: 'Carol' };

    // Forward: comment → Note
    const note = contentToNote(original, author, DOMAIN, parentUri);

    // Verify Note structure
    expect(note.type).toBe('Note');
    expect(note.inReplyTo).toBe(parentUri);
    expect(note.published).toBe('2026-03-16T08:00:00.000Z');

    // Reverse: Note → comment
    const restored = noteToComment(note);

    expect(restored.content).toBe('Great tutorial! I built one too.');
    expect(restored.inReplyTo).toBe(parentUri);
  });

  it('preserves top-level comment (no parent)', () => {
    const original = {
      id: 'comment-rt-2',
      content: 'First comment on this post!',
      targetId: 'uuid-2',
      targetType: 'article',
    };
    const author = { username: 'dave' };

    const note = contentToNote(original, author, DOMAIN);
    const restored = noteToComment(note);

    expect(restored.content).toBe(original.content);
    expect(restored.inReplyTo).toBeUndefined();
  });

  it('escapes HTML in comment content', () => {
    const original = {
      id: 'comment-rt-3',
      content: 'Use <code> tags like this: x < 10 && y > 5',
      targetId: 'uuid-3',
      targetType: 'article',
    };
    const author = { username: 'eve' };

    const note = contentToNote(original, author, DOMAIN);

    // Note content should be HTML-escaped
    expect(note.content).not.toContain('<code>');
    expect(note.content).toContain('&lt;code&gt;');
  });
});

describe('URL generation', () => {
  it('generates correct URLs for each content type', () => {
    const types = ['project', 'article', 'blog', 'explainer'] as const;

    for (const type of types) {
      const article = contentToArticle(
        { id: 'url-test', type, title: 'URL Test', slug: 'url-test' },
        { username: 'alice' },
        DOMAIN,
      );

      expect(article.url).toBe(`https://${DOMAIN}/u/alice/${type}/url-test`);
      expect(article.id).toBe(`https://${DOMAIN}/u/alice/${type}/url-test`);
    }
  });

  it('generates correct actor URIs', () => {
    const article = contentToArticle(
      { id: 'actor-test', type: 'article', title: 'Test', slug: 'test' },
      { username: 'bob' },
      DOMAIN,
    );

    expect(article.attributedTo).toBe(`https://${DOMAIN}/users/bob`);
    expect(article.cc).toEqual([`https://${DOMAIN}/users/bob/followers`]);
  });
});

describe('edge cases', () => {
  it('handles empty string content', () => {
    const article = contentToArticle(
      { id: 'empty', type: 'article', title: 'Empty', slug: 'empty', content: '' },
      { username: 'alice' },
      DOMAIN,
    );
    expect(article.content).toBe('');

    const restored = articleToContent(article);
    expect(restored.content).toBe('');
  });

  it('handles very long titles', () => {
    const longTitle = 'A'.repeat(500);
    const article = contentToArticle(
      { id: 'long', type: 'article', title: longTitle, slug: 'long' },
      { username: 'alice' },
      DOMAIN,
    );
    expect(article.name).toBe(longTitle);

    const restored = articleToContent(article);
    expect(restored.title).toBe(longTitle);
  });

  it('handles unicode in all fields', () => {
    const original = {
      id: 'unicode',
      type: 'article' as const,
      title: '🤖 ロボットアーム制作ガイド',
      slug: 'robot-arm-guide',
      description: 'Guía para construir un brazo robótico 🦾',
      content: '<p>Étape 1: Préparer les pièces 电子零件</p>',
    };

    const article = contentToArticle(original, { username: 'alice' }, DOMAIN);
    const restored = articleToContent(article);

    expect(restored.title).toBe(original.title);
    expect(restored.description).toBe(original.description);
    expect(restored.content).toBe(original.content);
  });
});
