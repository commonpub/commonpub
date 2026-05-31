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

const props = defineProps<{
  /** Markdown source (may contain inline/block HTML — passed through). */
  source?: string | null;
}>();

const trimmed = computed(() => (props.source ?? '').trim());

const blocks = computed<BlockTuple[]>(() => {
  if (!trimmed.value) return [];
  try {
    return markdownToBlockTuples(trimmed.value);
  } catch {
    return [];
  }
});
</script>

<template>
  <BlocksBlockContentRenderer
    v-if="blocks.length"
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
