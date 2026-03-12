import type { DocsPage, PageTreeNode, BreadcrumbItem, PrevNextLinks, NavItem } from '../types.js';

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

/**
 * Flatten a NavItem tree into an ordered list of leaf page IDs (DFS).
 */
export function flattenNav(items: NavItem[]): string[] {
  const result: string[] = [];

  function walk(nodes: NavItem[]): void {
    for (const node of nodes) {
      if (node.pageId) {
        result.push(node.pageId);
      }
      if (node.children?.length) {
        walk(node.children);
      }
    }
  }

  walk(items);
  return result;
}

/**
 * Get previous and next page links relative to the current page in the nav structure.
 */
export function getPrevNextLinks(
  navStructure: NavItem[],
  currentPageId: string,
  pages: DocsPage[],
): PrevNextLinks {
  const ordered = flattenNav(navStructure);
  const index = ordered.indexOf(currentPageId);

  if (index === -1) {
    return { prev: null, next: null };
  }

  const byId = new Map(pages.map((p) => [p.id, p]));

  const prevId = index > 0 ? ordered[index - 1] : undefined;
  const nextId = index < ordered.length - 1 ? ordered[index + 1] : undefined;

  const prevPage = prevId ? byId.get(prevId) : undefined;
  const nextPage = nextId ? byId.get(nextId) : undefined;

  return {
    prev: prevPage ? { title: prevPage.title, path: buildPagePath(pages, prevPage.id) } : null,
    next: nextPage ? { title: nextPage.title, path: buildPagePath(pages, nextPage.id) } : null,
  };
}
