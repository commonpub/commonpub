<script setup lang="ts">
/**
 * Built-in section: divider — a horizontal rule.
 *
 * Phase 1 proof-of-life — the simplest possible section, validating that:
 *   - `SectionRegistry.register()` accepts a Vue component
 *   - `<LayoutSlot>` resolves the section type slug to a renderer
 *   - The renderer receives `config` + `meta` and produces DOM
 *
 * Phase 1c adds the real catalogue (hero / heading / paragraph / image /
 * content-feed). Until then, dropping a divider into a layout is the
 * end-to-end smoke test of the layout engine.
 *
 * Uses `var(--*)` only (rule #3); inherits all colors / spacing from
 * the active theme.
 */
import type { SectionRenderProps } from '@commonpub/ui';

interface DividerConfig extends Record<string, unknown> {
  variant: 'solid' | 'dashed' | 'dotted' | 'accent';
  spacingY: 'sm' | 'md' | 'lg' | 'xl';
}

defineProps<SectionRenderProps<DividerConfig>>();
</script>

<template>
  <hr
    class="cpub-section-divider"
    :data-variant="config.variant"
    :data-spacing-y="config.spacingY"
    :aria-label="`section ${meta.sectionId}`"
  />
</template>

<style scoped>
.cpub-section-divider {
  margin-block: var(--space-4);
  border: 0;
  border-top: var(--border-width-default) solid var(--border2);
  width: 100%;
}

.cpub-section-divider[data-variant='dashed'] { border-top-style: dashed; }
.cpub-section-divider[data-variant='dotted'] { border-top-style: dotted; }
.cpub-section-divider[data-variant='accent']  {
  border-top-color: var(--accent);
  border-top-width: var(--border-width-thick);
}

.cpub-section-divider[data-spacing-y='sm']  { margin-block: var(--space-2); }
.cpub-section-divider[data-spacing-y='md']  { margin-block: var(--space-4); }
.cpub-section-divider[data-spacing-y='lg']  { margin-block: var(--space-6); }
.cpub-section-divider[data-spacing-y='xl']  { margin-block: var(--space-8); }
</style>
