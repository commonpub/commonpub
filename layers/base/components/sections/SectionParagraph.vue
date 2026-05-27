<script setup lang="ts">
/**
 * Built-in section: paragraph — plain prose body.
 *
 * Phase 1c starter. Stores `text: string` and splits on blank lines into
 * paragraphs at render time. The auto-form inspector (Phase 3e) will
 * upgrade this to a TipTap subset via the `.describe('rich')` Zod
 * metadata — at which point `schemaVersion` bumps to 2 with a migration
 * that converts plain text → block tuples.
 *
 * `var(--*)` only.
 */
import { computed } from 'vue';
import type { SectionRenderProps } from '@commonpub/ui';

interface ParagraphConfig extends Record<string, unknown> {
  text: string;
  align: 'left' | 'center';
}

const props = defineProps<SectionRenderProps<ParagraphConfig>>();

// Blank-line split — preserves authored paragraph breaks without needing
// a rich-text editor. Empty paragraphs are dropped (defensive).
const paragraphs = computed<string[]>(() =>
  (props.config.text ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0),
);
</script>

<template>
  <div class="cpub-section-paragraph" :data-align="config.align">
    <p v-for="(p, i) in paragraphs" :key="i">{{ p }}</p>
  </div>
</template>

<style scoped>
.cpub-section-paragraph {
  margin-block: var(--space-3);
  color: var(--text);
  font-size: var(--text-md);
  line-height: 1.7;
}
.cpub-section-paragraph[data-align='center'] {
  text-align: center;
}
.cpub-section-paragraph p {
  margin: 0 0 var(--space-3);
}
.cpub-section-paragraph p:last-child {
  margin-bottom: 0;
}
</style>
