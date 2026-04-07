import type { DocsPage, PageTreeNode, BreadcrumbItem } from '../types.js';

/**
 * Build a tree of pages from a flat list, grouped by parentId and sorted by sortOrder.
 */
export function buildPageTree(pages: DocsPage[]): PageTreeNode[] {
  const byParent = new Map<string | null, DocsPage[]>();

  for (const page of pages) {
    const key = page.parentId;
    const group = byParent.get(key) ?? [];
    group.push(page);
    byParent.set(key, group);
  }

  function buildChildren(parentId: string | null): PageTreeNode[] {
    const children = byParent.get(parentId) ?? [];
    return children
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((page) => ({
        id: page.id,
        title: page.title,
        slug: page.slug,
        sortOrder: page.sortOrder,
        parentId: page.parentId,
        children: buildChildren(page.id),
      }));
  }

  return buildChildren(null);
}

/**
 * Build breadcrumb trail for a page by walking the ancestor chain.
 */
export function buildBreadcrumbs(pages: DocsPage[], pageId: string): BreadcrumbItem[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const crumbs: BreadcrumbItem[] = [];

  let current = byId.get(pageId);
  while (current) {
    const path = buildPagePath(pages, current.id);
    crumbs.unshift({ title: current.title, slug: current.slug, path });
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return crumbs;
}

/**
 * Build the URL path for a page by joining ancestor slugs.
 */
export function buildPagePath(pages: DocsPage[], pageId: string): string {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const segments: string[] = [];

  let current = byId.get(pageId);
  while (current) {
    segments.unshift(current.slug);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return segments.join('/');
}

