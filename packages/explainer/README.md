# @commonpub/explainer

Interactive explainer runtime and Vue 3 components. Build section-by-section explorable explanations with quizzes, interactive sliders, checkpoints, and rich content blocks.

**Two layers:**

- **`@commonpub/explainer`** — Pure TypeScript engine (types, schemas, progress tracking, quiz scoring, HTML export). Zero UI dependencies.
- **`@commonpub/explainer/vue`** — Vue 3 components (viewer, editor, block renderers, composables). Zero Nuxt dependencies. Works in any Vue 3 app.

## Install

```bash
pnpm add @commonpub/explainer vue
```

## Quick Start — Viewer

```vue
<script setup>
import { ExplainerViewer } from '@commonpub/explainer/vue';
import '@commonpub/explainer/vue/theme';

const content = {
  title: 'My Explainer',
  content: [
    ['sectionHeader', { tag: '§ 01', title: 'Introduction', body: 'Welcome.' }],
    ['text', { html: '<p>Start learning here.</p>' }],
    ['quiz', {
      question: 'What is 2 + 2?',
      options: [
        { text: '3', correct: false },
        { text: '4', correct: true },
      ],
    }],
    ['checkpoint', { label: 'Section complete' }],
  ],
  author: { displayName: 'Jane', username: 'jane' },
};
</script>

<template>
  <ExplainerViewer :content="content" />
</template>
```

## Quick Start — Editor

```vue
<script setup>
import { ExplainerEditor, useBlockEditor } from '@commonpub/explainer/vue';
import '@commonpub/explainer/vue/theme';

const blockEditor = useBlockEditor();
const metadata = ref({ slug: '', description: '', tags: [], difficulty: 'beginner' });
</script>

<template>
  <ExplainerEditor
    :block-editor="blockEditor"
    :metadata="metadata"
    @update:metadata="metadata = $event"
  />
</template>
```

## Playground

Run the development playground to see all components in action:

```bash
cd packages/explainer
pnpm playground
```

Opens at http://localhost:4200 with four tabs: Individual Blocks, Block Renderer, Editor, Full Viewer.

---

For full documentation, see:

- **[vue/README.md](vue/README.md)** — Vue component API, theming, customization, adding blocks
- **[src/README.md](src/README.md)** — TypeScript engine API, progress tracking, quiz scoring, HTML export
