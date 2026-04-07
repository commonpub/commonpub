import { describe, it, expect } from 'vitest';
import {
  buildPageTree,
  buildBreadcrumbs,
  buildPagePath,
} from '../navigation/tree';
import type { DocsPage } from '../types';

const now = new Date();

function makePage(
  overrides: Partial<DocsPage> & { id: string; title: string; slug: string },
): DocsPage {
  return {
    versionId: 'v1',
    content: '',
    sortOrder: 0,
    parentId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const pages: DocsPage[] = [
  makePage({ id: 'p1', title: 'Getting Started', slug: 'getting-started', sortOrder: 0 }),
  makePage({ id: 'p2', title: 'Installation', slug: 'installation', sortOrder: 0, parentId: 'p1' }),
  makePage({
    id: 'p3',
    title: 'Configuration',
    slug: 'configuration',
    sortOrder: 1,
    parentId: 'p1',
  }),
  makePage({ id: 'p4', title: 'API Reference', slug: 'api-reference', sortOrder: 1 }),
  makePage({ id: 'p5', title: 'Endpoints', slug: 'endpoints', sortOrder: 0, parentId: 'p4' }),
];

describe('buildPageTree', () => {
  it('should build tree from flat pages', () => {
    const tree = buildPageTree(pages);
    expect(tree).toHaveLength(2);
    expect(tree[0]!.title).toBe('Getting Started');
    expect(tree[0]!.children).toHaveLength(2);
    expect(tree[1]!.title).toBe('API Reference');
    expect(tree[1]!.children).toHaveLength(1);
  });

  it('should sort by sortOrder', () => {
    const tree = buildPageTree(pages);
    expect(tree[0]!.children[0]!.title).toBe('Installation');
    expect(tree[0]!.children[1]!.title).toBe('Configuration');
  });

  it('should handle empty list', () => {
    expect(buildPageTree([])).toEqual([]);
  });

  it('should handle flat pages (no nesting)', () => {
    const flat = [
      makePage({ id: 'a', title: 'A', slug: 'a', sortOrder: 1 }),
      makePage({ id: 'b', title: 'B', slug: 'b', sortOrder: 0 }),
    ];
    const tree = buildPageTree(flat);
    expect(tree).toHaveLength(2);
    expect(tree[0]!.title).toBe('B');
    expect(tree[1]!.title).toBe('A');
  });

  it('should handle deeply nested pages', () => {
    const deep = [
      makePage({ id: 'l1', title: 'Level 1', slug: 'l1', sortOrder: 0 }),
      makePage({ id: 'l2', title: 'Level 2', slug: 'l2', sortOrder: 0, parentId: 'l1' }),
      makePage({ id: 'l3', title: 'Level 3', slug: 'l3', sortOrder: 0, parentId: 'l2' }),
    ];
    const tree = buildPageTree(deep);
    expect(tree[0]!.children[0]!.children[0]!.title).toBe('Level 3');
  });
});

describe('buildBreadcrumbs', () => {
  it('should build breadcrumb trail for nested page', () => {
    const crumbs = buildBreadcrumbs(pages, 'p2');
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0]!.title).toBe('Getting Started');
    expect(crumbs[1]!.title).toBe('Installation');
  });

  it('should return single crumb for root page', () => {
    const crumbs = buildBreadcrumbs(pages, 'p1');
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0]!.title).toBe('Getting Started');
  });

  it('should handle deeply nested breadcrumbs', () => {
    const deep = [
      makePage({ id: 'a', title: 'A', slug: 'a' }),
      makePage({ id: 'b', title: 'B', slug: 'b', parentId: 'a' }),
      makePage({ id: 'c', title: 'C', slug: 'c', parentId: 'b' }),
    ];
    const crumbs = buildBreadcrumbs(deep, 'c');
    expect(crumbs).toHaveLength(3);
    expect(crumbs.map((c) => c.title)).toEqual(['A', 'B', 'C']);
  });
});

describe('buildPagePath', () => {
  it('should build path for root page', () => {
    expect(buildPagePath(pages, 'p1')).toBe('getting-started');
  });

  it('should build nested path', () => {
    expect(buildPagePath(pages, 'p2')).toBe('getting-started/installation');
  });

  it('should build deeply nested path', () => {
    expect(buildPagePath(pages, 'p5')).toBe('api-reference/endpoints');
  });
});

