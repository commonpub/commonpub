<script setup lang="ts">
import { ref } from 'vue';
import QuizBlock from '../vue/components/blocks/QuizBlock.vue';
import SliderBlock from '../vue/components/blocks/SliderBlock.vue';
import CheckpointBlock from '../vue/components/blocks/CheckpointBlock.vue';
import SectionHeader from '../vue/components/blocks/SectionHeader.vue';
import TextBlock from '../vue/components/blocks/TextBlock.vue';
import HeadingBlock from '../vue/components/blocks/HeadingBlock.vue';
import CodeBlock from '../vue/components/blocks/CodeBlock.vue';
import ImageBlock from '../vue/components/blocks/ImageBlock.vue';
import CalloutBlock from '../vue/components/blocks/CalloutBlock.vue';
import QuoteBlock from '../vue/components/blocks/QuoteBlock.vue';
import DividerBlock from '../vue/components/blocks/DividerBlock.vue';
import BlockRenderer from '../vue/components/BlockRenderer.vue';
import ExplainerViewer from '../vue/components/ExplainerViewer.vue';
import ExplainerEditor from '../vue/components/ExplainerEditor.vue';
import { useBlockEditor } from '../vue/composables/useBlockEditor';

type BlockTuple = [string, Record<string, unknown>];

const activeView = ref<'blocks' | 'renderer' | 'viewer' | 'editor'>('blocks');

// Editor state
const editorBlocks = useBlockEditor([
  ['sectionHeader', { tag: '§ 01', title: 'Getting Started', body: 'Introduction to the topic.' }],
  ['text', { html: '<p>Start writing your explainer content here.</p>' }],
  ['interactiveSlider', { label: 'Example Slider', min: 0, max: 100, step: 1, unit: '%', defaultValue: 50, feedback: [{ min: 0, max: 40, state: 'low', message: 'Too low!' }, { min: 40, max: 70, state: 'good', message: 'Just right.' }, { min: 70, max: 100, state: 'high', message: 'Too high!' }] }],
]);
const editorMetadata = ref({
  slug: 'my-explainer',
  description: 'A sample explainer for the playground',
  tags: ['demo', 'tutorial'],
  difficulty: 'beginner',
  estimatedMinutes: 10,
  coverImageUrl: '',
});

// Sample data for the full viewer
const sampleContent = {
  title: 'Understanding Neural Networks',
  description: 'An interactive guide to how artificial neurons learn',
  coverImageUrl: 'https://picsum.photos/1200/400',
  content: [
    ['sectionHeader', { tag: '§ 01', title: 'The Biological Inspiration', body: 'How real neurons inspired artificial ones.' }],
    ['text', { html: '<p>The human brain contains roughly <strong>86 billion neurons</strong>, each connected to thousands of others. These biological networks process information through electrical and chemical signals.</p>' }],
    ['text', { html: '<p>Artificial neural networks are a simplified mathematical model of this process. Each artificial neuron receives inputs, applies weights, and produces an output.</p>' }],
    ['callout', { variant: 'info', html: '<p>Neural networks were first proposed in 1943 by Warren McCulloch and Walter Pitts.</p>' }],
    ['checkpoint', { label: 'You understand the biological inspiration' }],

    ['sectionHeader', { tag: '§ 02', title: 'Weights and Biases', body: 'The parameters that make learning possible.' }],
    ['text', { html: '<p>Every connection between neurons has a <strong>weight</strong> — a number that determines how much influence one neuron has on another.</p>' }],
    ['interactiveSlider', {
      label: 'Weight Value',
      min: -2, max: 2, step: 0.1, unit: '', defaultValue: 0.5,
      feedback: [
        { min: -2, max: -0.5, state: 'low', message: 'Negative weights inhibit the signal.' },
        { min: -0.5, max: 0.5, state: 'ok', message: 'Near-zero weights = little influence.' },
        { min: 0.5, max: 2, state: 'good', message: 'Strong positive weight — activates the neuron.' },
      ],
    }],

    ['sectionHeader', { tag: '§ 03', title: 'Activation Functions', body: 'Adding non-linearity to the model.' }],
    ['text', { html: '<p>Without activation functions, a neural network is just a linear transformation. Activation functions introduce <em>non-linearity</em>.</p>' }],
    ['code', { language: 'python', code: 'import numpy as np\n\ndef relu(x):\n    return np.maximum(0, x)\n\ndef sigmoid(x):\n    return 1 / (1 + np.exp(-x))' }],
    ['quiz', {
      question: 'Why are activation functions necessary?',
      options: [
        { text: 'To speed up training', correct: false },
        { text: 'To introduce non-linearity', correct: true },
        { text: 'To reduce parameters', correct: false },
      ],
    }],
    ['checkpoint', { label: 'You understand neural network building blocks' }],
  ] as BlockTuple[],
  author: { displayName: 'Dr. Ada Network', username: 'adanet', avatarUrl: null },
  publishedAt: '2026-03-15T10:00:00Z',
  createdAt: '2026-03-10T08:00:00Z',
};

// Sample blocks for the renderer demo
const rendererBlocks: BlockTuple[] = [
  ['sectionHeader', { tag: '§ 01', title: 'Binary Search', body: 'A fundamental algorithm.' }],
  ['text', { html: '<p>Binary search finds a target in a <strong>sorted array</strong> by dividing the search space in half each step.</p>' }],
  ['interactiveSlider', {
    label: 'Array Size', min: 10, max: 1000000, step: 10, unit: ' elements', defaultValue: 1000,
    feedback: [
      { min: 10, max: 100, state: 'low', message: 'Linear search is fine here.' },
      { min: 100, max: 10000, state: 'good', message: 'Binary search is ~10x faster.' },
      { min: 10000, max: 1000000, state: 'ok', message: 'Binary: ~20 steps. Linear: up to 1M.' },
    ],
  }],
  ['quiz', {
    question: 'How many comparisons for 1,024 elements?',
    options: [
      { text: '10', correct: true },
      { text: '512', correct: false },
      { text: '1024', correct: false },
    ],
  }],
  ['checkpoint', { label: 'You understand binary search' }],
];
</script>

<template>
  <div class="playground">
    <!-- NAV -->
    <nav class="playground-nav">
      <div class="playground-title">@commonpub/explainer</div>
      <div class="playground-tabs">
        <button :class="{ active: activeView === 'blocks' }" @click="activeView = 'blocks'">Individual Blocks</button>
        <button :class="{ active: activeView === 'renderer' }" @click="activeView = 'renderer'">Block Renderer</button>
        <button :class="{ active: activeView === 'editor' }" @click="activeView = 'editor'">Editor</button>
        <button :class="{ active: activeView === 'viewer' }" @click="activeView = 'viewer'">Full Viewer</button>
      </div>
    </nav>

    <!-- INDIVIDUAL BLOCKS -->
    <div v-if="activeView === 'blocks'" class="playground-content">
      <div class="block-section">
        <h2 class="section-label">Section Header</h2>
        <SectionHeader :content="{ tag: '§ 01', title: 'Understanding Transformers', body: 'In this section, we explore the architecture behind modern language models.' }" />
      </div>

      <div class="block-section">
        <h2 class="section-label">Text Block</h2>
        <TextBlock :content="{ html: '<p>This is a paragraph with <strong>bold</strong>, <em>italic</em>, and <code>inline code</code>. It supports <a href=\'#\'>links</a>.</p><p>And multiple paragraphs.</p>' }" />
      </div>

      <div class="block-section">
        <h2 class="section-label">Headings</h2>
        <HeadingBlock :content="{ level: 2, text: 'H2 Heading' }" />
        <HeadingBlock :content="{ level: 3, text: 'H3 Heading' }" />
      </div>

      <div class="block-section">
        <h2 class="section-label">Code Block</h2>
        <CodeBlock :content="{ language: 'typescript', filename: 'example.ts', code: 'function fibonacci(n: number): number {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}' }" />
      </div>

      <div class="block-section">
        <h2 class="section-label">Callout Variants</h2>
        <CalloutBlock :content="{ variant: 'info', html: '<p>Informational note.</p>' }" />
        <CalloutBlock :content="{ variant: 'tip', html: '<p>Helpful tip!</p>' }" />
        <CalloutBlock :content="{ variant: 'warning', html: '<p>Be careful here.</p>' }" />
        <CalloutBlock :content="{ variant: 'danger', html: '<p>This is dangerous.</p>' }" />
      </div>

      <div class="block-section">
        <h2 class="section-label">Quote Block</h2>
        <QuoteBlock :content="{ html: '<p>The best way to predict the future is to invent it.</p>', attribution: 'Alan Kay' }" />
      </div>

      <div class="block-section">
        <h2 class="section-label">Interactive Slider</h2>
        <SliderBlock :content="{
          label: 'CPU Clock Speed', min: 1, max: 5, step: 0.1, unit: ' GHz', defaultValue: 2.5,
          feedback: [
            { min: 1, max: 2, state: 'low', message: 'Below 2 GHz — sluggish.' },
            { min: 2, max: 3.5, state: 'good', message: 'Sweet spot for most tasks.' },
            { min: 3.5, max: 5, state: 'high', message: 'High perf, watch for throttling.' },
          ],
        }" />
      </div>

      <div class="block-section">
        <h2 class="section-label">Quiz Block</h2>
        <QuizBlock :content="{
          question: 'What is the time complexity of binary search?',
          options: [
            { text: 'O(n)', correct: false },
            { text: 'O(log n)', correct: true },
            { text: 'O(n²)', correct: false },
            { text: 'O(1)', correct: false },
          ],
        }" @answered="(c) => console.log('Quiz:', c)" />
      </div>

      <div class="block-section">
        <h2 class="section-label">Checkpoint Block</h2>
        <CheckpointBlock :content="{ label: 'You understand the basics' }" @reached="() => console.log('Checkpoint!')" />
      </div>

      <div class="block-section">
        <h2 class="section-label">Divider</h2>
        <p style="color: var(--text-dim);">Above</p>
        <DividerBlock :content="{}" />
        <p style="color: var(--text-dim);">Below</p>
      </div>
    </div>

    <!-- BLOCK RENDERER -->
    <div v-else-if="activeView === 'renderer'" class="playground-content">
      <h2 class="section-label">Block Renderer — Mixed Content</h2>
      <BlockRenderer
        :blocks="rendererBlocks"
        @quiz-answered="(idx, c) => console.log('Quiz at', idx, c)"
        @checkpoint-reached="(idx) => console.log('Checkpoint at', idx)"
      />
    </div>

    <!-- EDITOR -->
    <div v-else-if="activeView === 'editor'" class="playground-editor">
      <ExplainerEditor
        :block-editor="editorBlocks"
        :metadata="editorMetadata"
        @update:metadata="editorMetadata = $event"
      />
    </div>

    <!-- FULL VIEWER -->
    <div v-else class="playground-viewer">
      <ExplainerViewer :content="sampleContent" />
    </div>
  </div>
</template>

<style>
.playground {
  font-family: var(--font-sans);
  color: var(--text);
  background: var(--bg);
  min-height: 100vh;
}

.playground-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
  position: sticky;
  top: 0;
  z-index: 300;
}

.playground-title {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
}

.playground-tabs {
  display: flex;
  gap: 0;
}

.playground-tabs button {
  padding: 6px 14px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-left-width: 0;
  color: var(--text-dim);
  cursor: pointer;
}

.playground-tabs button:first-child { border-left-width: 2px; }
.playground-tabs button.active { background: var(--accent); color: var(--color-text-inverse); }
.playground-tabs button:hover:not(.active) { background: var(--surface2); }

.playground-content {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px 80px;
}

.playground-viewer {
  /* Full-width for the viewer */
}

.playground-editor {
  display: flex;
  flex: 1;
  height: calc(100vh - 46px);
  overflow: hidden;
}

.block-section {
  margin-bottom: 48px;
}

.section-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border2);
}
</style>
