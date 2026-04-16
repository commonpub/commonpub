<script setup lang="ts">
import type { HomepageSectionConfig } from '@commonpub/server';

const props = defineProps<{
  config: HomepageSectionConfig;
  title?: string;
}>();
</script>

<template>
  <section v-if="config.html" class="cpub-custom-section">
    <h2 v-if="title" class="cpub-custom-title">{{ title }}</h2>
    <div class="cpub-custom-content" v-html="config.html" />
  </section>
</template>

<style scoped>
.cpub-custom-section { margin-bottom: 24px; }
.cpub-custom-title { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); margin-bottom: 12px; }
</style>
