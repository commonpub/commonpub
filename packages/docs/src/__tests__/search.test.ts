import { describe, it, expect } from 'vitest';
import { stripMarkdown, buildSearchDocument, buildSearchQuery } from '../search/indexer';
import type { DocsPage, DocsSite } from '../types';

describe('stripMarkdown', () => {
  it('should strip heading markers', () => {
    expect(stripMarkdown('## Hello')).toBe('Hello');
  });

  it('should strip bold and italic', () => {
    expect(stripMarkdown('**bold** and *italic*')).toBe('bold and italic');
  });

  it('should strip links, keeping text', () => {
    expect(stripMarkdown('[click here](https://example.com)')).toBe('click here');
  });

  it('should strip code blocks', () => {
    const md = 'Before\n```js\nconsole.log("hi");\n```\nAfter';
    const result = stripMarkdown(md);
    expect(result).not.toContain('console.log');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });

  it('should strip inline code', () => {
    expect(stripMarkdown('Use `npm install`')).toBe('Use npm install');
  });

  it('should strip frontmatter', () => {
    const md = '---\ntitle: Test\n---\nContent';
    expect(stripMarkdown(md)).toBe('Content');
  });

  it('should strip blockquote markers', () => {
    expect(stripMarkdown('> A quote')).toBe('A quote');
  });

  it('should strip list markers', () => {
    expect(stripMarkdown('- Item 1\n- Item 2')).toContain('Item 1');
  });

  it('should handle empty string', () => {
    expect(stripMarkdown('')).toBe('');
  });

  it('should strip strikethrough', () => {
    expect(stripMarkdown('~~removed~~')).toBe('removed');
  });
});

describe('buildSearchDocument', () => {
  const now = new Date();
  const page: DocsPage = {
    id: 'page-1',
    versionId: 'v1',
    title: 'Getting Started',
    slug: 'getting-started',
    content:
      '## Introduction\n\nWelcome to **CommonPub**.\n\n## Setup\n\nInstall with `npm install`.',
    sortOrder: 0,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };

  const site: DocsSite = {
    id: 'site-1',
    name: 'My Docs',
    slug: 'my-docs',
    description: null,
    ownerId: 'user-1',
    themeTokens: null,
    createdAt: now,
    updatedAt: now,
  };

  it('should build a complete search document', () => {
    const doc = buildSearchDocument(page, site, 'v1', 'getting-started');
    expect(doc.pageId).toBe('page-1');
    expect(doc.siteId).toBe('site-1');
    expect(doc.title).toBe('Getting Started');
    expect(doc.path).toBe('getting-started');
    expect(doc.headings).toEqual(['Introduction', 'Setup']);
    expect(doc.content).toContain('Welcome to CommonPub');
  });
});

describe('buildSearchQuery', () => {
  it('should convert space-separated terms to tsquery', () => {
    expect(buildSearchQuery('getting started')).toBe('getting:* & started:*');
  });

  it('should handle single term', () => {
    expect(buildSearchQuery('setup')).toBe('setup:*');
  });

  it('should strip special characters', () => {
    expect(buildSearchQuery('@commonpub/docs')).toBe('commonpub:* & docs:*');
  });

  it('should return empty string for empty input', () => {
    expect(buildSearchQuery('')).toBe('');
    expect(buildSearchQuery('   ')).toBe('');
  });
});
