<script setup lang="ts">
defineProps<{
  name: string;
  percentage: number;
  color?: string;
}>();
</script>

<template>
  <div class="cpub-skill-row">
    <span class="cpub-skill-name">{{ name }}</span>
    <div class="cpub-skill-bar">
      <div
        class="cpub-skill-fill"
        :style="{ width: percentage + '%', background: color || 'var(--accent)' }"
      ></div>
    </div>
    <span class="cpub-skill-pct">{{ percentage }}%</span>
  </div>
</template>

<style scoped>
.cpub-skill-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.cpub-skill-name {
  font-size: 11px;
  color: var(--text-dim);
  width: 130px;
  flex-shrink: 0;
  font-family: var(--font-mono);
}

.cpub-skill-bar {
  flex: 1;
  height: 4px;
  background: var(--surface3);
  overflow: hidden;
  border: 1px solid var(--border2);
}

.cpub-skill-fill {
  height: 100%;
}

.cpub-skill-pct {
  font-size: 9px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  width: 28px;
  text-align: right;
}
</style>
