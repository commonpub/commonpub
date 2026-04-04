<script setup lang="ts">
import { computed } from 'vue';
import { sanitizeHtml } from '../../utils/sanitize.js';

const props = defineProps<{ content: Record<string, unknown> }>();

const html = computed(() => sanitizeHtml((props.content.html as string) || (props.content.text as string) || ''));
const attribution = computed(() => (props.content.attribution as string) || '');
</script>

<template>
  <blockquote class="cpub-block-quote">
    <div class="cpub-quote-text" v-html="html" />
    <footer v-if="attribution" class="cpub-quote-attr">&mdash; {{ attribution }}</footer>
  </blockquote>
</template>

<style scoped>
.cpub-block-quote { border-left: 4px solid var(--accent); padding: 14px 20px; margin: 24px 0; background: var(--surface); }
.cpub-quote-text { font-size: 15px; font-style: italic; line-height: 1.65; color: var(--text-dim); }
.cpub-quote-text :deep(p) { margin: 0; }
.cpub-quote-attr { margin-top: 10px; font-size: 12px; font-family: var(--font-mono); color: var(--text-faint); font-style: normal; }
</style>
