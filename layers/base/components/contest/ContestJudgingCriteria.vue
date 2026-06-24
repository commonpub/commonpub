<script setup lang="ts">
import type { ContestJudgingCriterion } from '@commonpub/server';

const props = defineProps<{
  criteria: ContestJudgingCriterion[];
  /** Render in a denser, frameless layout (used as in-page guidance). */
  compact?: boolean;
}>();

const totalWeight = computed(() => props.criteria.reduce((sum, c) => sum + (c.weight ?? 0), 0));
const hasWeights = computed(() => props.criteria.some((c) => (c.weight ?? 0) > 0));
</script>

<template>
  <div v-if="criteria.length > 0" class="cpub-criteria-section" :class="{ 'cpub-criteria-compact': compact }">
    <div v-if="!compact" class="cpub-sec-head">
      <h2><i class="fa-solid fa-list-check" style="color: var(--teal-text);"></i> Judging Criteria</h2>
      <span v-if="hasWeights" class="cpub-sec-sub">{{ totalWeight }} pts total</span>
    </div>
    <div class="cpub-criteria-card">
      <!-- The one shared weighting visual: thin seamless bar + legend (with the
           per-criterion descriptions). -->
      <CpubCriteriaBar :items="criteria" />
    </div>
  </div>
</template>

<style scoped>
.cpub-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.cpub-sec-head h2 { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.cpub-sec-sub { font-size: 11px; color: var(--text-faint); margin-left: auto; font-family: var(--font-mono); }

.cpub-criteria-card { background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 20px; box-shadow: var(--shadow-md); }
.cpub-criteria-compact .cpub-criteria-card { box-shadow: none; border-style: dashed; margin-bottom: 0; }
</style>
