# @commonpub/explainer — Vue Components

Standalone Vue 3 components for rendering and editing interactive explainers. Zero Nuxt dependencies — works in any Vue 3 application.

## Setup

```bash
pnpm add @commonpub/explainer vue
```

Import the theme CSS in your app entry point:

```ts
import '@commonpub/explainer/vue/theme';
```

Or define your own CSS custom properties (see [Theming](#theming)).

## Components

### ExplainerViewer

Full-screen, section-by-section viewer with TOC sidebar, progress bar, and keyboard navigation.

```vue
<script setup>
import { ExplainerViewer } from '@commonpub/explainer/vue';

const content = {
  title: 'My Explainer',
  description: 'Optional subtitle',
  coverImageUrl: 'https://example.com/cover.jpg',  // optional
  content: [/* BlockTuple[] */],
  author: {                                          // optional
    displayName: 'Name',
    username: 'handle',
    avatarUrl: null,
  },
  publishedAt: '2026-01-01T00:00:00Z',             // optional
};
</script>

<template>
  <ExplainerViewer
    :content="content"
    :show-engagement="false"
    :on-edit="() => router.push('/edit')"
  />
</template>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `ExplainerContent` | required | Explainer data (title, blocks, author, etc.) |
| `showEngagement` | `boolean` | `false` | Show like/bookmark/share buttons |
| `onEdit` | `() => void` | — | Callback for edit button (hidden if not provided) |

**Features:**
- Derives sections from `sectionHeader` blocks (falls back to H2, then single section)
- Arrow key navigation (left/right)
- Progress bar (top), progress dots (bottom)
- Sidebar TOC with completion checkmarks
- Mobile responsive (sidebar collapses below 768px)
- Quiz/checkpoint events mark sections complete

### ExplainerEditor

Three-panel editor for creating explainers.

```vue
<script setup>
import { ExplainerEditor, useBlockEditor } from '@commonpub/explainer/vue';

const blockEditor = useBlockEditor();
const metadata = ref({
  slug: '',
  description: '',
  tags: [],
  difficulty: 'beginner',
  estimatedMinutes: 10,
  coverImageUrl: '',
});
</script>

<template>
  <div style="height: 100vh; display: flex;">
    <ExplainerEditor
      :block-editor="blockEditor"
      :metadata="metadata"
      @update:metadata="metadata = $event"
    />
  </div>
</template>
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `blockEditor` | `BlockEditor` | Block state from `useBlockEditor()` |
| `metadata` | `Record<string, unknown>` | Slug, description, tags, difficulty, cover, etc. |

**Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `update:metadata` | `Record<string, unknown>` | Metadata changed |

**Panels:**
- **Left**: Block palette (searchable) + Structure tab (section tree with interactive counts)
- **Center**: Block canvas with inline editing, drag-drop reorder, move/duplicate/delete
- **Right**: Properties (slug, description, estimated minutes, tags, difficulty, cover image)
- **Status bar**: Section count, interactive count, word count, read time

The editor must be given a fixed height container (it uses `flex: 1` and `overflow: hidden`).

### BlockRenderer

Renders a `BlockTuple[]` array as Vue components. Extensible with custom block types.

```vue
<script setup>
import { BlockRenderer } from '@commonpub/explainer/vue';

const blocks = [
  ['text', { html: '<p>Hello world</p>' }],
  ['quiz', { question: 'Ready?', options: [{ text: 'Yes', correct: true }] }],
];
</script>

<template>
  <BlockRenderer
    :blocks="blocks"
    :start-index="0"
    :end-index="blocks.length"
    :custom-blocks="{ myType: MyComponent }"
    @quiz-answered="(idx, correct) => console.log(idx, correct)"
    @checkpoint-reached="(idx) => console.log(idx)"
  />
</template>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `blocks` | `BlockTuple[]` | required | Array of `[type, data]` pairs |
| `startIndex` | `number` | `0` | Start rendering from this index |
| `endIndex` | `number` | `blocks.length` | Stop rendering at this index |
| `customBlocks` | `Record<string, Component>` | `{}` | Additional block type components |

**Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `quizAnswered` | `[blockIndex, correct]` | User answered a quiz |
| `checkpointReached` | `[blockIndex]` | Checkpoint block mounted |

## Block Components

Each block receives `content: Record<string, unknown>` as its sole prop.

### Interactive Blocks

#### QuizBlock

Multiple-choice quiz with visual feedback.

```ts
{
  question: 'What color is the sky?',
  options: [
    { text: 'Red', correct: false },
    { text: 'Blue', correct: true },
    { text: 'Green', correct: false },
  ],
}
```

Emits `answered: [correct: boolean]` when user selects an option. Supports A-H option keys. Shows correct answer when wrong.

#### SliderBlock

Interactive range slider with contextual feedback.

```ts
{
  label: 'Temperature',
  min: 0,
  max: 100,
  step: 1,
  unit: '°C',
  defaultValue: 20,
  feedback: [
    { min: 0, max: 10, state: 'low', message: 'Too cold for most processes.' },
    { min: 10, max: 30, state: 'good', message: 'Optimal range.' },
    { min: 30, max: 100, state: 'high', message: 'Risk of overheating.' },
  ],
}
```

Feedback `state` maps to colors: `low`/`slow` = yellow, `good`/`ok` = green, `high`/`danger` = red.

#### CheckpointBlock

Auto-completing section marker. Triggers on mount with fade-in animation.

```ts
{ label: 'You understand the basics' }
```

Emits `reached: []` immediately on mount.

### Content Blocks

| Component | Key Fields | Notes |
|-----------|-----------|-------|
| **TextBlock** | `html` | Sanitized HTML with p, strong, em, code, a, lists |
| **HeadingBlock** | `text`, `level` (1-6) | Renders as `<h1>`-`<h6>` with anchor ID |
| **CodeBlock** | `code`, `language`, `filename` | Dark theme, copy button. No syntax highlighting (add hljs in your app) |
| **ImageBlock** | `src` (or `url`), `alt`, `caption` | Lazy loading, figcaption |
| **CalloutBlock** | `html`, `variant` | Variants: info (blue), tip (green), warning (yellow), danger (red) |
| **QuoteBlock** | `html` (or `text`), `attribution` | Blockquote with optional attribution |
| **DividerBlock** | — | Horizontal rule |
| **EmbedBlock** | `url` | iFrame embed. Only http/https URLs allowed |
| **SectionHeader** | `tag`, `title`, `body` | Section boundary. Tag (e.g. "§ 01"), title, intro text |

## Composables

### useBlockEditor(initialBlocks?)

Manages an array of editor blocks with full CRUD operations.

```ts
import { useBlockEditor } from '@commonpub/explainer/vue';

const editor = useBlockEditor([
  ['text', { html: '<p>Hello</p>' }],
]);

// Read
editor.blocks.value           // EditorBlock[] (readonly)
editor.selectedBlockId.value  // string | null
editor.selectedBlock.value    // EditorBlock | null
editor.isEmpty.value          // boolean

// Mutate
editor.addBlock('quiz', { question: '...' });          // Append
editor.addBlock('text', {}, 3);                          // Insert at index 3
editor.removeBlock('blk-abc');                           // Delete
editor.updateBlock('blk-abc', { html: 'updated' });     // Patch content
editor.moveBlockUp('blk-abc');                           // Move up
editor.moveBlockDown('blk-abc');                         // Move down
editor.duplicateBlock('blk-abc');                        // Clone
editor.replaceBlock('blk-abc', 'heading', { text: 'New', level: 2 }); // Replace type
editor.selectBlock('blk-abc');                           // Select
editor.clearBlocks();                                    // Remove all

// Serialize
const tuples = editor.toBlockTuples();   // BlockTuple[] for storage
editor.fromBlockTuples(tuples);           // Restore from storage
```

**Block defaults**: When adding a block, sensible defaults are applied per type (empty strings, default values). See the `BLOCK_DEFAULTS` map in the source.

### useExplainerSections(blocks, fallbackTitle?)

Reactive wrapper around `deriveSections()` from the TS engine.

```ts
import { useExplainerSections } from '@commonpub/explainer/vue';

const blocks = ref<BlockTuple[]>([...]);
const { sections, ranges } = useExplainerSections(blocks, 'My Explainer');

// sections.value = DerivedSection[] — title, tag, body, blockIndex
// ranges.value = SectionRange[] — start, end indices for each section's body blocks
```

Recomputes automatically when `blocks` changes.

### useExplainerProgress(totalSections)

Tracks navigation state and section completion.

```ts
import { useExplainerProgress } from '@commonpub/explainer/vue';

const total = computed(() => sections.value.length);
const progress = useExplainerProgress(total);

progress.activeSection.value      // number — current section index
progress.completedSections.value  // Set<number> — completed section indices
progress.progressPct.value        // number — 0 to 100
progress.isComplete.value         // boolean

progress.goToSection(2);          // Jump (marks skipped as complete)
progress.prevSection();           // Go back
progress.nextSection();           // Go forward (marks current as complete)
progress.markComplete(1);         // Explicitly mark section done
```

## Adding Custom Block Types

### Step 1: Create a block component

```vue
<!-- MyChartBlock.vue -->
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ content: Record<string, unknown> }>();
const chartData = computed(() => (props.content.data as number[]) || []);
</script>

<template>
  <div class="my-chart">
    <div v-for="(val, i) in chartData" :key="i" class="bar" :style="{ height: val + '%' }">
      {{ val }}
    </div>
  </div>
</template>
```

The component MUST accept `content: Record<string, unknown>` as a prop.

For interactive blocks that affect section completion, emit events:
- `answered: [correct: boolean]` — for quiz-like blocks
- `reached: []` — for checkpoint-like blocks

### Step 2: Register with BlockRenderer

```vue
<BlockRenderer
  :blocks="blocks"
  :custom-blocks="{ chart: MyChartBlock }"
/>
```

The key in `customBlocks` must match the block type string in your `BlockTuple[]`.

### Step 3: Add to editor block palette (optional)

```vue
<ExplainerEditor :block-editor="editor" :metadata="meta">
  <!-- The editor uses a hardcoded block palette. To add custom types,
       create your own editor wrapper that includes EditorBlockLibrary
       with additional groups. -->
</ExplainerEditor>
```

For custom editor forms, extend the `BlockCanvas` component or wrap it with additional block type handlers.

## Theming

### Required CSS Variables

Every component uses CSS custom properties. The base theme defines:

| Variable | Purpose | Default (light) |
|----------|---------|-----------------|
| `--bg` | Page background | `#fafaf9` |
| `--surface` | Card/panel background | `#ffffff` |
| `--surface2` | Hover/alt surface | `#f4f4f2` |
| `--surface3` | Tertiary surface | `#eaeae7` |
| `--text` | Primary text | `#1a1a1a` |
| `--text-dim` | Secondary text | `#6b6b66` |
| `--text-faint` | Tertiary text | `#a3a39e` |
| `--color-text-inverse` | Text on accent | `#ffffff` |
| `--border` | Primary border | `#1a1a1a` |
| `--border2` | Subtle border | `#d4d4d0` |
| `--border-width-default` | Border thickness | `2px` |
| `--accent` | Primary accent | `#5b9cf6` |
| `--accent-bg` | Accent tint | `rgba(91,156,246,0.08)` |
| `--accent-border` | Accent border | `rgba(91,156,246,0.25)` |
| `--green` | Success color | `#22c55e` |
| `--yellow` | Warning color | `#f59e0b` |
| `--red` | Error color | `#ef4444` |
| `--font-sans` | Body font | `system-ui` |
| `--font-mono` | Mono font | `JetBrains Mono` |
| `--shadow-sm` | Small shadow | `2px 2px 0 var(--border)` |
| `--shadow-md` | Medium shadow | `4px 4px 0 var(--border)` |
| `--radius-full` | Circle radius | `50%` |

Each semantic color also needs `-bg` and `-border` variants (e.g., `--green-bg`, `--green-border`).

### Dark Mode

The base theme supports dark mode via:

1. **Automatic**: `prefers-color-scheme: dark` media query
2. **Manual**: `<html data-theme="dark">` attribute

Override by defining your own values in `[data-theme="dark"]`.

### Custom Theme Example

```css
:root {
  --accent: #00e7ad;
  --accent-bg: rgba(0, 231, 173, 0.08);
  --accent-border: rgba(0, 231, 173, 0.25);
  --font-sans: 'Poppins', system-ui;
  --border-width-default: 1px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
  --shadow-md: 0 2px 6px rgba(0,0,0,0.1);
}
```

## File Structure

```
vue/
├── components/
│   ├── ExplainerViewer.vue       # Section viewer (topbar, TOC, progress)
│   ├── ExplainerEditor.vue       # 3-panel editor shell
│   ├── BlockRenderer.vue         # Block array renderer (extensible)
│   ├── blocks/
│   │   ├── QuizBlock.vue         # Multiple-choice quiz
│   │   ├── SliderBlock.vue       # Interactive range slider
│   │   ├── CheckpointBlock.vue   # Auto-completing checkpoint
│   │   ├── SectionHeader.vue     # Section boundary header
│   │   ├── TextBlock.vue         # Rich text (HTML)
│   │   ├── HeadingBlock.vue      # H1-H6
│   │   ├── CodeBlock.vue         # Code with copy button
│   │   ├── ImageBlock.vue        # Image with caption
│   │   ├── CalloutBlock.vue      # Info/tip/warning/danger
│   │   ├── QuoteBlock.vue        # Blockquote
│   │   ├── DividerBlock.vue      # Horizontal rule
│   │   ├── EmbedBlock.vue        # iFrame embed
│   │   └── index.ts              # Barrel exports
│   └── editor/
│       ├── BlockCanvas.vue       # Inline block editing canvas
│       ├── EditorBlockLibrary.vue  # Searchable block palette
│       ├── EditorSection.vue     # Collapsible panel section
│       └── EditorTagInput.vue    # Tag input widget
├── composables/
│   ├── useBlockEditor.ts         # Block CRUD state management
│   ├── useExplainerSections.ts   # Reactive section derivation
│   └── useExplainerProgress.ts   # Reactive progress tracking
├── utils/
│   └── sanitize.ts               # HTML sanitizer
├── theme/
│   └── base.css                  # Default theme (light + dark)
└── index.ts                      # Public API exports
```
