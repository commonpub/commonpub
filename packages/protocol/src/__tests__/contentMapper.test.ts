import { describe, it, expect } from 'vitest';
import { contentToArticle, contentToNote, articleToContent, noteToComment } from '../contentMapper';
import { AP_CONTEXT, AP_PUBLIC } from '../activityTypes';

const domain = 'test.example.com';
const author = { username: 'alice', displayName: 'Alice Maker' };

describe('contentToArticle', () => {
  it('should map a content item to an AP Article', () => {
    const article = contentToArticle(
      {
        id: 'uuid-1',
        type: 'article',
        title: 'Building a Robot',
        slug: 'building-a-robot',
        description: 'A guide to building robots',
        content: '<p>Step 1...</p>',
        publishedAt: new Date('2024-01-15T10:00:00Z'),
      },
      author,
      domain,
    );

    expect(article.type).toBe('Article');
    expect(article['@context']).toBe(AP_CONTEXT);
    expect(article.id).toBe('https://test.example.com/u/alice/blog/building-a-robot'); // article normalized to blog
    expect(article.attributedTo).toBe('https://test.example.com/users/alice');
    expect(article.name).toBe('Building a Robot');
    expect(article.content).toBe('<p>Step 1...</p>');
    expect(article.summary).toBe('A guide to building robots');
    expect(article.published).toBe('2024-01-15T10:00:00.000Z');
    expect(article.to).toEqual([AP_PUBLIC]);
    expect(article.cc).toEqual(['https://test.example.com/users/alice/followers']);
  });

  it('should include cover image as attachment', () => {
    const article = contentToArticle(
      {
        id: 'uuid-2',
        type: 'project',
        title: 'LED Cube',
        slug: 'led-cube',
        coverImageUrl: 'https://test.example.com/images/led-cube.jpg',
      },
      author,
      domain,
    );

    expect(article.attachment).toHaveLength(1);
    expect(article.attachment![0].type).toBe('Image');
    expect(article.attachment![0].url).toBe('https://test.example.com/images/led-cube.jpg');
  });

  it('should include URL pointing to content page', () => {
    const article = contentToArticle(
      { id: 'uuid-3', type: 'blog', title: 'Blog Post', slug: 'blog-post' },
      author,
      domain,
    );

    expect(article.url).toBe('https://test.example.com/u/alice/blog/blog-post');
  });

  it('should handle null optional fields', () => {
    const article = contentToArticle(
      {
        id: 'uuid-4',
        type: 'article',
        title: 'Minimal',
        slug: 'minimal',
        description: null,
        content: null,
        coverImageUrl: null,
        publishedAt: null,
        updatedAt: null,
      },
      author,
      domain,
    );

    expect(article.summary).toBeUndefined();
    expect(article.published).toBeUndefined();
    expect(article.attachment).toBeUndefined();
  });

  it('should stringify non-string content', () => {
    const article = contentToArticle(
      {
        id: 'uuid-5',
        type: 'article',
        title: 'JSON Content',
        slug: 'json-content',
        content: [{ type: 'paragraph', content: 'hello' }],
      },
      author,
      domain,
    );

    expect(typeof article.content).toBe('string');
  });
});

describe('contentToNote', () => {
  it('should map a comment to an AP Note', () => {
    const note = contentToNote(
      {
        id: 'comment-1',
        content: 'Great post!',
        targetId: 'uuid-1',
        targetType: 'article',
        createdAt: new Date('2024-01-16T12:00:00Z'),
      },
      author,
      domain,
      'https://test.example.com/content/building-a-robot',
    );

    expect(note.type).toBe('Note');
    expect(note.id).toBe('https://test.example.com/comments/comment-1');
    expect(note.attributedTo).toBe('https://test.example.com/users/alice');
    expect(note.content).toBe('Great post!');
    expect(note.inReplyTo).toBe('https://test.example.com/content/building-a-robot');
    expect(note.published).toBe('2024-01-16T12:00:00.000Z');
    expect(note.to).toEqual([AP_PUBLIC]);
  });

  it('should omit inReplyTo when no parent URI given', () => {
    const note = contentToNote(
      {
        id: 'comment-2',
        content: 'Top-level comment',
        targetId: 'uuid-1',
        targetType: 'article',
      },
      author,
      domain,
    );

    expect(note.inReplyTo).toBeUndefined();
  });
});

describe('articleToContent', () => {
  it('should parse an AP Article into content insert shape', () => {
    const result = articleToContent({
      '@context': AP_CONTEXT,
      type: 'Article',
      id: 'https://remote.com/content/test',
      attributedTo: 'https://remote.com/users/bob',
      name: 'Remote Article',
      content: '<p>Remote content</p>',
      summary: 'A remote article',
      published: '2024-02-01T00:00:00Z',
      to: [AP_PUBLIC],
      attachment: [{ type: 'Image', url: 'https://remote.com/img.jpg' }],
    });

    expect(result.title).toBe('Remote Article');
    expect(result.content).toBe('<p>Remote content</p>');
    expect(result.description).toBe('A remote article');
    expect(result.publishedAt).toBeInstanceOf(Date);
    expect(result.coverImageUrl).toBe('https://remote.com/img.jpg');
  });

  it('should handle minimal Article without optional fields', () => {
    const result = articleToContent({
      '@context': AP_CONTEXT,
      type: 'Article',
      id: 'https://remote.com/content/minimal',
      attributedTo: 'https://remote.com/users/bob',
      name: 'Minimal',
      content: 'Just text',
      to: [AP_PUBLIC],
    });

    expect(result.title).toBe('Minimal');
    expect(result.description).toBeUndefined();
    expect(result.publishedAt).toBeUndefined();
    expect(result.coverImageUrl).toBeUndefined();
  });
});

describe('noteToComment', () => {
  it('should parse an AP Note into comment insert shape', () => {
    const result = noteToComment({
      '@context': AP_CONTEXT,
      type: 'Note',
      id: 'https://remote.com/comments/456',
      attributedTo: 'https://remote.com/users/bob',
      content: 'Nice work!',
      inReplyTo: 'https://test.example.com/content/my-post',
      to: [AP_PUBLIC],
    });

    expect(result.content).toBe('Nice work!');
    expect(result.inReplyTo).toBe('https://test.example.com/content/my-post');
  });

  it('should handle Note without inReplyTo', () => {
    const result = noteToComment({
      '@context': AP_CONTEXT,
      type: 'Note',
      id: 'https://remote.com/comments/789',
      attributedTo: 'https://remote.com/users/bob',
      content: 'Standalone note',
      to: [AP_PUBLIC],
    });

    expect(result.content).toBe('Standalone note');
    expect(result.inReplyTo).toBeUndefined();
  });
});
