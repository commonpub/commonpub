<script setup lang="ts">
defineOptions({ name: 'VisuallyHidden' });
</script>

<template>
  <span class="cpub-visually-hidden">
    <slot />
  </span>
</template>

<style scoped>
.cpub-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
