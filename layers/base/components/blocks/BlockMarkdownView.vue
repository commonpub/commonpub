<script setup lang="ts">
import { markdownToBlockTuples } from '@commonpub/editor';
import type { BlockTuple } from '@commonpub/editor';
import { sanitizeBlockHtml } from '../../composables/useSanitize';

const props = defineProps<{
  content: { source: string };
}>();

const renderedBlocks = computed(() => {
  if (!props.content.source?.trim()) return [];
  try {
    return markdownToBlockTuples(props.content.source);
  } catch {
    return [];
  }
});

/** Type-safe block content accessors — cast content to record for dynamic key access */
function bStr(block: BlockTuple, key: string): string {
  return String((block[1] as Record<string, unknown>)[key] ?? '');
}
function bNum(block: BlockTuple, key: string): number {
  return Number((block[1] as Record<string, unknown>)[key]) || 0;
}
function bHas(block: BlockTuple, key: string): boolean {
  return !!(block[1] as Record<string, unknown>)[key];
}
</script>

<template>
  <div class="cpub-markdown-view">
    <div v-for="(block, i) in renderedBlocks" :key="i" class="cpub-md-block">
      <template v-if="block[0] === 'heading'">
        <component :is="`h${Math.min(bNum(block, 'level'), 4)}`" class="cpub-md-heading">
          {{ bStr(block, 'text') }}
        </component>
      </template>
      <template v-else-if="block[0] === 'text'">
        <div class="cpub-md-text" v-html="sanitizeBlockHtml(bStr(block, 'html'))" />
      </template>
      <template v-else-if="block[0] === 'code'">
        <pre class="cpub-md-code"><code :class="`language-${bStr(block, 'language')}`">{{ bStr(block, 'code') }}</code></pre>
      </template>
      <template v-else-if="block[0] === 'image'">
        <figure class="cpub-md-figure">
          <img :src="bStr(block, 'src')" :alt="bStr(block, 'alt')" loading="lazy" />
          <figcaption v-if="bHas(block, 'caption')">{{ bStr(block, 'caption') }}</figcaption>
        </figure>
      </template>
      <template v-else-if="block[0] === 'callout'">
        <div :class="['cpub-md-callout', `cpub-md-callout--${bStr(block, 'variant') || 'info'}`]">
          <div v-html="sanitizeBlockHtml(bStr(block, 'html'))" />
        </div>
      </template>
      <template v-else-if="block[0] === 'quote'">
        <blockquote class="cpub-md-quote" v-html="sanitizeBlockHtml(bStr(block, 'html'))" />
      </template>
      <template v-else-if="block[0] === 'divider'">
        <hr class="cpub-md-hr" />
      </template>
      <template v-else-if="bHas(block, 'html')">
        <div class="cpub-md-text" v-html="sanitizeBlockHtml(bStr(block, 'html'))" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.cpub-markdown-view {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.cpub-md-heading { margin: 20px 0 8px; }
h1.cpub-md-heading { font-size: 1.75rem; font-weight: 800; }
h2.cpub-md-heading { font-size: 1.375rem; font-weight: 700; }
h3.cpub-md-heading { font-size: 1.125rem; font-weight: 700; }
h4.cpub-md-heading { font-size: 1rem; font-weight: 600; }

.cpub-md-text { font-size: 15px; line-height: 1.75; margin-bottom: 14px; }
.cpub-md-text :deep(p) { margin-bottom: 12px; }
.cpub-md-text :deep(ul), .cpub-md-text :deep(ol) { padding-left: 24px; margin-bottom: 12px; }
.cpub-md-text :deep(li) { margin-bottom: 4px; }
.cpub-md-text :deep(a) { color: var(--accent); text-decoration: underline; }
.cpub-md-text :deep(strong) { font-weight: 600; }
.cpub-md-text :deep(code) { font-family: var(--font-mono); font-size: 0.875em; padding: 1px 4px; background: var(--surface2); border-radius: 0; }
.cpub-md-text :deep(table) { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }
.cpub-md-text :deep(th), .cpub-md-text :deep(td) { padding: 6px 10px; border: var(--border-width-default) solid var(--border); text-align: left; }
.cpub-md-text :deep(th) { background: var(--surface2); font-weight: 600; }

.cpub-md-code {
  background: var(--surface2); border: var(--border-width-default) solid var(--border); border-radius: 0;
  padding: 14px 16px; font-family: var(--font-mono); font-size: 13px;
  line-height: 1.6; overflow-x: auto; margin-bottom: 14px;
}

.cpub-md-figure { margin-bottom: 14px; }
.cpub-md-figure img { max-width: 100%; border-radius: 0; }
.cpub-md-figure figcaption { font-size: 12px; color: var(--text-dim); margin-top: 6px; text-align: center; }

.cpub-md-callout {
  padding: 12px 16px; border-radius: 0; border-left: 3px solid;
  margin-bottom: 14px; font-size: 14px; line-height: 1.6;
}
.cpub-md-callout--info { background: var(--teal-bg); border-color: var(--teal); }
.cpub-md-callout--tip { background: var(--green-bg); border-color: var(--green); }
.cpub-md-callout--warning { background: var(--yellow-bg); border-color: var(--yellow); }
.cpub-md-callout--danger { background: var(--red-bg); border-color: var(--red); }

.cpub-md-quote {
  border-left: 3px solid var(--border); padding: 8px 16px;
  color: var(--text-dim); font-style: italic; margin-bottom: 14px;
}

.cpub-md-hr { border: none; border-top: var(--border-width-default) solid var(--border); margin: 20px 0; }
</style>
