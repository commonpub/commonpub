<script setup lang="ts">
defineProps<{
  stats: Array<{ value: string | number; label: string }>;
}>();
</script>

<template>
  <div class="cpub-stat-bar">
    <div v-for="stat in stats" :key="stat.label" class="cpub-stat-bar-item">
      <span class="cpub-stat-bar-value">{{ stat.value }}</span>
      <span class="cpub-stat-bar-label">{{ stat.label }}</span>
    </div>
  </div>
</template>
