<script setup lang="ts">
const props = defineProps<{
  name: string;
  slug: string;
  color?: string | null;
  icon?: string | null;
}>();

const badgeColor = computed(() => props.color || 'var(--text-dim)');
</script>

<template>
  <span class="cpub-category-badge" :style="{ '--cat-color': badgeColor }">
    <i v-if="icon" :class="icon" class="cpub-category-badge-icon"></i>
    {{ name }}
  </span>
</template>

<style scoped>
.cpub-category-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 7px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-badge-overlay, rgba(0, 0, 0, 0.75));
  color: var(--cat-color, var(--text-dim));
  backdrop-filter: blur(4px);
}

.cpub-category-badge-icon {
  font-size: 8px;
}
</style>
