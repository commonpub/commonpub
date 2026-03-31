<script setup lang="ts">
import { sanitizeBlockHtml } from '../../composables/useSanitize';

const props = defineProps<{ content: Record<string, unknown> }>();
const html = computed(() => sanitizeBlockHtml((props.content.html as string) || ''));
</script>

<template>
  <div class="cpub-block-text" v-html="html" />
</template>

<style scoped>
.cpub-block-text {
  font-size: 15px;
  line-height: 1.75;
  color: var(--text-dim);
}

.cpub-block-text :deep(p) { margin-bottom: 14px; }
.cpub-block-text :deep(p:last-child) { margin-bottom: 0; }
.cpub-block-text :deep(strong) { color: var(--text); font-weight: 600; }
.cpub-block-text :deep(em) { font-style: italic; }
.cpub-block-text :deep(a) { color: var(--accent); text-decoration: none; }
.cpub-block-text :deep(a:hover) { text-decoration: underline; }
.cpub-block-text :deep(code) {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--teal);
  background: var(--surface2);
  border: 2px solid var(--border);
  padding: 1px 6px;
}
.cpub-block-text :deep(ul),
.cpub-block-text :deep(ol) {
  margin: 0 0 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cpub-block-text :deep(li) { color: var(--text-dim); }
</style>
