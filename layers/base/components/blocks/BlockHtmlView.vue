<script setup lang="ts">
/**
 * Read-only view for the `html` block — author-supplied raw HTML rendered through
 * the rich-HTML sanitizer (allowlist; scripts, event handlers, and unsafe URLs are
 * stripped) with color neutralization so a pasted light-mode snippet stays readable
 * in dark mode. Same security + theming path as the contest "Full HTML" fields and
 * CustomHtmlSection; replaces the renderer's anonymous `content.html` fallback for
 * this block type.
 */
import { sanitizeRichHtml } from '../../composables/useSanitize';

const props = defineProps<{ content: { html?: string } }>();

const safeHtml = computed(() =>
  typeof props.content.html === 'string' ? sanitizeRichHtml(props.content.html, { neutralizeColors: true }) : '',
);
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html — sanitizeRichHtml is the XSS barrier -->
  <div v-if="safeHtml" class="cpub-md-html cpub-block-html" v-html="safeHtml" />
</template>

<style scoped>
.cpub-block-html { margin: 0 0 14px; font-size: 15px; line-height: 1.7; }
</style>
