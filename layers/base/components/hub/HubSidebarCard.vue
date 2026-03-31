<script setup lang="ts">
defineProps<{
  title: string
}>();
</script>

<template>
  <div class="cpub-sb-card">
    <div class="cpub-sb-title">{{ title }}</div>
    <slot />
  </div>
</template>

<style scoped>
.cpub-sb-card {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 18px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 16px;
}
.cpub-sb-card:last-child { margin-bottom: 0; }

.cpub-sb-title {
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
</style>
