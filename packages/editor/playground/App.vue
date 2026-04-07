<script setup lang="ts">
import { ref, provide, watch } from 'vue';
import { useBlockEditor } from '../vue/composables/useBlockEditor';
import BlockCanvas from '../vue/components/BlockCanvas.vue';
import EditorBlocks from '../vue/components/EditorBlocks.vue';
import EditorShell from '../vue/components/EditorShell.vue';
import TextBlock from '../vue/components/blocks/TextBlock.vue';
import HeadingBlock from '../vue/components/blocks/HeadingBlock.vue';
import CodeBlock from '../vue/components/blocks/CodeBlock.vue';
import ImageBlock from '../vue/components/blocks/ImageBlock.vue';
import QuoteBlock from '../vue/components/blocks/QuoteBlock.vue';
import CalloutBlock from '../vue/components/blocks/CalloutBlock.vue';
import SliderBlock from '../vue/components/blocks/SliderBlock.vue';
import QuizBlock from '../vue/components/blocks/QuizBlock.vue';
import CheckpointBlock from '../vue/components/blocks/CheckpointBlock.vue';
import MathBlock from '../vue/components/blocks/MathBlock.vue';
import MarkdownBlock from '../vue/components/blocks/MarkdownBlock.vue';
import SectionHeaderBlock from '../vue/components/blocks/SectionHeaderBlock.vue';
import type { BlockTypeGroup, BlockGroup } from '../vue/types';
import type { BlockTuple } from '../src/index';
import { UPLOAD_HANDLER_KEY } from '../vue/provide';

const activeView = ref<'editor' | 'components' | 'data'>('editor');

// --- Provide a mock upload handler ---
provide(UPLOAD_HANDLER_KEY, async (file: File) => {
  // Simulate upload delay, return a data URL for playground
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ url: reader.result as string });
    reader.readAsDataURL(file);
  });
});

// --- Sample content ---
const sampleBlocks: BlockTuple[] = [
  ['sectionHeader', { tag: 'Getting Started', title: 'Block Editor Playground', body: 'Test all 20 block types in isolation.' }],
  ['paragraph', { html: '<p>This is a <strong>rich text</strong> paragraph with <em>italic</em>, <code>inline code</code>, and <a href="#">links</a>. Try typing <code>/</code> at the start of an empty block to open the block picker.</p>' }],
  ['heading', { text: 'Example Heading (Level 2)', level: 2 }],
  ['callout', { html: '<p>This is an <strong>info callout</strong>. Callouts support info, tip, warning, and danger variants.</p>', variant: 'info' }],
  ['code_block', { code: 'function greet(name: string): string {\n  return `Hello, ${name}!`;\n}', language: 'typescript', filename: 'greet.ts' }],
  ['blockquote', { html: '<p>The best way to predict the future is to invent it.</p>', attribution: 'Alan Kay' }],
  ['image', { src: '', alt: '', caption: '' }],
  ['horizontal_rule', {}],
  ['quiz', { question: 'What is the main purpose of a block editor?', options: [{ text: 'Structured content editing', correct: true }, { text: 'Spreadsheet calculations', correct: false }, { text: 'Email composition', correct: false }], feedback: 'Block editors let you compose content from discrete, typed blocks.' }],
  ['interactiveSlider', { label: 'Complexity', min: 1, max: 10, step: 1, defaultValue: 5, states: [{ min: 1, max: 3, state: 'low', message: 'Simple and straightforward.' }, { min: 4, max: 7, state: 'good', message: 'Moderate complexity.' }, { min: 8, max: 10, state: 'high', message: 'Highly complex system.' }] }],
  ['checkpoint', { message: 'You have explored the basic block types!' }],
];

const blockEditor = useBlockEditor(sampleBlocks);

// --- Block type groups for the picker/sidebar ---
const blockTypes: BlockTypeGroup[] = [
  {
    name: 'Text',
    blocks: [
      { type: 'paragraph', label: 'Text', icon: 'fa-paragraph', description: 'Rich text paragraph' },
      { type: 'heading', label: 'Heading', icon: 'fa-heading', description: 'Section heading' },
      { type: 'code_block', label: 'Code', icon: 'fa-code', description: 'Code with syntax highlighting' },
      { type: 'blockquote', label: 'Quote', icon: 'fa-quote-left', description: 'Block quote with attribution' },
      { type: 'callout', label: 'Callout', icon: 'fa-circle-info', description: 'Info, tip, warning, danger' },
      { type: 'markdown', label: 'Markdown', icon: 'fa-brands fa-markdown', description: 'Raw markdown editor' },
    ],
  },
  {
    name: 'Media',
    blocks: [
      { type: 'image', label: 'Image', icon: 'fa-image', description: 'Upload or paste URL' },
      { type: 'gallery', label: 'Gallery', icon: 'fa-images', description: 'Multi-image grid' },
      { type: 'video', label: 'Video', icon: 'fa-video', description: 'YouTube, Vimeo embed' },
      { type: 'embed', label: 'Embed', icon: 'fa-code', description: 'Generic iframe embed' },
    ],
  },
  {
    name: 'Structure',
    blocks: [
      { type: 'sectionHeader', label: 'Section Header', icon: 'fa-bookmark', description: 'Tag + title + body' },
      { type: 'horizontal_rule', label: 'Divider', icon: 'fa-minus', description: 'Horizontal rule' },
      { type: 'mathNotation', label: 'Math', icon: 'fa-square-root-variable', description: 'LaTeX notation' },
    ],
  },
  {
    name: 'Interactive',
    blocks: [
      { type: 'quiz', label: 'Quiz', icon: 'fa-circle-question', description: 'Multiple choice question' },
      { type: 'interactiveSlider', label: 'Slider', icon: 'fa-sliders', description: 'Interactive range slider' },
      { type: 'checkpoint', label: 'Checkpoint', icon: 'fa-flag-checkered', description: 'Progress marker' },
    ],
  },
  {
    name: 'Maker',
    blocks: [
      { type: 'partsList', label: 'Parts List', icon: 'fa-list-check', description: 'Bill of materials' },
      { type: 'buildStep', label: 'Build Step', icon: 'fa-hammer', description: 'Numbered instruction' },
      { type: 'toolList', label: 'Tool List', icon: 'fa-wrench', description: 'Required tools' },
      { type: 'downloads', label: 'Downloads', icon: 'fa-download', description: 'File download links' },
    ],
  },
];

// --- Block groups for sidebar (same data, different type) ---
const blockGroups: BlockGroup[] = blockTypes.map(g => ({
  name: g.name,
  blocks: g.blocks.map(b => ({ type: b.type, label: b.label, icon: b.icon, description: b.description })),
}));

// --- JSON output ---
const jsonOutput = ref('');
watch(() => blockEditor.blocks.value, () => {
  jsonOutput.value = JSON.stringify(blockEditor.toBlockTuples(), null, 2);
}, { immediate: true, deep: true });
</script>

<template>
  <div class="playground">
    <!-- NAV -->
    <nav class="playground-nav">
      <div class="playground-title">@commonpub/editor</div>
      <div class="playground-tabs">
        <button :class="{ active: activeView === 'editor' }" @click="activeView = 'editor'">Block Editor</button>
        <button :class="{ active: activeView === 'components' }" @click="activeView = 'components'">Components</button>
        <button :class="{ active: activeView === 'data' }" @click="activeView = 'data'">Data (JSON)</button>
      </div>
      <div class="playground-stats">
        {{ blockEditor.blocks.value.length }} blocks
      </div>
    </nav>

    <!-- FULL EDITOR -->
    <div v-if="activeView === 'editor'" class="playground-editor">
      <EditorShell :show-left-sidebar="true" :show-right-sidebar="false">
        <template #left>
          <EditorBlocks :groups="blockGroups" :block-editor="blockEditor" />
        </template>
        <BlockCanvas
          :block-editor="blockEditor"
          :block-types="blockTypes"
        />
      </EditorShell>
    </div>

    <!-- COMPONENT SHOWCASE -->
    <div v-else-if="activeView === 'components'" class="playground-content">
      <h2 class="section-label">Block Components</h2>
      <p class="playground-desc">Individual block components rendered with sample data. Each receives <code>content</code> as a prop and emits <code>update</code>.</p>

      <div class="block-showcase">
        <div class="showcase-item">
          <h3 class="section-label">Text Block</h3>
          <div class="showcase-frame">
            <TextBlock :content="{ html: '<p>Editable <strong>rich text</strong> with <em>formatting</em>.</p>' }" @update="() => {}" />
          </div>
        </div>

        <div class="showcase-item">
          <h3 class="section-label">Heading Block</h3>
          <div class="showcase-frame">
            <HeadingBlock :content="{ text: 'Section Title', level: 2 }" @update="() => {}" />
          </div>
        </div>

        <div class="showcase-item">
          <h3 class="section-label">Code Block</h3>
          <div class="showcase-frame">
            <CodeBlock :content="{ code: 'const x = 42;\nconsole.log(x);', language: 'javascript', filename: 'example.js' }" @update="() => {}" />
          </div>
        </div>

        <div class="showcase-item">
          <h3 class="section-label">Quote Block</h3>
          <div class="showcase-frame">
            <QuoteBlock :content="{ html: '<p>We shape our tools, and thereafter our tools shape us.</p>', attribution: 'Marshall McLuhan' }" @update="() => {}" />
          </div>
        </div>

        <div class="showcase-item">
          <h3 class="section-label">Callout Block (info)</h3>
          <div class="showcase-frame">
            <CalloutBlock :content="{ html: '<p>This is an informational callout.</p>', variant: 'info' }" @update="() => {}" />
          </div>
        </div>

        <div class="showcase-item">
          <h3 class="section-label">Image Block (empty — try uploading)</h3>
          <div class="showcase-frame">
            <ImageBlock :content="{ src: '', alt: '', caption: '' }" @update="() => {}" />
          </div>
        </div>

        <div class="showcase-item">
          <h3 class="section-label">Section Header Block</h3>
          <div class="showcase-frame">
            <SectionHeaderBlock :content="{ tag: 'Chapter 1', title: 'Introduction', body: 'An overview of the topic.' }" @update="() => {}" />
          </div>
        </div>

        <div class="showcase-item">
          <h3 class="section-label">Math Block</h3>
          <div class="showcase-frame">
            <MathBlock :content="{ expression: 'E = mc^2', display: true }" @update="() => {}" />
          </div>
        </div>

        <div class="showcase-item">
          <h3 class="section-label">Markdown Block</h3>
          <div class="showcase-frame">
            <MarkdownBlock :content="{ source: '# Hello\n\nThis is **markdown** with `code` and [links](https://example.com).' }" @update="() => {}" />
          </div>
        </div>

        <div class="showcase-item">
          <h3 class="section-label">Quiz Block</h3>
          <div class="showcase-frame">
            <QuizBlock :content="{
              question: 'What is a block editor?',
              options: [
                { text: 'A content editor using discrete typed blocks', correct: true },
                { text: 'A code editor for blockchain', correct: false },
                { text: 'A game level editor', correct: false },
              ],
              feedback: 'Block editors compose content from individual, typed content blocks.'
            }" @update="() => {}" />
          </div>
        </div>

        <div class="showcase-item">
          <h3 class="section-label">Slider Block</h3>
          <div class="showcase-frame">
            <SliderBlock :content="{
              label: 'Temperature', min: 0, max: 100, step: 1, defaultValue: 50,
              states: [
                { min: 0, max: 30, state: 'low', message: 'Cold zone.' },
                { min: 31, max: 70, state: 'good', message: 'Comfortable range.' },
                { min: 71, max: 100, state: 'high', message: 'Getting hot!' },
              ]
            }" @update="() => {}" />
          </div>
        </div>

        <div class="showcase-item">
          <h3 class="section-label">Checkpoint Block</h3>
          <div class="showcase-frame">
            <CheckpointBlock :content="{ message: 'You completed this section!' }" @update="() => {}" />
          </div>
        </div>
      </div>
    </div>

    <!-- JSON DATA VIEW -->
    <div v-else class="playground-content">
      <h2 class="section-label">BlockTuple[] Output</h2>
      <p class="playground-desc">Live serialization of the editor state. This is what gets persisted.</p>
      <pre class="json-output">{{ jsonOutput }}</pre>
    </div>
  </div>
</template>

<style>
/* ===== CommonPub Design Tokens (subset for playground) ===== */
:root {
  --bg: #fafaf9;
  --surface: #ffffff;
  --surface2: #f4f4f2;
  --surface3: #eaeae7;
  --text: #1a1a1a;
  --text-dim: #6b6b66;
  --text-faint: #a3a39e;
  --border: #1a1a1a;
  --border2: #d4d4d0;
  --border-width-default: 2px;
  --accent: #5b9cf6;
  --accent-bg: rgba(91, 156, 246, 0.08);
  --accent-border: rgba(91, 156, 246, 0.25);
  --red: #ef4444;
  --red-bg: rgba(239, 68, 68, 0.08);
  --red-border: rgba(239, 68, 68, 0.25);
  --green: #22c55e;
  --green-bg: rgba(34, 197, 94, 0.08);
  --yellow: #f59e0b;
  --yellow-bg: rgba(245, 158, 11, 0.08);
  --teal: #14b8a6;
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --shadow-md: 4px 4px 0 rgba(0,0,0,0.06);
  --shadow-lg: 6px 6px 0 rgba(0,0,0,0.08);
  --space-2: 8px;
  --space-4: 16px;
  --space-6: 24px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f0f12;
    --surface: #1a1a1f;
    --surface2: #222228;
    --surface3: #2a2a30;
    --text: #e8e8e4;
    --text-dim: #8a8a85;
    --text-faint: #5a5a55;
    --border: #e8e8e4;
    --border2: #333338;
    --shadow-md: 4px 4px 0 rgba(0,0,0,0.3);
    --shadow-lg: 6px 6px 0 rgba(0,0,0,0.4);
  }
}

/* ===== Playground Layout ===== */
.playground {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.playground-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  height: 48px;
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
  flex-shrink: 0;
}

.playground-title {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
}

.playground-tabs {
  display: flex;
  gap: 4px;
}

.playground-tabs button {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 500;
  background: none;
  border: var(--border-width-default) solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-family: var(--font-sans);
}

.playground-tabs button:hover {
  color: var(--text);
}

.playground-tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.playground-stats {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
}

.playground-editor {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.playground-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px;
}

.playground-desc {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 24px;
  line-height: 1.6;
}

.playground-desc code {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--surface2);
  padding: 1px 5px;
  border: 1px solid var(--border2);
}

.section-label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  margin: 24px 0 12px;
}

.block-showcase {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.showcase-item {
  border: var(--border-width-default) solid var(--border2);
  background: var(--surface);
}

.showcase-item .section-label {
  margin: 0;
  padding: 8px 12px;
  background: var(--surface2);
  border-bottom: var(--border-width-default) solid var(--border2);
}

.showcase-frame {
  padding: 16px;
}

.json-output {
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.5;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border2);
  padding: 16px;
  overflow-x: auto;
  white-space: pre;
  color: var(--text-dim);
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}
</style>
