<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const { themeId, isDark, instanceDefault, setDarkMode } = useTheme();

const familyLabels: Record<string, string> = {
  base: 'Classic',
  dark: 'Classic',
  generics: 'Generics',
  agora: 'Agora',
  'agora-dark': 'Agora',
};

const currentFamily = computed(() => familyLabels[instanceDefault.value] ?? 'Classic');

function previewColors(dark: boolean): { bg: string; surface: string; accent: string; text: string; border: string } {
  // Resolve what theme ID would be for this mode
  const families: Record<string, { light: string; dark: string }> = {
    classic: { light: 'base', dark: 'dark' },
    agora: { light: 'agora', dark: 'agora-dark' },
    generics: { light: 'generics', dark: 'generics' },
  };
  const familyMap: Record<string, string> = {
    base: 'classic', dark: 'classic', generics: 'generics',
    agora: 'agora', 'agora-dark': 'agora',
  };
  const family = familyMap[instanceDefault.value] ?? 'classic';
  const id = dark ? families[family]!.dark : families[family]!.light;

  const palette: Record<string, { bg: string; surface: string; accent: string; text: string; border: string }> = {
    base: { bg: '#fafaf9', surface: '#ffffff', accent: '#5b9cf6', text: '#1a1a1a', border: '#1a1a1a' },
    dark: { bg: '#111111', surface: '#1a1a1a', accent: '#5b9cf6', text: '#e5e5e3', border: '#444440' },
    generics: { bg: '#0c0c0b', surface: '#141413', accent: '#5b9cf6', text: '#d8d5cf', border: '#272725' },
    agora: { bg: '#f7f4ed', surface: '#faf8f3', accent: '#3d8b5e', text: '#1a1a1a', border: '#1a1a1a' },
    'agora-dark': { bg: '#0d1a12', surface: '#141f17', accent: '#4aa06e', text: '#e8e8e2', border: '#3a4f40' },
  };
  return palette[id] ?? palette.base!;
}
</script>

<template>
  <div>
    <h2 class="cpub-section-title-lg">Appearance</h2>

    <p class="cpub-appearance-note">
      Your instance uses the <strong>{{ currentFamily }}</strong> theme.
      Choose your preferred color scheme.
    </p>

    <div class="cpub-scheme-grid">
      <button
        class="cpub-scheme-card"
        :class="{ active: !isDark }"
        @click="setDarkMode(false)"
      >
        <div
          class="cpub-scheme-preview"
          :style="{
            backgroundColor: previewColors(false).bg,
            borderColor: previewColors(false).border,
          }"
        >
          <div
            class="cpub-scheme-preview-card"
            :style="{
              backgroundColor: previewColors(false).surface,
              borderColor: previewColors(false).border,
              boxShadow: `3px 3px 0 ${previewColors(false).border}`,
            }"
          >
            <div class="cpub-preview-heading" :style="{ backgroundColor: previewColors(false).text, opacity: 0.8 }"></div>
            <div class="cpub-preview-line" :style="{ backgroundColor: previewColors(false).text, opacity: 0.3 }"></div>
            <div class="cpub-preview-line short" :style="{ backgroundColor: previewColors(false).text, opacity: 0.2 }"></div>
            <div class="cpub-preview-btn" :style="{ backgroundColor: previewColors(false).accent }"></div>
          </div>
        </div>
        <div class="cpub-scheme-info">
          <span class="cpub-scheme-name">Light</span>
        </div>
      </button>

      <button
        class="cpub-scheme-card"
        :class="{ active: isDark }"
        @click="setDarkMode(true)"
      >
        <div
          class="cpub-scheme-preview"
          :style="{
            backgroundColor: previewColors(true).bg,
            borderColor: previewColors(true).border,
          }"
        >
          <div
            class="cpub-scheme-preview-card"
            :style="{
              backgroundColor: previewColors(true).surface,
              borderColor: previewColors(true).border,
              boxShadow: `3px 3px 0 ${previewColors(true).border}`,
            }"
          >
            <div class="cpub-preview-heading" :style="{ backgroundColor: previewColors(true).text, opacity: 0.8 }"></div>
            <div class="cpub-preview-line" :style="{ backgroundColor: previewColors(true).text, opacity: 0.3 }"></div>
            <div class="cpub-preview-line short" :style="{ backgroundColor: previewColors(true).text, opacity: 0.2 }"></div>
            <div class="cpub-preview-btn" :style="{ backgroundColor: previewColors(true).accent }"></div>
          </div>
        </div>
        <div class="cpub-scheme-info">
          <span class="cpub-scheme-name">Dark</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.cpub-appearance-note {
  font-size: var(--text-sm);
  color: var(--text-dim);
  margin-bottom: var(--space-4);
}

.cpub-scheme-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  max-width: 440px;
}

.cpub-scheme-card {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border2);
  padding: 0;
  cursor: pointer;
  text-align: left;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

.cpub-scheme-card.active {
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.cpub-scheme-card:hover {
  border-color: var(--border);
  transform: translate(-1px, -1px);
  box-shadow: var(--shadow-sm);
}

.cpub-scheme-preview {
  height: 80px;
  padding: var(--space-3);
  border-bottom: var(--border-width-default) solid var(--border2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cpub-scheme-preview-card {
  width: 75%;
  padding: var(--space-2);
  border-width: 2px;
  border-style: solid;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cpub-preview-heading { height: 5px; width: 55%; }
.cpub-preview-line { height: 3px; width: 85%; }
.cpub-preview-line.short { width: 45%; }
.cpub-preview-btn { height: 12px; width: 35%; margin-top: 3px; }

.cpub-scheme-info {
  padding: var(--space-3);
}

.cpub-scheme-name {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
}

@media (max-width: 480px) {
  .cpub-scheme-grid { grid-template-columns: 1fr; }
}
</style>
