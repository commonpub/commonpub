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
}>();

interface SceneOption {
  id: 'gallery' | 'prose' | 'admin';
  label: string;
  description: string;
  icon: string;
}

const PREVIEW_SCENES: SceneOption[] = [
  { id: 'gallery', label: 'Components', description: 'Buttons, cards, forms, badges, prose, code', icon: 'fa-th-large' },
  { id: 'prose', label: 'Article', description: 'Headings, paragraphs, quote, code block, list', icon: 'fa-file-lines' },
  { id: 'admin', label: 'Admin shell', description: 'Topbar, sidebar, table, stat cards', icon: 'fa-gauge' },
];

const activeScene = ref<SceneOption['id']>('gallery');
const previewMode = ref<'light' | 'dark'>(props.isDark ? 'dark' : 'light');

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
      :data-theme="parentTheme"
      :style="previewStyle"
      :data-preview-mode="previewMode"
    >
      <AdminThemeSceneGallery v-if="activeScene === 'gallery'" />
      <AdminThemeSceneProse v-else-if="activeScene === 'prose'" />
      <AdminThemeSceneAdmin v-else-if="activeScene === 'admin'" />
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
