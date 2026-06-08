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
import { recipeToTokens, randomizeRecipe, defaultRecipe, randomName, type ThemeRecipe } from '@commonpub/theme-studio';
// Auto-imported by Nuxt:
//   useThemeAdmin          ← composables/useThemeAdmin.ts
//   parseCustomThemeId     ← utils/themeIds.ts
//   buildExportFile,       ← utils/themeIO.ts
//   parseExportFile,
//   downloadThemeFile
//   detectAppliedOverrides ← utils/themeDiscovery.ts

definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Theme, Admin, ${useSiteName()}` });

const themesApi = useThemeAdmin();
const router = useRouter();
const { themeStudio } = useFeatures();

/** The "New theme" dropdown (<details>); closed after a choice is picked. */
const newMenu = ref<HTMLDetailsElement | null>(null);
function pick(action: () => void): void {
  newMenu.value?.removeAttribute('open');
  action();
}

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
      name: `Custom, based on ${themeId}`,
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
    notify(res.resetDefault ? 'Theme deleted, default reset to Classic' : 'Theme deleted', 'success');
  } catch (err) {
    notify(err instanceof Error ? err.message : 'Failed to delete', 'error');
  } finally {
    saving.value = false;
  }
}

// --- Create / Capture / Import ---

function createBlank(): void {
  // "New custom theme" forks the CURRENTLY ACTIVE theme so you start from the
  // look on screen, not a blank Classic slate. (It previously seeded an empty,
  // base-parented theme — which is why saving reverted everything to Classic.)
  const active = instanceDefault.value;
  const customId = parseCustomThemeId(active);

  // Active theme is itself a custom theme → copy its stored tokens directly
  // (computed-style capture can't reconstruct a custom theme's full set).
  if (customId && themesApi.data.value) {
    const src = themesApi.data.value.custom.find((t) => t.id === customId);
    if (src) {
      const copyId = nextAvailableId(`${src.id}-copy`);
      const seed = {
        id: copyId,
        name: `${src.name} (copy)`,
        description: src.description ?? '',
        // Unique family (= the slug) so each new theme is its OWN picker card
        // instead of collapsing into a shared "custom" family.
        family: copyId,
        isDark: src.isDark,
        parentTheme: src.parentTheme,
        tokens: { ...src.tokens },
      };
      sessionStorage.setItem('cpub-theme-editor-seed', JSON.stringify(seed));
      router.push('/admin/theme/edit/__new');
      return;
    }
  }

  // Built-in / registered active theme → capture its applied tokens so the new
  // theme reproduces the current look (a custom theme renders as base + tokens,
  // so a complete capture is what keeps it from falling back to Classic).
  const detected = detectAppliedOverrides();
  const isBuiltInParent = themesApi.data.value?.builtIn.some((t) => t.id === active) ?? false;
  const blankId = nextAvailableId('my-theme');
  const seed = {
    id: blankId,
    name: 'My theme',
    description: detected.count ? `Forked from the active theme (${detected.count} tokens).` : '',
    family: blankId,
    isDark: detected.isDark,
    parentTheme: isBuiltInParent ? active : 'base',
    tokens: detected.tokens,
  };
  sessionStorage.setItem('cpub-theme-editor-seed', JSON.stringify(seed));
  router.push('/admin/theme/edit/__new');
}

/**
 * Seed a new theme from a theme-studio recipe and open the editor straight
 * into the Studio wizard (the `openStudio` flag). Used by both the guided
 * start (a neutral default recipe) and the dice roll (a random one).
 */
function startFromRecipe(recipe: ThemeRecipe, opts: { id: string; name: string }): void {
  const gen = recipeToTokens(recipe);
  const id = nextAvailableId(opts.id);
  const seed = {
    id,
    name: opts.name,
    description: '',
    // Unique family per theme (= the slug) so the picker keeps each Studio
    // theme separate AND can group its light/dark pair together. (A shared
    // 'custom' family would collapse every Studio theme into one card.)
    family: id,
    isDark: recipe.mode === 'dark',
    parentTheme: gen.parentTheme,
    tokens: gen.tokens,
    recipe,
    fonts: gen.fonts,
    openStudio: true,
  };
  sessionStorage.setItem('cpub-theme-editor-seed', JSON.stringify(seed));
  router.push('/admin/theme/edit/__new');
}

function startGuided(): void {
  startFromRecipe(defaultRecipe(), { id: 'my-theme', name: 'My theme' });
}

function startDice(): void {
  const seed = Date.now() >>> 0;
  const name = randomName(seed);
  const pretty = name.charAt(0) + name.slice(1).toLowerCase();
  startFromRecipe(randomizeRecipe(seed), { id: pretty, name: pretty });
}

function captureCurrent(): void {
  const detected = detectAppliedOverrides();
  if (detected.count === 0) {
    notify('No custom tokens detected at :root', 'error');
    return;
  }
  const capturedId = nextAvailableId(`captured-${new Date().toISOString().slice(0, 10)}`);
  const seed = {
    id: capturedId,
    name: 'Captured current site theme',
    description: `Auto-captured from the live :root on ${new Date().toLocaleDateString()}, ${detected.count} tokens.`,
    family: capturedId,
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
/**
 * Show the "your site has a custom theme" banner ONLY when the detected
 * overrides on :root are likely from a CSS file the thin layer app
 * loaded (the deveco.io case) — NOT from the built-in theme itself or
 * from a custom theme the admin already saved.
 *
 * Refined gate (5 conditions, all must pass):
 *   - count > 0 (something to capture)
 *   - active theme is NOT a custom theme (already captured)
 *   - active theme IS 'base' (any non-base built-in's tokens would
 *     dominate the diff, making "capture" produce a clone of that
 *     theme — pointless. e.g. commonpub.io's active='agora' triggers
 *     count > 0 from agora.css; banner would confuse the admin)
 *   - no instance-wide token overrides set (those explain the diff)
 *
 * Caveat: a thin app that registers a `themes:` entry AND sets
 * instanceDefault to the registered slug (e.g. 'deveco') would have
 * the banner HIDDEN even though their CSS file overrides ARE the use
 * case the banner targets. For that case the admin can use the Fork
 * button on the registered theme's card instead. Document.
 */
const showDiscoveryBanner = computed<boolean>(() => {
  if (discovery.value.count === 0) return false;
  if (instanceDefault.value !== 'base') return false;  // hides built-in non-base + registered + custom
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
        <input
          ref="importFileInput"
          type="file"
          accept="application/json,.json,.cpub-theme.json"
          hidden
          @change="onImportFile"
        />
        <!-- One clear entry point. Each option creates a SEPARATE theme (its own
             family/card) — you can make as many as you like. -->
        <details ref="newMenu" class="admin-theme-new">
          <summary class="cpub-btn cpub-btn-primary">
            <i class="fa-solid fa-plus" aria-hidden="true" /> New theme
            <i class="fa-solid fa-chevron-down admin-theme-new-caret" aria-hidden="true" />
          </summary>
          <div class="admin-theme-new-menu" role="menu">
            <button v-if="themeStudio" type="button" role="menuitem" @click="pick(startGuided)">
              <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
              <span><b>Build with Studio</b><small>Guided: pick a vibe + colors, get a light/dark pair</small></span>
            </button>
            <button v-if="themeStudio" type="button" role="menuitem" @click="pick(startDice)">
              <i class="fa-solid fa-dice" aria-hidden="true" />
              <span><b>Surprise me</b><small>Roll a random coherent theme to start from</small></span>
            </button>
            <button type="button" role="menuitem" @click="pick(createBlank)">
              <i class="fa-solid fa-plus" aria-hidden="true" />
              <span><b>Blank</b><small>Fork the current look, edit tokens by hand</small></span>
            </button>
            <button v-if="discovery.count > 0" type="button" role="menuitem" @click="pick(captureCurrent)">
              <i class="fa-solid fa-camera" aria-hidden="true" />
              <span><b>Capture current</b><small>Save your layer app's CSS theme as editable</small></span>
            </button>
            <button type="button" role="menuitem" @click="pick(openImportDialog)">
              <i class="fa-solid fa-file-import" aria-hidden="true" />
              <span><b>Import</b><small>Load a .cpub-theme.json file</small></span>
            </button>
          </div>
        </details>
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
          on <code>:root</code> that differ from the built-in defaults, probably from
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

.admin-theme-new { position: relative; }
.admin-theme-new > summary { list-style: none; cursor: pointer; }
.admin-theme-new > summary::-webkit-details-marker { display: none; }
.admin-theme-new-caret { font-size: 9px; margin-left: 2px; }
.admin-theme-new-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
  width: 300px;
  max-width: 80vw;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md);
}
.admin-theme-new-menu button {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: none;
  border: 0;
  border-bottom: var(--border-width-thin) solid var(--border2);
  text-align: left;
  color: var(--text);
  cursor: pointer;
}
.admin-theme-new-menu button:last-child { border-bottom: 0; }
.admin-theme-new-menu button:hover { background: var(--surface2); }
.admin-theme-new-menu button > i { color: var(--accent); margin-top: 3px; width: 16px; text-align: center; }
.admin-theme-new-menu button b { display: block; font-size: var(--text-sm); }
.admin-theme-new-menu button small { display: block; font-size: var(--text-label); color: var(--text-dim); line-height: var(--leading-snug); margin-top: 2px; }

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
