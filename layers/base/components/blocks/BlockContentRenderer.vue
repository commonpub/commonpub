<script setup lang="ts">
/**
 * BlockContentRenderer — renders BlockTuple[] as pure Vue components.
 * Replaces CpubEditor in read-only mode so interactive blocks (quiz, slider)
 * render fully instead of as TipTap placeholders.
 */
import type { Component } from 'vue';
import { sanitizeBlockHtml } from '../../composables/useSanitize';
import BlockTextView from './BlockTextView.vue';
import BlockHeadingView from './BlockHeadingView.vue';
import BlockCodeView from './BlockCodeView.vue';
import BlockImageView from './BlockImageView.vue';
import BlockQuoteView from './BlockQuoteView.vue';
import BlockCalloutView from './BlockCalloutView.vue';
import BlockDividerView from './BlockDividerView.vue';
import BlockVideoView from './BlockVideoView.vue';
import BlockEmbedView from './BlockEmbedView.vue';
import BlockPartsListView from './BlockPartsListView.vue';
import BlockBuildStepView from './BlockBuildStepView.vue';
import BlockToolListView from './BlockToolListView.vue';
import BlockDownloadsView from './BlockDownloadsView.vue';
import BlockQuizView from './BlockQuizView.vue';
import BlockSliderView from './BlockSliderView.vue';
import BlockCheckpointView from './BlockCheckpointView.vue';
import BlockMathView from './BlockMathView.vue';
import BlockGalleryView from './BlockGalleryView.vue';
import BlockSectionHeaderView from './BlockSectionHeaderView.vue';
import BlockMarkdownView from './BlockMarkdownView.vue';
import type { BlockTuple } from '@commonpub/editor';

const props = defineProps<{
  blocks: BlockTuple[];
  startIndex?: number;
  endIndex?: number;
}>();

const emit = defineEmits<{
  quizAnswered: [blockIndex: number, correct: boolean];
  checkpointReached: [blockIndex: number];
}>();

const componentMap: Record<string, unknown> = {
  text: BlockTextView,
  paragraph: BlockTextView,
  heading: BlockHeadingView,
  code: BlockCodeView,
  code_block: BlockCodeView,
  codeBlock: BlockCodeView,
  image: BlockImageView,
  quote: BlockQuoteView,
  blockquote: BlockQuoteView,
  callout: BlockCalloutView,
  divider: BlockDividerView,
  horizontalRule: BlockDividerView,
  video: BlockVideoView,
  embed: BlockEmbedView,
  partsList: BlockPartsListView,
  buildStep: BlockBuildStepView,
  toolList: BlockToolListView,
  downloads: BlockDownloadsView,
  quiz: BlockQuizView,
  interactiveSlider: BlockSliderView,
  slider: BlockSliderView,
  checkpoint: BlockCheckpointView,
  mathNotation: BlockMathView,
  math: BlockMathView,
  gallery: BlockGalleryView,
  sectionHeader: BlockSectionHeaderView,
  markdown: BlockMarkdownView,
};

const visibleBlocks = computed(() => {
  const start = props.startIndex ?? 0;
  const end = props.endIndex ?? props.blocks.length;
  return props.blocks.slice(start, end).map((block, i) => ({
    type: block[0],
    data: block[1],
    index: start + i,
  }));
});

// Track sequential build step numbers
const stepCounters = computed(() => {
  const counters: Record<number, number> = {};
  let stepNum = 0;
  const start = props.startIndex ?? 0;
  const end = props.endIndex ?? props.blocks.length;
  for (let i = start; i < end; i++) {
    if (props.blocks[i]![0] === 'buildStep') {
      stepNum++;
      counters[i] = stepNum;
    }
  }
  return counters;
});

function resolveComponent(type: string): unknown {
  return componentMap[type] ?? null;
}

function onQuizAnswered(blockIndex: number, correct: boolean): void {
  emit('quizAnswered', blockIndex, correct);
}

function onCheckpointReached(blockIndex: number): void {
  emit('checkpointReached', blockIndex);
}
</script>

<template>
  <div class="cpub-block-renderer">
    <template v-for="block in visibleBlocks" :key="block.index">
      <component
        :is="(resolveComponent(block.type) as Component)"
        v-if="resolveComponent(block.type)"
        :content="block.data"
        :step-number="block.type === 'buildStep' ? stepCounters[block.index] : undefined"
        @answered="(correct: boolean) => onQuizAnswered(block.index, correct)"
        @reached="() => onCheckpointReached(block.index)"
      />
      <!-- Fallback for unknown block types: render as text if html present -->
      <div v-else-if="'html' in block.data && (block.data as Record<string, unknown>).html" class="cpub-block-fallback" v-html="sanitizeBlockHtml((block.data as Record<string, unknown>).html as string)" />
    </template>
  </div>
</template>

<style scoped>
.cpub-block-renderer {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.cpub-block-fallback {
  font-size: 15px;
  line-height: 1.75;
  color: var(--text-dim);
}

.cpub-block-fallback :deep(p) {
  margin-bottom: 14px;
}
</style>
