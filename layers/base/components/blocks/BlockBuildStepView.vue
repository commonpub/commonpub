<script setup lang="ts">
/**
 * Build step viewer — renders step header + nested children via BlockContentRenderer.
 * Migrates old flat format (instructions + image) to children on render.
 */
import type { BlockTuple } from '@commonpub/editor';

const props = defineProps<{
  content: Record<string, unknown>;
  stepNumber?: number;
}>();

const title = computed(() => (props.content.title as string) || `Step ${props.stepNumber ?? 1}`);
const time = computed(() => (props.content.time as string) || '');
const num = computed(() => props.stepNumber ?? (props.content.stepNumber as number) ?? 1);

/** Resolve children — migrate from old flat format if needed */
const children = computed<BlockTuple[]>(() => {
  if (props.content.children && Array.isArray(props.content.children) && props.content.children.length > 0) {
    return props.content.children as BlockTuple[];
  }
  // Migrate old format
  const result: BlockTuple[] = [];
  const instructions = props.content.instructions as string | undefined;
  if (instructions && instructions.trim()) {
    const html = instructions.startsWith('<') ? instructions : `<p>${instructions}</p>`;
    result.push(['paragraph', { html }]);
  }
  const image = props.content.image as string | undefined;
  if (image && image.trim()) {
    result.push(['image', { src: image, alt: `Step ${num.value}`, caption: '' }]);
  }
  return result;
});

const hasChildren = computed(() => children.value.length > 0);
</script>

<template>
  <div class="cpub-block-step">
    <div class="cpub-step-header">
      <span class="cpub-step-num">{{ num }}</span>
      <h3 class="cpub-step-title">{{ title }}</h3>
      <span v-if="time" class="cpub-step-time"><i class="fa-regular fa-clock"></i> {{ time }}</span>
    </div>
    <div v-if="hasChildren" class="cpub-step-body">
      <BlockContentRenderer :blocks="children" />
    </div>
  </div>
</template>

<style scoped>
.cpub-block-step {
  border: var(--border-width-default) solid var(--border);
  overflow: hidden;
  margin: 20px 0;
  box-shadow: var(--shadow-md);
}

.cpub-step-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--border);
  color: var(--surface);
}

.cpub-step-num {
  width: 28px;
  height: 28px;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.cpub-step-title {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
  margin: 0;
}

.cpub-step-time {
  font-family: var(--font-mono);
  font-size: 11px;
  opacity: 0.7;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.cpub-step-body {
  padding: 16px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-dim);
}
</style>
