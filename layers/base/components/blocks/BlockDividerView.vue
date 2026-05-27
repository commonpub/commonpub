<script setup lang="ts">
/**
 * Divider block — `<hr>` with optional variant + vertical-spacing.
 *
 * Existing in-article use (BlockContentRenderer) passes nothing → keeps
 * the default solid line with the stock 36px margin (preserved exactly
 * via the `data-spacing-y='md'` rule below).
 *
 * Layout-engine use (Stage E.1) passes
 * `content: { variant: 'solid'|'dashed'|'dotted'|'accent',
 *             spacingY: 'sm'|'md'|'lg'|'xl' }`
 * to customise. Variants applied via data-attrs (`var(--*)` only).
 */
import { computed } from 'vue';

const props = defineProps<{
  content?: Record<string, unknown>;
}>();

const variant = computed(() => {
  const v = props.content?.variant;
  return v === 'dashed' || v === 'dotted' || v === 'accent' ? v : 'solid';
});

const spacingY = computed(() => {
  const s = props.content?.spacingY;
  return s === 'sm' || s === 'lg' || s === 'xl' ? s : 'md';
});
</script>

<template>
  <hr
    class="cpub-block-divider"
    :data-variant="variant"
    :data-spacing-y="spacingY"
  />
</template>

<style scoped>
.cpub-block-divider {
  border: none;
  border-top: var(--border-width-default) solid var(--border);
  margin: 36px 0;  /* default — preserved for existing block callers */
}

/* variants */
.cpub-block-divider[data-variant='dashed'] { border-top-style: dashed; }
.cpub-block-divider[data-variant='dotted'] { border-top-style: dotted; }
.cpub-block-divider[data-variant='accent'] {
  border-top-color: var(--accent);
  border-top-width: 2px;
}

/* vertical spacing — explicit overrides for layout-engine sections.
   `md` keeps the legacy 36px margin so existing block callers (passing
   no content prop, defaulting to 'md') see no visual change. */
.cpub-block-divider[data-spacing-y='sm'] { margin: 16px 0; }
.cpub-block-divider[data-spacing-y='md'] { margin: 36px 0; }
.cpub-block-divider[data-spacing-y='lg'] { margin: 64px 0; }
.cpub-block-divider[data-spacing-y='xl'] { margin: 96px 0; }
</style>
