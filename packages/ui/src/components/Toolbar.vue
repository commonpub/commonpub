<script setup lang="ts">
defineOptions({ name: 'CpubToolbar' });
</script>

<template>
  <div
    v-bind="$attrs"
    class="cpub-toolbar"
    role="toolbar"
    aria-label="Toolbar"
  >
    <slot />
  </div>
</template>

<style scoped>
.cpub-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background-color: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
}
</style>
