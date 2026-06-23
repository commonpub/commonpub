/**
 * useDocsPageTree — page-tree CRUD orchestration for the docs editor.
 *
 * Extracted from docs/[siteSlug]/edit.vue (whose autosave engine was already
 * pulled into useEditorAutosave). The six tree actions — create, rename,
 * duplicate, delete, reorder, reparent — were ~100 lines of inline
 * `$fetch` + `refreshPages()` + toast scattered through the 1.4k-line page.
 *
 * The subtle part now lives here and is unit-tested: a drag that reparents a
 * page and then immediately reorders its new siblings must NOT refresh twice
 * (the first refresh would race the reorder). So `reparent` defers its refresh
 * behind a short timer and `reorder` cancels that pending refresh — a tiny
 * state machine that was easy to break inline.
 *
 * The page supplies its context (slug, version, page count, refresh, selection)
 * via getters/callbacks, so this composable stays free of route globals and
 * unit-tests with a stubbed `$fetch`.
 */
import { ref } from 'vue';

export interface UseDocsPageTreeOptions {
  /** Current site slug (the `[siteSlug]` route param). */
  siteSlug: () => string;
  /** Selected version id, sent as the new page's `versionId` (undefined = default version). */
  versionId: () => string | undefined;
  /** Selected version string, sent as the reorder `version` (falsy = omitted). */
  version: () => string;
  /** Number of existing pages, used to compute the new page's `sortOrder`. */
  pageCount: () => number;
  /** Re-fetch the page list. */
  refreshPages: () => Promise<void> | void;
  /** Select a page by id (after create / duplicate). */
  selectPage: (id: string) => void;
  /** Called when a page is deleted so the page can clear selection/editor if it was active. */
  onDeleted: (pageId: string) => void;
  /** Toast helper (useToast().show). */
  toast: (message: string, kind: 'success' | 'error') => void;
}

export interface UseDocsPageTree {
  createPage: (parentId: string | null, title: string) => Promise<void>;
  renamePage: (pageId: string, newTitle: string) => Promise<void>;
  duplicatePage: (pageId: string) => Promise<void>;
  deletePage: (pageId: string) => Promise<void>;
  reorder: (pageIds: string[]) => Promise<void>;
  reparent: (pageId: string, newParentId: string | null) => Promise<void>;
}

/** A drag-reparent defers its refresh this long so a following reorder can cancel it. */
const REPARENT_REFRESH_DELAY_MS = 100;

export function useDocsPageTree(opts: UseDocsPageTreeOptions): UseDocsPageTree {
  // True while a reparent is waiting to refresh; a reorder clears it to suppress
  // the deferred refresh (the reorder's own refresh covers both moves).
  const pendingReparent = ref(false);

  function hasId(value: unknown): value is { id: string } {
    return !!value && typeof value === 'object' && 'id' in value;
  }

  async function createPage(parentId: string | null, title: string): Promise<void> {
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const result = await $fetch(`/api/docs/${opts.siteSlug()}/pages`, {
        method: 'POST',
        body: {
          title,
          slug,
          content: [['paragraph', { html: '' }]],
          parentId: parentId ?? undefined,
          sortOrder: opts.pageCount() + 1,
          versionId: opts.versionId(),
        },
      });
      await opts.refreshPages();
      if (hasId(result)) opts.selectPage(result.id);
      opts.toast('Page created', 'success');
    } catch (err: unknown) {
      opts.toast(err instanceof Error ? err.message : 'Failed to create page', 'error');
    }
  }

  async function renamePage(pageId: string, newTitle: string): Promise<void> {
    try {
      await $fetch(`/api/docs/${opts.siteSlug()}/pages/${pageId}`, {
        method: 'PUT',
        body: { title: newTitle },
      });
      await opts.refreshPages();
      opts.toast('Page renamed', 'success');
    } catch (err: unknown) {
      opts.toast(err instanceof Error ? err.message : 'Failed to rename', 'error');
    }
  }

  async function duplicatePage(pageId: string): Promise<void> {
    try {
      const result = await $fetch(`/api/docs/${opts.siteSlug()}/pages/${pageId}/duplicate`, {
        method: 'POST',
      });
      await opts.refreshPages();
      if (hasId(result)) opts.selectPage(result.id);
      opts.toast('Page duplicated', 'success');
    } catch (err: unknown) {
      opts.toast(err instanceof Error ? err.message : 'Failed to duplicate page', 'error');
    }
  }

  async function deletePage(pageId: string): Promise<void> {
    try {
      await $fetch(`/api/docs/${opts.siteSlug()}/pages/${pageId}`, { method: 'DELETE' });
      opts.onDeleted(pageId);
      await opts.refreshPages();
      opts.toast('Page deleted', 'success');
    } catch (err: unknown) {
      opts.toast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  }

  async function reorder(pageIds: string[]): Promise<void> {
    pendingReparent.value = false; // Cancel a preceding reparent's deferred refresh.
    try {
      await $fetch(`/api/docs/${opts.siteSlug()}/pages/reorder`, {
        method: 'POST',
        body: { pageIds, version: opts.version() || undefined },
      });
      await opts.refreshPages();
    } catch {
      opts.toast('Failed to reorder', 'error');
    }
  }

  async function reparent(pageId: string, newParentId: string | null): Promise<void> {
    try {
      await $fetch(`/api/docs/${opts.siteSlug()}/pages/${pageId}`, {
        method: 'PUT',
        body: { parentId: newParentId ?? null },
      });
      // Defer the refresh: if a reorder follows immediately (drag across siblings),
      // it cancels this and refreshes once. A standalone reparent refreshes itself.
      pendingReparent.value = true;
      setTimeout(async () => {
        if (pendingReparent.value) {
          pendingReparent.value = false;
          await opts.refreshPages();
        }
      }, REPARENT_REFRESH_DELAY_MS);
    } catch {
      opts.toast('Failed to move page', 'error');
    }
  }

  return { createPage, renamePage, duplicatePage, deletePage, reorder, reparent };
}
