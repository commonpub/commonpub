<script setup lang="ts">
/**
 * Rules are authored as Markdown (and may contain inline HTML) — rendered the
 * same way as the contest description, so headings/lists/links/HTML all format
 * properly. Plain prose and plain one-rule-per-line text render fine through the
 * Markdown pipeline too (as paragraphs / a tight list), so there's no separate
 * "numbered list" special-case anymore (that produced the odd forced-list look).
 */
defineProps<{
  rules: string;
  /** Block-editor body (BlockTuple[]); rendered instead of `rules` when present. */
  blocks?: unknown[] | null;
  format?: 'markdown' | 'html' | null;
}>();
</script>

<template>
  <div class="cpub-rules-section">
    <div class="cpub-sec-head">
      <h2><i class="fa fa-file-lines" style="color: var(--purple);"></i> Rules</h2>
    </div>
    <div class="cpub-rules-card">
      <BlocksBlockContentRenderer
        v-if="blocks?.length"
        :blocks="(blocks as [string, Record<string, unknown>][])"
        class="cpub-prose cpub-md"
      />
      <CpubMarkdown v-else :source="rules" :format="format" />
    </div>
  </div>
</template>

<style scoped>
.cpub-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.cpub-sec-head h2 { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }

.cpub-rules-card { background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; box-shadow: var(--shadow-md); }
</style>
