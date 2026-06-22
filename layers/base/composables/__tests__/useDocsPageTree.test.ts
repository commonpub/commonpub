/**
 * Tests for useDocsPageTree — the docs-editor page-tree CRUD orchestration
 * extracted from docs/[siteSlug]/edit.vue.
 *
 * The composable owns no lifecycle hooks (just a ref + setTimeout), so it can be
 * called directly without a host component. `$fetch` is stubbed via the global;
 * the page-context getters/callbacks are vi.fn spies.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDocsPageTree, type UseDocsPageTreeOptions } from '../useDocsPageTree';

function makeOpts(over: Partial<UseDocsPageTreeOptions> = {}): {
  opts: UseDocsPageTreeOptions;
  refreshPages: ReturnType<typeof vi.fn>;
  selectPage: ReturnType<typeof vi.fn>;
  onDeleted: ReturnType<typeof vi.fn>;
  toast: ReturnType<typeof vi.fn>;
} {
  const refreshPages = vi.fn(async () => {});
  const selectPage = vi.fn();
  const onDeleted = vi.fn();
  const toast = vi.fn();
  const opts: UseDocsPageTreeOptions = {
    siteSlug: () => 'mysite',
    versionId: () => undefined,
    version: () => '',
    pageCount: () => 3,
    refreshPages,
    selectPage,
    onDeleted,
    toast,
    ...over,
  };
  return { opts, refreshPages, selectPage, onDeleted, toast };
}

describe('useDocsPageTree', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('createPage posts a slugified new page, refreshes, selects it, and toasts', async () => {
    const fetchMock = vi.fn(async () => ({ id: 'new-1' }));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, refreshPages, selectPage, toast } = makeOpts({ pageCount: () => 5 });

    await useDocsPageTree(opts).createPage(null, 'Getting Started!');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/docs/mysite/pages',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          title: 'Getting Started!',
          slug: 'getting-started', // lowercased, non-alnum → '-', trimmed
          sortOrder: 6, // pageCount() + 1
          parentId: undefined,
        }),
      }),
    );
    expect(refreshPages).toHaveBeenCalledOnce();
    expect(selectPage).toHaveBeenCalledWith('new-1');
    expect(toast).toHaveBeenCalledWith('Page created', 'success');
  });

  it('createPage surfaces the error and does not refresh or select', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => { throw new Error('boom'); }));
    const { opts, refreshPages, selectPage, toast } = makeOpts();

    await useDocsPageTree(opts).createPage(null, 'x');

    expect(toast).toHaveBeenCalledWith('boom', 'error');
    expect(refreshPages).not.toHaveBeenCalled();
    expect(selectPage).not.toHaveBeenCalled();
  });

  it('renamePage PUTs the new title and refreshes', async () => {
    const fetchMock = vi.fn(async () => ({}));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, refreshPages, toast } = makeOpts();

    await useDocsPageTree(opts).renamePage('p1', 'Renamed');

    expect(fetchMock).toHaveBeenCalledWith('/api/docs/mysite/pages/p1', {
      method: 'PUT',
      body: { title: 'Renamed' },
    });
    expect(refreshPages).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith('Page renamed', 'success');
  });

  it('duplicatePage posts to the duplicate endpoint and selects the copy', async () => {
    const fetchMock = vi.fn(async () => ({ id: 'copy-1' }));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, selectPage } = makeOpts();

    await useDocsPageTree(opts).duplicatePage('p1');

    expect(fetchMock).toHaveBeenCalledWith('/api/docs/mysite/pages/p1/duplicate', { method: 'POST' });
    expect(selectPage).toHaveBeenCalledWith('copy-1');
  });

  it('deletePage deletes, notifies onDeleted, then refreshes', async () => {
    const fetchMock = vi.fn(async () => ({}));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, onDeleted, refreshPages, toast } = makeOpts();

    await useDocsPageTree(opts).deletePage('p1');

    expect(fetchMock).toHaveBeenCalledWith('/api/docs/mysite/pages/p1', { method: 'DELETE' });
    expect(onDeleted).toHaveBeenCalledWith('p1');
    expect(refreshPages).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith('Page deleted', 'success');
  });

  it('reorder posts the page order with the selected version', async () => {
    const fetchMock = vi.fn(async () => ({}));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, refreshPages } = makeOpts({ version: () => 'v2' });

    await useDocsPageTree(opts).reorder(['a', 'b']);

    expect(fetchMock).toHaveBeenCalledWith('/api/docs/mysite/pages/reorder', {
      method: 'POST',
      body: { pageIds: ['a', 'b'], version: 'v2' },
    });
    expect(refreshPages).toHaveBeenCalledOnce();
  });

  it('reparent defers its refresh; a following reorder cancels it (single refresh)', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('$fetch', vi.fn(async () => ({})));
    const { opts, refreshPages } = makeOpts();
    const tree = useDocsPageTree(opts);

    await tree.reparent('p1', 'parent');
    expect(refreshPages).not.toHaveBeenCalled(); // deferred behind the timer

    await tree.reorder(['p1', 'p2']); // refreshes once and cancels the deferred one
    expect(refreshPages).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(200); // the reparent timer must NOT refresh again
    expect(refreshPages).toHaveBeenCalledOnce();
  });

  it('a standalone reparent refreshes once after its timer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('$fetch', vi.fn(async () => ({})));
    const { opts, refreshPages } = makeOpts();

    await useDocsPageTree(opts).reparent('p1', null);
    expect(refreshPages).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(refreshPages).toHaveBeenCalledOnce();
  });
});
