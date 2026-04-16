<script setup lang="ts">
import type { HomepageSection } from '@commonpub/server';

defineProps<{
  sections: HomepageSection[];
  /** Which zone to render: 'main' for feed column, 'sidebar' for sidebar */
  zone: 'main' | 'sidebar' | 'full-width';
}>();

const features = useFeatures();

function isFeatureEnabled(featureGate?: string): boolean {
  if (!featureGate) return true;
  return (features.features as unknown as Record<string, boolean>)?.[featureGate] ?? true;
}

/** Section types that render in the full-width zone (above the 2-column layout) */
const FULL_WIDTH_TYPES = new Set(['hero']);

/** Section types that render in the sidebar */
const SIDEBAR_TYPES = new Set(['stats', 'contests', 'hubs']);

function sectionZone(section: HomepageSection): 'full-width' | 'main' | 'sidebar' {
  if (FULL_WIDTH_TYPES.has(section.type)) return 'full-width';
  if (SIDEBAR_TYPES.has(section.type)) return 'sidebar';
  return 'main';
}
</script>

<template>
  <template v-for="section in sections" :key="section.id">
    <template v-if="section.enabled && sectionZone(section) === zone && isFeatureEnabled(section.config.featureGate)">
      <HomepageHeroSection
        v-if="section.type === 'hero'"
        :config="section.config"
      />
      <HomepageEditorialSection
        v-else-if="section.type === 'editorial'"
        :config="section.config"
      />
      <HomepageContentGridSection
        v-else-if="section.type === 'content-grid'"
        :config="section.config"
        :title="section.title"
      />
      <HomepageContestsSection
        v-else-if="section.type === 'contests'"
        :config="section.config"
      />
      <HomepageHubsSection
        v-else-if="section.type === 'hubs'"
        :config="section.config"
      />
      <HomepageStatsSection
        v-else-if="section.type === 'stats'"
      />
      <HomepageCustomHtmlSection
        v-else-if="section.type === 'custom-html'"
        :config="section.config"
        :title="section.title"
      />
    </template>
  </template>
</template>
