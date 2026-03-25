<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const { themeId: theme, setTheme } = useTheme();
const themes = [
  { id: 'base', name: 'Light', desc: 'Sharp corners, offset shadows' },
  { id: 'dark', name: 'Dark', desc: 'Dark surfaces, same aesthetic' },
];
</script>

<template>
  <div>
    <h2 class="cpub-section-title-lg">Appearance</h2>

    <div class="cpub-theme-grid">
      <button
        v-for="t in themes"
        :key="t.id"
        class="cpub-theme-card"
        :class="{ active: theme === t.id }"
        @click="setTheme(t.id)"
      >
        <div class="cpub-theme-preview" :data-theme="t.id">
          <div class="cpub-theme-swatch"></div>
        </div>
        <div class="cpub-theme-info">
          <span class="cpub-theme-name">{{ t.name }}</span>
          <span class="cpub-theme-desc">{{ t.desc }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.cpub-theme-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.cpub-theme-card {
  background: var(--surface);
  border: 2px solid var(--border2);
  padding: 12px;
  cursor: pointer;
  text-align: left;
}

.cpub-theme-card.active {
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.cpub-theme-card:hover {
  border-color: var(--border);
}

.cpub-theme-preview {
  height: 60px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  margin-bottom: 8px;
}

.cpub-theme-name {
  font-size: 13px;
  font-weight: 600;
  display: block;
}

.cpub-theme-desc {
  font-size: 11px;
  color: var(--text-dim);
}
</style>
