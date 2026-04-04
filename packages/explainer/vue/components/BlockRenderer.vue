<script setup lang="ts">
/**
 * BlockRenderer — renders BlockTuple[] as Vue components.
 *
 * Supports all explainer-relevant block types out of the box.
 * Extensible via the `customBlocks` prop for additional block types.
 */
import { computed, type Component } from 'vue';
import { sanitizeHtml } from '../utils/sanitize.js';
import TextBlock from './blocks/TextBlock.vue';
import HeadingBlock from './blocks/HeadingBlock.vue';
import CodeBlock from './blocks/CodeBlock.vue';
import ImageBlock from './blocks/ImageBlock.vue';
import QuoteBlock from './blocks/QuoteBlock.vue';
import CalloutBlock from './blocks/CalloutBlock.vue';
import DividerBlock from './blocks/DividerBlock.vue';
import EmbedBlock from './blocks/EmbedBlock.vue';
import QuizBlock from './blocks/QuizBlock.vue';
import SliderBlock from './blocks/SliderBlock.vue';
import CheckpointBlock from './blocks/CheckpointBlock.vue';
import SectionHeader from './blocks/SectionHeader.vue';

type BlockTuple = [string, Record<string, unknown>];

const props = defineProps<{
  blocks: BlockTuple[];
  startIndex?: number;
  endIndex?: number;
  /** Additional block type → component mappings */
  customBlocks?: Record<string, Component>;
}>();

const emit = defineEmits<{
  quizAnswered: [blockIndex: number, correct: boolean];
  checkpointReached: [blockIndex: number];
}>();

const builtinMap: Record<string, Component> = {
  text: TextBlock,
  paragraph: TextBlock,
  heading: HeadingBlock,
  code: CodeBlock,
  code_block: CodeBlock,
  codeBlock: CodeBlock,
  image: ImageBlock,
  quote: QuoteBlock,
  blockquote: QuoteBlock,
  callout: CalloutBlock,
  divider: DividerBlock,
  horizontalRule: DividerBlock,
  embed: EmbedBlock,
  quiz: QuizBlock,
  interactiveSlider: SliderBlock,
  slider: SliderBlock,
  checkpoint: CheckpointBlock,
  sectionHeader: SectionHeader,
};

const componentMap = computed(() => ({
  ...builtinMap,
  ...(props.customBlocks ?? {}),
}));

const visibleBlocks = computed(() => {
  const start = props.startIndex ?? 0;
  const end = props.endIndex ?? props.blocks.length;
  return props.blocks.slice(start, end).map((block, i) => ({
    type: block[0],
    data: block[1],
    index: start + i,
  }));
});

function resolveBlock(type: string): Component | null {
  return componentMap.value[type] ?? null;
}
</script>

<template>
  <div class="cpub-block-renderer">
    <template v-for="block in visibleBlocks" :key="block.index">
      <component
        :is="resolveBlock(block.type)!"
        v-if="resolveBlock(block.type)"
        :content="block.data"
        @answered="(correct: boolean) => emit('quizAnswered', block.index, correct)"
        @reached="() => emit('checkpointReached', block.index)"
      />
      <!-- Fallback: render sanitized HTML if present -->
      <div
        v-else-if="block.data.html"
        class="cpub-block-fallback"
        v-html="sanitizeHtml(block.data.html as string)"
      />
    </template>
  </div>
</template>

<style scoped>
.cpub-block-renderer { display: flex; flex-direction: column; gap: 0; }
.cpub-block-fallback { font-size: 15px; line-height: 1.75; color: var(--text-dim); }
.cpub-block-fallback :deep(p) { margin-bottom: 14px; }
</style>
