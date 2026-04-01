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
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  background: var(--color-badge-overlay, rgba(0, 0, 0, 0.75));
  color: var(--badge-color, #fff);
  backdrop-filter: blur(4px);
}

.cpub-badge-icon {
  font-size: 9px;
}

[data-content-type="project"] { color: var(--badge-color-project, #93c5fd); }
[data-content-type="article"] { color: var(--badge-color-article, #5eead4); }
[data-content-type="blog"] { color: var(--badge-color-blog, #86efac); }
[data-content-type="explainer"] { color: var(--badge-color-explainer, #fde68a); }
</style>
