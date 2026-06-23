/**
 * useDocsSiteSettings — site-level settings/versions actions for the docs editor.
 *
 * Continues the monolith split of docs/[siteSlug]/edit.vue (after
 * useEditorAutosave and useDocsPageTree). The three site actions —
 * save settings, delete site, create version — plus their dialog/form state
 * were inlined in the 1.3k-line page.
 *
 * Like useDocsPageTree, this owns no lifecycle hooks (just refs + functions),
 * so it unit-tests with a stubbed `$fetch` and `confirm`. The page supplies its
 * context (slug, refresh, post-delete navigation, toast) via getters/callbacks,
 * and seeds settingsName/settingsDesc from its own `watch(site)`.
 */
import { ref, type Ref } from 'vue';

export interface UseDocsSiteSettingsOptions {
  /** Current site slug (the `[siteSlug]` route param). */
  siteSlug: () => string;
  /** Re-fetch the site after a settings/version change. */
  refreshSite: () => Promise<void> | void;
  /** Called after the site is deleted (the page navigates away). */
  onSiteDeleted: () => Promise<void> | void;
  /** Toast helper (useToast().show). */
  toast: (message: string, kind: 'success' | 'error') => void;
}

export interface UseDocsSiteSettings {
  showSettings: Ref<boolean>;
  settingsName: Ref<string>;
  settingsDesc: Ref<string>;
  savingSettings: Ref<boolean>;
  newVersion: Ref<string>;
  newVersionDefault: Ref<boolean>;
  savingVersion: Ref<boolean>;
  saveSiteSettings: () => Promise<void>;
  deleteSite: () => Promise<void>;
  createVersion: () => Promise<void>;
}

export function useDocsSiteSettings(opts: UseDocsSiteSettingsOptions): UseDocsSiteSettings {
  const showSettings = ref(false);
  const settingsName = ref('');
  const settingsDesc = ref('');
  const savingSettings = ref(false);
  const newVersion = ref('');
  const newVersionDefault = ref(false);
  const savingVersion = ref(false);

  async function saveSiteSettings(): Promise<void> {
    savingSettings.value = true;
    try {
      await $fetch(`/api/docs/${opts.siteSlug()}`, {
        method: 'PUT',
        body: { name: settingsName.value, description: settingsDesc.value },
      });
      opts.toast('Site settings updated', 'success');
      await opts.refreshSite();
    } catch (err: unknown) {
      opts.toast(err instanceof Error ? err.message : 'Failed to update settings', 'error');
    } finally {
      savingSettings.value = false;
    }
  }

  async function deleteSite(): Promise<void> {
    if (!confirm('Delete this entire docs site? All pages and versions will be permanently deleted.')) return;
    try {
      await $fetch(`/api/docs/${opts.siteSlug()}`, { method: 'DELETE' });
      opts.toast('Docs site deleted', 'success');
      await opts.onSiteDeleted();
    } catch {
      opts.toast('Failed to delete docs site', 'error');
    }
  }

  async function createVersion(): Promise<void> {
    if (!newVersion.value.trim()) return;
    savingVersion.value = true;
    try {
      await $fetch(`/api/docs/${opts.siteSlug()}/versions`, {
        method: 'POST',
        body: { version: newVersion.value, isDefault: newVersionDefault.value },
      });
      opts.toast('Version created', 'success');
      newVersion.value = '';
      newVersionDefault.value = false;
      await opts.refreshSite();
    } catch (err: unknown) {
      opts.toast(err instanceof Error ? err.message : 'Failed to create version', 'error');
    } finally {
      savingVersion.value = false;
    }
  }

  return {
    showSettings,
    settingsName,
    settingsDesc,
    savingSettings,
    newVersion,
    newVersionDefault,
    savingVersion,
    saveSiteSettings,
    deleteSite,
    createVersion,
  };
}
