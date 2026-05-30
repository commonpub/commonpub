<script setup lang="ts">
import type { ContestJudgingCriterion } from '@commonpub/server';

const props = defineProps<{
  criteria: ContestJudgingCriterion[];
  /** Render in a denser, frameless layout (used as in-page guidance). */
  compact?: boolean;
}>();

const totalWeight = computed(() =>
  props.criteria.reduce((sum, c) => sum + (c.weight ?? 0), 0),
);
const hasWeights = computed(() => props.criteria.some((c) => (c.weight ?? 0) > 0));
</script>

<template>
  <div v-if="criteria.length > 0" class="cpub-criteria-section" :class="{ 'cpub-criteria-compact': compact }">
    <div v-if="!compact" class="cpub-sec-head">
      <h2><i class="fa-solid fa-list-check" style="color: var(--teal);"></i> Judging Criteria</h2>
      <span v-if="hasWeights" class="cpub-sec-sub">{{ totalWeight }} pts total</span>
    </div>
    <div class="cpub-criteria-card">
      <div v-for="(crit, i) in criteria" :key="i" class="cpub-criterion">
        <div class="cpub-criterion-head">
          <span class="cpub-criterion-label">{{ crit.label }}</span>
          <span v-if="crit.weight != null && crit.weight > 0" class="cpub-criterion-weight">{{ crit.weight }} pts</span>
        </div>
        <p v-if="crit.description" class="cpub-criterion-desc">{{ crit.description }}</p>
        <div v-if="hasWeights && crit.weight" class="cpub-criterion-bar">
          <div class="cpub-criterion-bar-fill" :style="{ width: `${Math.min(100, (crit.weight / Math.max(totalWeight, 1)) * 100)}%` }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.cpub-sec-head h2 { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.cpub-sec-sub { font-size: 11px; color: var(--text-faint); margin-left: auto; font-family: var(--font-mono); }

.cpub-criteria-card { background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 20px; box-shadow: var(--shadow-md); display: flex; flex-direction: column; gap: 14px; }
.cpub-criteria-compact .cpub-criteria-card { box-shadow: none; border-style: dashed; margin-bottom: 0; }

.cpub-criterion-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.cpub-criterion-label { font-size: 13px; font-weight: 600; color: var(--text); }
.cpub-criterion-weight { font-size: 10px; font-family: var(--font-mono); font-weight: 700; color: var(--accent); white-space: nowrap; }
.cpub-criterion-desc { font-size: 12px; color: var(--text-dim); line-height: 1.6; margin: 4px 0 0; }
.cpub-criterion-bar { height: 4px; background: var(--surface2); border: var(--border-width-default) solid var(--border); margin-top: 8px; overflow: hidden; }
.cpub-criterion-bar-fill { height: 100%; background: var(--accent); }
</style>
