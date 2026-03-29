<script setup lang="ts">
defineProps<{
  type: string;
}>();

const iconMap: Record<string, string> = {
  project: 'fa-solid fa-microchip',
  article: 'fa-solid fa-file-lines',
  guide: 'fa-solid fa-book',
  blog: 'fa-solid fa-pen-nib',
  explainer: 'fa-solid fa-lightbulb',
};
</script>

<template>
  <span class="cpub-type-badge" :data-content-type="type">
    <i :class="iconMap[type] || 'fa-solid fa-file'" class="cpub-badge-icon"></i>
    {{ type }}
  </span>
</template>

<style scoped>
.cpub-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  border: 2px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.cpub-badge-icon {
  font-size: 9px;
}

[data-content-type="project"] {
  background: var(--accent-bg);
  color: var(--accent);
}

[data-content-type="article"] {
  background: var(--teal-bg);
  color: var(--teal);
}

[data-content-type="guide"] {
  background: var(--purple-bg);
  color: var(--purple);
}

[data-content-type="blog"] {
  background: var(--pink-bg);
  color: var(--pink);
}

[data-content-type="explainer"] {
  background: var(--yellow-bg);
  color: var(--yellow);
}
</style>
