<script setup lang="ts">
const props = defineProps<{
  data?: Record<string, number>;
  weeks?: number;
}>();

const weekCount = props.weeks ?? 26;
const days = 7;

function getLevel(date: string): number {
  const count = props.data?.[date] ?? 0;
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

function getDateStr(weekIdx: number, dayIdx: number): string {
  const today = new Date();
  const totalDays = weekCount * 7;
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - totalDays + (weekIdx * 7) + dayIdx);
  return startDate.toISOString().slice(0, 10);
}
</script>

<template>
  <div class="cpub-heatmap" role="img" aria-label="Contribution heatmap">
    <div class="cpub-heatmap-grid">
      <div v-for="w in weekCount" :key="w" class="cpub-heatmap-col">
        <div
          v-for="d in days"
          :key="d"
          class="cpub-heatmap-cell"
          :data-level="getLevel(getDateStr(w - 1, d - 1))"
          :title="getDateStr(w - 1, d - 1)"
        ></div>
      </div>
    </div>
    <div class="cpub-heatmap-legend">
      <span class="cpub-heatmap-legend-label">Less</span>
      <div class="cpub-heatmap-cell" data-level="0"></div>
      <div class="cpub-heatmap-cell" data-level="1"></div>
      <div class="cpub-heatmap-cell" data-level="2"></div>
      <div class="cpub-heatmap-cell" data-level="3"></div>
      <div class="cpub-heatmap-cell" data-level="4"></div>
      <span class="cpub-heatmap-legend-label">More</span>
    </div>
  </div>
</template>

<style scoped>
.cpub-heatmap-grid {
  display: flex;
  gap: 2px;
  overflow-x: auto;
}

.cpub-heatmap-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cpub-heatmap-cell {
  width: 10px;
  height: 10px;
  border: 1px solid var(--border2);
}

.cpub-heatmap-cell[data-level="0"] { background: var(--surface2); }
.cpub-heatmap-cell[data-level="1"] { background: rgba(91, 156, 246, 0.2); border-color: rgba(91, 156, 246, 0.3); }
.cpub-heatmap-cell[data-level="2"] { background: rgba(91, 156, 246, 0.4); border-color: rgba(91, 156, 246, 0.5); }
.cpub-heatmap-cell[data-level="3"] { background: rgba(91, 156, 246, 0.6); border-color: rgba(91, 156, 246, 0.7); }
.cpub-heatmap-cell[data-level="4"] { background: var(--accent); border-color: var(--accent); }

.cpub-heatmap-legend {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 8px;
  justify-content: flex-end;
}

.cpub-heatmap-legend-label {
  font-size: 9px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  margin: 0 4px;
}
</style>
