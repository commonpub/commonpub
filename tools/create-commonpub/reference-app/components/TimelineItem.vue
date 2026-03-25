<script setup lang="ts">
defineProps<{
  role: string;
  company: string;
  period: string;
  description?: string;
  current?: boolean;
}>();
</script>

<template>
  <div class="cpub-tl-item">
    <div class="cpub-tl-dot" :class="{ active: current }"></div>
    <div class="cpub-tl-header">
      <span class="cpub-tl-role">{{ role }}</span>
      <span class="cpub-tl-period">{{ period }}</span>
    </div>
    <div class="cpub-tl-company">{{ company }}</div>
    <p v-if="description" class="cpub-tl-desc">{{ description }}</p>
  </div>
</template>

<style scoped>
.cpub-tl-item {
  position: relative;
  margin-bottom: 24px;
  padding-left: 20px;
}

.cpub-tl-item:last-child {
  margin-bottom: 0;
}

.cpub-tl-dot {
  position: absolute;
  left: 0;
  top: 4px;
  width: 7px;
  height: 7px;
  background: var(--border2);
  border: 1px solid var(--border);
}

.cpub-tl-dot.active {
  background: var(--accent);
  border-color: var(--accent);
}

.cpub-tl-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.cpub-tl-role {
  font-size: 13px;
  font-weight: 600;
}

.cpub-tl-period {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  white-space: nowrap;
  margin-top: 2px;
}

.cpub-tl-company {
  font-size: 11px;
  color: var(--accent);
  font-family: var(--font-mono);
  margin-bottom: 4px;
}

.cpub-tl-desc {
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.55;
}
</style>
