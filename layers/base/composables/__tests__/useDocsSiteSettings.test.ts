/**
 * Tests for useDocsSiteSettings — the docs-editor site settings/versions
 * actions extracted from docs/[siteSlug]/edit.vue.
 *
 * The composable owns no lifecycle hooks (just refs + functions), so it can be
 * called directly without a host component. `$fetch` and `confirm` are stubbed
 * via globals; the page-context callbacks are vi.fn spies.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useDocsSiteSettings, type UseDocsSiteSettingsOptions } from '../useDocsSiteSettings';

function makeOpts(over: Partial<UseDocsSiteSettingsOptions> = {}): {
  opts: UseDocsSiteSettingsOptions;
  refreshSite: ReturnType<typeof vi.fn>;
  onSiteDeleted: ReturnType<typeof vi.fn>;
  toast: ReturnType<typeof vi.fn>;
} {
  const refreshSite = vi.fn(async () => {});
  const onSiteDeleted = vi.fn(async () => {});
  const toast = vi.fn();
  const opts: UseDocsSiteSettingsOptions = {
    siteSlug: () => 'mysite',
    refreshSite,
    onSiteDeleted,
    toast,
    ...over,
  };
  return { opts, refreshSite, onSiteDeleted, toast };
}

describe('useDocsSiteSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saveSiteSettings PUTs name + description, toasts, and refreshes', async () => {
    const fetchMock = vi.fn(async () => ({}));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, refreshSite, toast } = makeOpts();
    const s = useDocsSiteSettings(opts);
    s.settingsName.value = 'New Name';
    s.settingsDesc.value = 'New Desc';

    await s.saveSiteSettings();

    expect(fetchMock).toHaveBeenCalledWith('/api/docs/mysite', {
      method: 'PUT',
      body: { name: 'New Name', description: 'New Desc' },
    });
    expect(toast).toHaveBeenCalledWith('Site settings updated', 'success');
    expect(refreshSite).toHaveBeenCalledOnce();
    expect(s.savingSettings.value).toBe(false);
  });

  it('saveSiteSettings surfaces the error and still clears the saving flag', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => { throw new Error('boom'); }));
    const { opts, refreshSite, toast } = makeOpts();
    const s = useDocsSiteSettings(opts);

    await s.saveSiteSettings();

    expect(toast).toHaveBeenCalledWith('boom', 'error');
    expect(refreshSite).not.toHaveBeenCalled();
    expect(s.savingSettings.value).toBe(false);
  });

  it('deleteSite confirms, DELETEs, then navigates away', async () => {
    const fetchMock = vi.fn(async () => ({}));
    vi.stubGlobal('$fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => true));
    const { opts, onSiteDeleted, toast } = makeOpts();

    await useDocsSiteSettings(opts).deleteSite();

    expect(fetchMock).toHaveBeenCalledWith('/api/docs/mysite', { method: 'DELETE' });
    expect(toast).toHaveBeenCalledWith('Docs site deleted', 'success');
    expect(onSiteDeleted).toHaveBeenCalledOnce();
  });

  it('deleteSite aborts (no fetch, no navigation) when the confirm is cancelled', async () => {
    const fetchMock = vi.fn(async () => ({}));
    vi.stubGlobal('$fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => false));
    const { opts, onSiteDeleted } = makeOpts();

    await useDocsSiteSettings(opts).deleteSite();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSiteDeleted).not.toHaveBeenCalled();
  });

  it('createVersion posts the version, resets the form, and refreshes', async () => {
    const fetchMock = vi.fn(async () => ({}));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, refreshSite, toast } = makeOpts();
    const s = useDocsSiteSettings(opts);
    s.newVersion.value = '2.0';
    s.newVersionDefault.value = true;

    await s.createVersion();

    expect(fetchMock).toHaveBeenCalledWith('/api/docs/mysite/versions', {
      method: 'POST',
      body: { version: '2.0', isDefault: true },
    });
    expect(toast).toHaveBeenCalledWith('Version created', 'success');
    expect(s.newVersion.value).toBe('');
    expect(s.newVersionDefault.value).toBe(false);
    expect(refreshSite).toHaveBeenCalledOnce();
  });

  it('createVersion is a no-op when the version string is blank', async () => {
    const fetchMock = vi.fn(async () => ({}));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, refreshSite } = makeOpts();
    const s = useDocsSiteSettings(opts);
    s.newVersion.value = '   ';

    await s.createVersion();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshSite).not.toHaveBeenCalled();
  });
});
