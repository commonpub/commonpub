<script setup lang="ts">
/**
 * Renders a Markdown (or HTML-in-Markdown) string as formatted content, reusing
 * the SAME pipeline articles/docs use: `markdownToBlockTuples` → the block
 * content renderer. This is why a contest description like `## Mission` +
 * `- **point**` + `[link](url)` renders as real headings/lists/links instead of
 * the raw-markdown wall it used to show.
 *
 * Source is parsed once (computed) and memoised by Vue. Empty / parse-failure
 * falls back to plain text so content never disappears.
 */
import { markdownToBlockTuples } from '@commonpub/editor';
import type { BlockTuple } from '@commonpub/editor';
import { sanitizeRichHtml } from '../composables/useSanitize';

const props = defineProps<{
  /** Markdown source (may contain inline/block HTML — passed through). */
  source?: string | null;
  /**
   * Render mode. `markdown` (default) runs the Markdown pipeline; `html` renders
   * the source as the author's raw HTML through the permissive (script-free)
   * sanitizer. The HTML path is also cheaper, so large bodies render instantly
   * (no synchronous Markdown parse) on both SSR and client.
   */
  format?: 'markdown' | 'html' | null;
}>();

const trimmed = computed(() => (props.source ?? '').trim());
const isHtml = computed(() => props.format === 'html');

// neutralizeColors: drop hardcoded color literals so the themed `.cpub-md-html`
// baseline shows through (dark-mode-safe); author `var(--*)`/currentColor are kept.
const richHtml = computed(() => (isHtml.value && trimmed.value ? sanitizeRichHtml(trimmed.value, { neutralizeColors: true }) : ''));

const blocks = computed<BlockTuple[]>(() => {
  if (isHtml.value || !trimmed.value) return [];
  try {
    return markdownToBlockTuples(trimmed.value);
  } catch {
    return [];
  }
});
</script>

<template>
  <!-- eslint-disable vue/no-v-html -- author HTML, sanitized via sanitizeRichHtml (script-free allowlist) -->
  <div v-if="isHtml && richHtml" class="cpub-md cpub-md-html" v-html="richHtml" />
  <!-- eslint-enable vue/no-v-html -->
  <BlocksBlockContentRenderer
    v-else-if="blocks.length"
    :blocks="(blocks as [string, Record<string, unknown>][])"
    class="cpub-prose cpub-md"
  />
  <p v-else-if="trimmed" class="cpub-md cpub-md-plain">{{ trimmed }}</p>
</template>

<style scoped>
.cpub-md-plain {
  white-space: pre-wrap;
  line-height: 1.7;
}
</style>
