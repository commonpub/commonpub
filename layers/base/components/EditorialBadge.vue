<script setup lang="ts">
defineProps<{
  note?: string | null;
}>();
</script>

<template>
  <span class="cpub-cc-badge cpub-cc-badge--editorial" :title="note || 'Staff Pick'">
    <i class="fa-solid fa-pen-fancy"></i> Staff Pick
  </span>
</template>

<style scoped>
.cpub-cc-badge--editorial {
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
  color: var(--teal);
  backdrop-filter: blur(4px);
}
</style>
