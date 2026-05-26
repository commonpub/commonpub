<script setup lang="ts">
/**
 * /admin/theme — top-level theme manager.
 *
 * Lists every theme available to the picker (built-in, code-registered,
 * DB-stored custom) grouped by family. The currently active family is
 * highlighted. From here the admin can:
 *
 *   • select any theme (sets `theme.default` instance-wide)
 *   • edit a custom theme (opens /admin/theme/edit/[id])
 *   • duplicate / fork any theme into a new editable custom theme
 *   • delete a custom theme
 *   • create a new custom theme from scratch
 *   • capture the currently-applied :root tokens (when a thin layer app
 *     ships its own CSS overrides) into a new editable custom theme
 *   • import a theme from a .cpub-theme.json file
 *   • adjust the legacy "token overrides" — ad-hoc inline tweaks that
 *     apply on top of whichever theme is active
 *
 * Heavy lifting lives in `useThemeAdmin`. This page is the orchestration
 * surface.
 */
import { onMounted, ref, computed, watch } from 'vue';
// Auto-imported by Nuxt:
//   useThemeAdmin          ← composables/useThemeAdmin.ts
//   parseCustomThemeId     ← utils/themeIds.ts
//   buildExportFile,       ← utils/themeIO.ts
//   parseExportFile,
//   downloadThemeFile
//   detectAppliedOverrides ← utils/themeDiscovery.ts

definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Theme — Admin — ${useSiteName()}` });

const themesApi = useThemeAdmin();
const router = useRouter();

const { data: settings, refresh: refreshSettings } = await useFetch<Record<string, unknown>>('/api/admin/settings');

const saving = ref(false);
const toast = ref<{ msg: string; tone: 'success' | 'error' } | null>(null);

const instanceDefault = computed<string>(() => {
  const val = settings.value?.['theme.default'];
  return typeof val === 'string' ? val : 'base';
});

/** Which family is currently active? Computed by checking the picked
 *  themeId against each family's light/dark variant. */
const activeFamily = computed<string | null>(() => {
  const id = instanceDefault.value;
  for (const f of themesApi.families.value) {
    if (f.light?.id === id || f.dark?.id === id) return f.id;
  }
  return null;
});

onMounted(async () => {
  await themesApi.refresh();
  recheckDiscovery();
});

// --- Selection ---

async function setActiveTheme(themeId: string): Promise<void> {
  saving.value = true;
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: { key: 'theme.default', value: themeId },
    });
    await refreshSettings();
    notify('Theme applied', 'success');
  } catch (err) {
    notify(err instanceof Error ? err.message : 'Failed to save', 'error');
  } finally {
    saving.value = false;
  }
}

// --- Edit / Duplicate / Delete ---

function editTheme(themeId: string): void {
  const customId = parseCustomThemeId(themeId);
  if (!customId) return;
  router.push(`/admin/theme/edit/${customId}`);
}

async function duplicateTheme(themeId: string): Promise<void> {
  // Build a seed in client-side, then push to the editor in "create" mode.
  // The editor reads the seed from a sessionStorage key (avoids a server
  // round-trip just to create-then-edit).
  const customId = parseCustomThemeId(themeId);
  let seed: {
    id: string;
    name: string;
    description: string;
    family: string;
    isDark: boolean;
    parentTheme: string;
    tokens: Record<string, string>;
  };

  if (customId && themesApi.data.value) {
    const src = themesApi.data.value.custom.find((t) => t.id === customId);
    if (!src) return;
    seed = {
      id: nextAvailableId(`${src.id}-copy`),
      name: `${src.name} (copy)`,
      description: src.description ?? '',
      family: src.family,
      isDark: src.isDark,
      parentTheme: src.parentTheme,
      tokens: { ...src.tokens },
    };
  } else {
    // Forking a built-in or registered theme — seed tokens from computed
    // styles by switching <html> data-theme momentarily. Cleaner: pull
    // defaults from TOKEN_SPECS. We use a hybrid: defaults for known
    // tokens with the active-theme overrides for the few that aren't.
    const detected = detectAppliedOverrides();
    seed = {
      id: nextAvailableId(themeId.replace(/^cpub-custom-/, '') + '-fork'),
      name: `Custom — based on ${themeId}`,
      description: '',
      family: `custom-${themeId.replace(/^cpub-custom-/, '')}`,
      isDark: detected.isDark,
      parentTheme: themeId,
      tokens: detected.tokens,
    };
  }

  sessionStorage.setItem('cpub-theme-editor-seed', JSON.stringify(seed));
  router.push('/admin/theme/edit/__new');
}

async function removeTheme(themeId: string): Promise<void> {
  const customId = parseCustomThemeId(themeId);
  if (!customId) return;
  if (!confirm(`Delete custom theme "${customId}"? This cannot be undone.`)) return;
  saving.value = true;
  try {
    const res = await $fetch<{ ok: true; resetDefault: boolean }>(`/api/admin/themes/${customId}`, {
      method: 'DELETE',
    });
    await Promise.all([themesApi.refresh(), refreshSettings()]);
    notify(res.resetDefault ? 'Theme deleted — default reset to Classic' : 'Theme deleted', 'success');
  } catch (err) {
    notify(err instanceof Error ? err.message : 'Failed to delete', 'error');
  } finally {
    saving.value = false;
  }
}

// --- Create / Capture / Import ---

function createBlank(): void {
  const seed = {
    id: nextAvailableId('my-theme'),
    name: 'My theme',
    description: '',
    family: 'custom',
    isDark: false,
    parentTheme: 'base',
    tokens: {},
  };
  sessionStorage.setItem('cpub-theme-editor-seed', JSON.stringify(seed));
  router.push('/admin/theme/edit/__new');
}

function captureCurrent(): void {
  const detected = detectAppliedOverrides();
  if (detected.count === 0) {
    notify('No custom tokens detected at :root', 'error');
    return;
  }
  const seed = {
    id: nextAvailableId(`captured-${new Date().toISOString().slice(0, 10)}`),
    name: 'Captured current site theme',
    description: `Auto-captured from the live :root on ${new Date().toLocaleDateString()} — ${detected.count} tokens.`,
    family: 'captured',
    isDark: detected.isDark,
    parentTheme: detected.isDark ? 'dark' : 'base',
    tokens: detected.tokens,
  };
  sessionStorage.setItem('cpub-theme-editor-seed', JSON.stringify(seed));
  router.push('/admin/theme/edit/__new');
}

const importFileInput = ref<HTMLInputElement | null>(null);
function openImportDialog(): void {
  importFileInput.value?.click();
}
async function onImportFile(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const theme = parseExportFile(text);
    theme.id = nextAvailableId(theme.id);
    sessionStorage.setItem('cpub-theme-editor-seed', JSON.stringify(theme));
    router.push('/admin/theme/edit/__new');
  } catch (err) {
    notify(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
  }
  (e.target as HTMLInputElement).value = '';
}

function exportTheme(themeId: string): void {
  const customId = parseCustomThemeId(themeId);
  if (!customId) return;
  const src = themesApi.findCustom(customId);
  if (!src) return;
  downloadThemeFile(src);
  notify(`Exported ${src.id}.cpub-theme.json`, 'success');
}

// --- Helpers ---

function nextAvailableId(base: string): string {
  const slug = base.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const used = new Set((themesApi.data.value?.custom ?? []).map((t) => t.id));
  if (!used.has(slug)) return slug;
  let i = 2;
  while (used.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

function notify(msg: string, tone: 'success' | 'error'): void {
  toast.value = { msg, tone };
  setTimeout(() => { toast.value = null; }, 2400);
}

// --- Discovery (client-only) ---

const discovery = ref<{ count: number; tokens: Record<string, string>; isDark: boolean }>({
  count: 0,
  tokens: {},
  isDark: false,
});

function recheckDiscovery(): void {
  if (typeof window === 'undefined') return;
  discovery.value = detectAppliedOverrides();
}

/**
 * Only show the "your site has a custom theme" banner when the detected
 * overrides are LIKELY from a CSS file shipped by the layer app — NOT from
 * a custom theme the admin has already saved (which would also appear as
 * :root token overrides because the SSR middleware injects them there).
 *
 * Gating rules:
 *   - hide when the active default is already a cpub-custom-* theme
 *   - hide when instance-wide token overrides are set (those tokens explain
 *     the diff; the banner would confuse the admin into re-capturing them)
 *   - hide when no overrides were detected
 *
 * If admins want to re-capture from a fresh :root state, they can revert
 * to the base theme, clear overrides, then the banner will reappear.
 */
const showDiscoveryBanner = computed<boolean>(() => {
  if (discovery.value.count === 0) return false;
  if (instanceDefault.value.startsWith('cpub-custom-')) return false;
  if (Object.keys(initialOverrides.value).length > 0) return false;
  return true;
});

// --- Token overrides (legacy / quick tweaks) ---
// State + UI live in <AdminThemeOverridesPanel>; this page only persists
// what the panel emits.

const initialOverrides = computed<Record<string, string>>(() => {
  const raw = settings.value?.['theme.token_overrides'];
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? { ...(raw as Record<string, string>) }
    : {};
});

async function saveOverrides(overrides: Record<string, string>): Promise<void> {
  saving.value = true;
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: { key: 'theme.token_overrides', value: overrides },
    });
    await refreshSettings();
    notify('Overrides saved', 'success');
  } catch (err) {
    notify(err instanceof Error ? err.message : 'Failed to save', 'error');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="admin-theme-page">
    <header class="admin-theme-header">
      <div>
        <h1 class="admin-page-title">Theme</h1>
        <p class="admin-page-desc">
          Pick a theme, edit your own, or capture the look your layer app already ships
          with. Changes apply instance-wide; individual users still control light/dark.
        </p>
      </div>
      <div class="admin-theme-actions">
        <button class="cpub-btn" :disabled="saving" @click="openImportDialog">
          <i class="fa-solid fa-file-import" aria-hidden="true" /> Import…
        </button>
        <input
          ref="importFileInput"
          type="file"
          accept="application/json,.json,.cpub-theme.json"
          hidden
          @change="onImportFile"
        />
        <button class="cpub-btn cpub-btn-primary" :disabled="saving" @click="createBlank">
          <i class="fa-solid fa-plus" aria-hidden="true" /> New custom theme
        </button>
      </div>
    </header>

    <div v-if="toast" class="admin-theme-toast" :class="`tone-${toast.tone}`">
      <i :class="['fa-solid', toast.tone === 'success' ? 'fa-check' : 'fa-triangle-exclamation']" aria-hidden="true" />
      {{ toast.msg }}
    </div>

    <!-- Discovery banner — only when the overrides are from CSS (not from
         a custom theme this admin already saved or instance-wide overrides).
         Without this gate, the banner would re-appear after capture since
         the custom theme it created now appears as a token override on :root. -->
    <section
      v-if="showDiscoveryBanner"
      class="admin-theme-discovery"
      role="region"
      aria-label="Discovered theme tokens"
    >
      <div class="admin-theme-discovery-icon"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /></div>
      <div class="admin-theme-discovery-body">
        <h2 class="admin-theme-discovery-title">Your site has a custom theme</h2>
        <p class="admin-theme-discovery-desc">
          We detected <strong>{{ discovery.count }}</strong> CSS token{{ discovery.count === 1 ? '' : 's' }}
          on <code>:root</code> that differ from the built-in defaults — probably from
          a CSS file your layer app loads. Capture it into an editable custom theme so
          you can tweak it from this admin panel.
        </p>
      </div>
      <button class="cpub-btn cpub-btn-primary" :disabled="saving" @click="captureCurrent">
        <i class="fa-solid fa-camera" aria-hidden="true" /> Capture
      </button>
    </section>

    <p v-if="themesApi.loading.value && !themesApi.data.value" class="admin-empty">
      <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" /> Loading themes…
    </p>

    <section v-else class="admin-theme-families">
      <AdminThemeFamilyCard
        v-for="family in themesApi.families.value"
        :key="family.id"
        :family="family"
        :active="activeFamily === family.id"
        :saving="saving"
        @select="setActiveTheme"
        @edit="editTheme"
        @duplicate="duplicateTheme"
        @export-theme="exportTheme"
        @remove="removeTheme"
      />
    </section>

    <!-- Token overrides (legacy / quick tweaks) -->
    <AdminThemeOverridesPanel
      :initial="initialOverrides"
      :saving="saving"
      @save="saveOverrides"
    />
  </div>
</template>

<style scoped>
.admin-theme-page { max-width: 1080px; }

.admin-theme-header {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}
.admin-page-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin: 0 0 var(--space-2); }
.admin-page-desc { font-size: var(--text-sm); color: var(--text-dim); margin: 0; max-width: 560px; line-height: var(--leading-snug); }
.admin-theme-actions { display: flex; gap: var(--space-2); margin-left: auto; }

.admin-theme-toast {
  position: fixed;
  top: calc(var(--nav-height) + var(--space-4));
  right: var(--space-4);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  z-index: var(--z-toast);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-inverse);
}
.admin-theme-toast.tone-success { background: var(--green); }
.admin-theme-toast.tone-error { background: var(--red); }

.admin-theme-discovery {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--accent-bg);
  border: var(--border-width-default) solid var(--accent-border);
  margin-bottom: var(--space-5);
}
.admin-theme-discovery-icon {
  width: 40px;
  height: 40px;
  background: var(--accent);
  color: var(--color-on-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.admin-theme-discovery-body { flex: 1; }
.admin-theme-discovery-title { font-size: var(--text-md); font-weight: var(--font-weight-bold); margin: 0 0 4px; }
.admin-theme-discovery-desc { font-size: var(--text-sm); color: var(--text-dim); margin: 0; line-height: var(--leading-snug); }
.admin-theme-discovery-desc code { font-family: var(--font-mono); font-size: 0.95em; color: var(--accent); padding: 0 4px; background: var(--accent-bg); }

.admin-theme-families { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-8); }

/* Overrides-panel styles moved to AdminThemeOverridesPanel.vue */

@media (max-width: 640px) {
  .admin-theme-header { align-items: flex-start; }
  .admin-theme-actions { margin-left: 0; width: 100%; }
  .admin-theme-actions .cpub-btn { flex: 1; }
  .admin-theme-discovery { flex-direction: column; align-items: flex-start; }
}
</style>
