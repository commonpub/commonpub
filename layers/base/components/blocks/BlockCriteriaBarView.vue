<script setup lang="ts">
/**
 * Read-only view for the `criteriaBar` block — judging criteria as one stacked
 * weighted bar + legend. Thin wrapper over the shared CpubCriteriaBar so the block,
 * the editor preview, and the public Judging Criteria section all render identically.
 */
import type { CriteriaBarItem } from '../../utils/contestBlocks';

defineProps<{
  content: { heading?: string; items?: CriteriaBarItem[]; showLegend?: boolean };
}>();
</script>

<template>
  <CpubCriteriaBar
    :items="content.items"
    :heading="content.heading"
    :show-legend="content.showLegend !== false"
    class="cpub-block-cbar"
  />
</template>

<style scoped>
.cpub-block-cbar { margin: 0 0 18px; }
</style>
