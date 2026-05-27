<script setup lang="ts">
/**
 * Built-in section: heading — a single configurable heading (h1–h4)
 * with optional eyebrow + subline.
 *
 * Phase 1c starter. Semantic level is admin-chosen — the auto-form
 * inspector (Phase 3e) will warn on multiple h1s per layout.
 *
 * `var(--*)` only.
 */
import { computed } from 'vue';
import type { SectionRenderProps } from '@commonpub/ui';

interface HeadingConfig extends Record<string, unknown> {
  text: string;
  level: 1 | 2 | 3 | 4;
  align: 'left' | 'center';
  eyebrow: string;
  subline: string;
}

const props = defineProps<SectionRenderProps<HeadingConfig>>();

// Vue's <component :is> with a tag string handles the level swap without
// needing a v-if chain. Defensive clamp: an out-of-range level (shouldn't
// happen — Zod gates it on write) falls back to h2.
const headingTag = computed(() => {
  const n = props.config.level;
  return n >= 1 && n <= 4 ? `h${n}` : 'h2';
});
</script>

<template>
  <section
    class="cpub-section-heading"
    :data-align="config.align"
    :aria-labelledby="`section-heading-${meta.sectionId}`"
  >
    <p v-if="config.eyebrow" class="cpub-section-heading-eyebrow">{{ config.eyebrow }}</p>
    <component
      :is="headingTag"
      :id="`section-heading-${meta.sectionId}`"
      class="cpub-section-heading-text"
    >
      {{ config.text }}
    </component>
    <p v-if="config.subline" class="cpub-section-heading-subline">{{ config.subline }}</p>
  </section>
</template>

<style scoped>
.cpub-section-heading {
  margin-block: var(--space-4);
}
.cpub-section-heading[data-align='center'] {
  text-align: center;
}
.cpub-section-heading-eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin: 0 0 var(--space-2);
}
.cpub-section-heading-text {
  margin: 0;
  font-weight: 700;
  line-height: 1.25;
  color: var(--text);
}
.cpub-section-heading-subline {
  margin: var(--space-2) 0 0;
  color: var(--text-dim);
  font-size: var(--text-md);
  line-height: 1.6;
}
</style>
