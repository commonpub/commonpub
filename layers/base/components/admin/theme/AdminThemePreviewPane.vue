<script setup lang="ts">
/**
 * Live preview pane for the theme editor. Hosts the scene picker, the
 * light/dark mode toggle, and the scrollable scene surface that renders
 * the in-progress theme tokens applied to representative components.
 *
 * The scene system is pluggable: each scene is a Vue component rendered
 * inside the token-scoped wrapper. Add scenes by registering them in
 * PREVIEW_SCENES and dropping an `AdminThemeScene*.vue` in this directory.
 *
 * Future scenes the architecture is built to absorb:
 *   - 'iframe-route'    — render an actual site route with the in-progress theme
 *   - 'page-layout'     — full landing-page mockup with editable section list
 *   - 'layout-builder'  — drag-and-drop section composer
 */
import { computed, ref } from 'vue';

const props = defineProps<{
  tokens: Record<string, string>;
  /** The base theme whose CSS file provides inherited defaults (via data-theme). */
  parentTheme: string;
  isDark: boolean;
  /** Optional controlled preview mode. When provided, the Light/Dark toggle
   *  emits `update:mode` and the parent owns the state (so it can swap the
   *  previewed variant's tokens). Uncontrolled (internal) when omitted. */
  mode?: 'light' | 'dark';
}>();

const emit = defineEmits<{ 'update:mode': ['light' | 'dark'] }>();

interface SceneOption {
  id: 'gallery' | 'prose' | 'admin' | 'sheet';
  label: string;
  description: string;
  icon: string;
}

const PREVIEW_SCENES: SceneOption[] = [
  { id: 'gallery', label: 'Components', description: 'Buttons, cards, forms, badges, prose, code', icon: 'fa-th-large' },
  { id: 'prose', label: 'Article', description: 'Headings, paragraphs, quote, code block, list', icon: 'fa-file-lines' },
  { id: 'admin', label: 'Admin shell', description: 'Topbar, sidebar, table, stat cards', icon: 'fa-gauge' },
  { id: 'sheet', label: 'Spec sheet', description: 'Token swatches, contrast, type ladder, spacing', icon: 'fa-swatchbook' },
];

const activeScene = ref<SceneOption['id']>('gallery');
const internalMode = ref<'light' | 'dark'>(props.isDark ? 'dark' : 'light');
const previewMode = computed<'light' | 'dark'>({
  get: () => props.mode ?? internalMode.value,
  set: (v) => {
    internalMode.value = v;
    emit('update:mode', v);
  },
});

/**
 * Map every parent-theme id to its family's light + dark variant. Mirrors
 * `layers/base/utils/themeConfig.ts` THEME_TO_FAMILY + FAMILY_VARIANTS,
 * inlined here so the preview pane doesn't need to import the SSR-side
 * utils. Custom-theme parents (`cpub-custom-*`) and any unknown id fall
 * back to the classic family — the user's tokens override on top regardless.
 */
const FAMILY_VARIANT_OF: Record<string, { light: string; dark: string }> = {
  base: { light: 'base', dark: 'dark' },
  dark: { light: 'base', dark: 'dark' },
  agora: { light: 'agora', dark: 'agora-dark' },
  'agora-dark': { light: 'agora', dark: 'agora-dark' },
  generics: { light: 'generics', dark: 'generics' },
};

/**
 * The actual `data-theme` attribute applied to the preview surface,
 * resolved from `parentTheme` + `previewMode`. Returns `undefined` for the
 * base/light case (no attribute = `:root` rules apply natively, matching
 * the convention used by `applyThemeToElement` elsewhere).
 *
 * **Bug fix from 0.22.0**: previously `:data-theme="parentTheme"` was
 * hardcoded, so the Light/Dark toggle updated a ref but never re-rendered
 * the preview. Now the toggle actually swaps the rendered theme.
 */
const effectiveDataTheme = computed<string | undefined>(() => {
  const variants = FAMILY_VARIANT_OF[props.parentTheme] ?? FAMILY_VARIANT_OF.base!;
  const v = previewMode.value === 'dark' ? variants.dark : variants.light;
  return v === 'base' ? undefined : v;
});

/**
 * Build the inline style string scoped to the preview surface. We apply
 * tokens to the wrapper element only — that scopes the in-progress theme
 * to the preview and avoids leaking it into the surrounding admin UI.
 */
const previewStyle = computed(() => {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(props.tokens)) {
    if (typeof v !== 'string') continue;
    const safeKey = k.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeVal = v.replace(/[\r\n;]/g, ' ');
    if (!safeKey) continue;
    lines.push(`--${safeKey}: ${safeVal}`);
  }
  return lines.join('; ');
});
</script>

<template>
  <div class="theme-preview-pane">
    <header class="theme-preview-header">
      <div class="theme-preview-scene-picker" role="tablist" aria-label="Preview scene">
        <button
          v-for="scene in PREVIEW_SCENES"
          :key="scene.id"
          type="button"
          role="tab"
          :aria-selected="activeScene === scene.id"
          class="theme-preview-scene-tab"
          :class="{ active: activeScene === scene.id }"
          :title="scene.description"
          @click="activeScene = scene.id"
        >
          <i :class="['fa-solid', scene.icon]" aria-hidden="true" />
          <span>{{ scene.label }}</span>
        </button>
      </div>

      <div class="theme-preview-mode-toggle" role="radiogroup" aria-label="Preview mode">
        <button
          type="button"
          role="radio"
          :aria-checked="previewMode === 'light'"
          class="theme-preview-mode-btn"
          :class="{ active: previewMode === 'light' }"
          @click="previewMode = 'light'"
        >
          <i class="fa-solid fa-sun" aria-hidden="true" /> Light
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="previewMode === 'dark'"
          class="theme-preview-mode-btn"
          :class="{ active: previewMode === 'dark' }"
          @click="previewMode = 'dark'"
        >
          <i class="fa-solid fa-moon" aria-hidden="true" /> Dark
        </button>
      </div>
    </header>

    <div
      class="theme-preview-surface"
      :data-theme="effectiveDataTheme"
      :style="previewStyle"
      :data-preview-mode="previewMode"
    >
      <AdminThemeSceneGallery v-if="activeScene === 'gallery'" />
      <AdminThemeSceneProse v-else-if="activeScene === 'prose'" />
      <AdminThemeSceneAdmin v-else-if="activeScene === 'admin'" />
      <AdminThemeSceneSheet v-else-if="activeScene === 'sheet'" :tokens="tokens" :mode-key="previewMode" />
    </div>
  </div>
</template>

<style scoped>
.theme-preview-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--surface2);
  border-left: var(--border-width-default) solid var(--border);
}

.theme-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
  flex-wrap: wrap;
  gap: var(--space-2);
}

.theme-preview-scene-picker,
.theme-preview-mode-toggle {
  display: flex;
  gap: 2px;
  background: var(--surface2);
  padding: 2px;
  border: var(--border-width-thin) solid var(--border2);
}

.theme-preview-scene-tab,
.theme-preview-mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: none;
  border: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--text-dim);
  cursor: pointer;
  border-radius: 0;
}
.theme-preview-scene-tab:hover,
.theme-preview-mode-btn:hover { color: var(--text); }
.theme-preview-scene-tab.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: inset 0 -2px 0 var(--accent);
}
.theme-preview-mode-btn.active {
  background: var(--surface);
  color: var(--accent);
}
.theme-preview-scene-tab i { font-size: 10px; }

.theme-preview-surface {
  flex: 1;
  overflow: auto;
  padding: var(--space-4);
  background-color: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  /* Token re-application happens via inline style on this element. The
     `data-theme` attr seeds inherited defaults; inline style overrides
     each token the editor has changed. */
  min-height: 0;
}
</style>
