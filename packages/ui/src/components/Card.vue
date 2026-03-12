<script setup lang="ts">
defineOptions({ name: 'CpubCard', inheritAttrs: false });

interface Props {
  hoverable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  hoverable: false,
});
</script>

<template>
  <div
    v-bind="$attrs"
    :class="['cpub-card', { 'cpub-card--hoverable': props.hoverable }]"
  >
    <slot />
  </div>
</template>

<style scoped>
.cpub-card {
  background-color: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  padding: var(--space-6);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.cpub-card--hoverable:hover {
  transform: translate(-1px, -1px);
  box-shadow: var(--shadow-lg);
}
</style>
