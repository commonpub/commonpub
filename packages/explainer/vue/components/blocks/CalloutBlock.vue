<script setup lang="ts">
import { computed } from 'vue';
import { sanitizeHtml } from '../../utils/sanitize.js';

const props = defineProps<{ content: Record<string, unknown> }>();

const html = computed(() => sanitizeHtml((props.content.html as string) || ''));
const variant = computed(() => (props.content.variant as string) || 'info');

const variantConfig: Record<string, { symbol: string; label: string }> = {
  info: { symbol: '\u24D8', label: 'Info' },
  tip: { symbol: '\u2728', label: 'Tip' },
  warning: { symbol: '\u26A0', label: 'Warning' },
  danger: { symbol: '\u26D4', label: 'Danger' },
};

const config = computed(() => variantConfig[variant.value] ?? variantConfig.info!);
</script>

<template>
  <div class="cpub-block-callout" :class="`cpub-callout--${variant}`">
    <div class="cpub-callout-icon">{{ config.symbol }}</div>
    <div class="cpub-callout-body">
      <div class="cpub-callout-label">{{ config.label }}</div>
      <div class="cpub-callout-text" v-html="html" />
    </div>
  </div>
</template>

<style scoped>
.cpub-block-callout { display: flex; gap: 12px; padding: 16px 18px; margin: 20px 0; border: var(--border-width-default) solid var(--border); border-left-width: 5px; box-shadow: var(--shadow-md); }
.cpub-callout--info { border-left-color: var(--accent); background: var(--accent-bg); }
.cpub-callout--tip { border-left-color: var(--green); background: var(--green-bg); }
.cpub-callout--warning { border-left-color: var(--yellow); background: var(--yellow-bg); }
.cpub-callout--danger { border-left-color: var(--red); background: var(--red-bg); }
.cpub-callout-icon { font-size: 14px; margin-top: 2px; flex-shrink: 0; }
.cpub-callout--info .cpub-callout-icon { color: var(--accent); }
.cpub-callout--tip .cpub-callout-icon { color: var(--green); }
.cpub-callout--warning .cpub-callout-icon { color: var(--yellow); }
.cpub-callout--danger .cpub-callout-icon { color: var(--red); }
.cpub-callout-body { flex: 1; min-width: 0; }
.cpub-callout-label { font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
.cpub-callout--info .cpub-callout-label { color: var(--accent); }
.cpub-callout--tip .cpub-callout-label { color: var(--green); }
.cpub-callout--warning .cpub-callout-label { color: var(--yellow); }
.cpub-callout--danger .cpub-callout-label { color: var(--red); }
.cpub-callout-text { font-size: 14px; line-height: 1.65; color: var(--text-dim); }
.cpub-callout-text :deep(strong) { color: var(--text); }
.cpub-callout-text :deep(p) { margin: 0; }
</style>
