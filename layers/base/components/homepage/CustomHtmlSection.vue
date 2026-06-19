<script setup lang="ts">
import { computed } from 'vue';
import type { HomepageSectionConfig } from '@commonpub/server';
import { sanitizeRichHtml } from '../../composables/useSanitize';

const props = defineProps<{
  config: HomepageSectionConfig;
  title?: string;
}>();

// Admin-authored raw HTML renders on the PUBLIC homepage with v-html; strip
// scripts/event-handlers/javascript: before injecting (CSP allows unsafe-inline,
// so this is the only XSS barrier). (audit session 204 — P1)
const safeHtml = computed(() =>
  typeof props.config.html === 'string' ? sanitizeRichHtml(props.config.html) : '',
);
</script>

<template>
  <section v-if="safeHtml" class="cpub-custom-section">
    <h2 v-if="title" class="cpub-custom-title">{{ title }}</h2>
    <div class="cpub-custom-content" v-html="safeHtml" />
  </section>
</template>

<style scoped>
.cpub-custom-section { margin-bottom: 24px; }
.cpub-custom-title { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); margin-bottom: 12px; }
</style>
