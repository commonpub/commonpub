<script setup lang="ts">
defineProps<{
  progress: number;
}>();
</script>

<template>
  <div class="cpub-explainer-progress" aria-hidden="true">
    <div class="cpub-explainer-progress-fill" :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }" />
  </div>
</template>

<style scoped>
.cpub-explainer-progress {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  z-index: 2000;
  pointer-events: none;
}

.cpub-explainer-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.15s ease-out;
  will-change: width;
}
</style>
