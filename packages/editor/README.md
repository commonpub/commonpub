# @commonpub/editor

TipTap block editor extensions and serialization for CommonPub.

## Overview

Block-based content editor built on [TipTap](https://tiptap.dev/). Content is stored as `BlockTuple` arrays, a compact serialization format that maps bidirectionally to TipTap's ProseMirror document structure. Each block type has a Zod schema, a TipTap extension, and a registry entry.

## Installation

```bash
pnpm add @commonpub/editor
```

## Usage

### Creating an Editor

```ts
import { createCommonPubEditor } from '@commonpub/editor';

const editor = createCommonPubEditor({
  content: existingBlockTuples, // optional
  onUpdate: (tuples) => {
    // Save block tuples
  },
});
```

### Block Types

18 block types are available, covering rich text, media, and maker-specific content:

**Core blocks:**

| Type       | Extension                 | Description                         |
| ---------- | ------------------------- | ----------------------------------- |
| `text`     | `CommonPubText`           | Rich text paragraph                 |
| `heading`  | `CommonPubHeading`        | Heading (h1-h6)                     |
| `code`     | `CommonPubCodeBlock`      | Syntax-highlighted code block       |
| `image`    | `CommonPubImage`          | Image with alt text and caption     |
| `quote`    | `CommonPubQuote`          | Block quote with attribution        |
| `callout`  | `CommonPubCallout`        | Callout box (info, warning, tip)    |

**Media & embed blocks:**

| Type       | Extension                 | Description                         |
| ---------- | ------------------------- | ----------------------------------- |
| `gallery`  | `CommonPubGallery`        | Image gallery with captions         |
| `video`    | `CommonPubVideo`          | Embedded video player               |
| `embed`    | `CommonPubEmbed`          | External embed (iframe)             |
| `markdown` | `CommonPubMarkdown`       | Raw markdown block                  |

**Maker-focused blocks:**

| Type               | Extension                       | Description                         |
| ------------------ | ------------------------------- | ----------------------------------- |
| `partsList`        | `CommonPubPartsList`            | Bill of materials / parts list      |
| `buildStep`        | `CommonPubBuildStep`            | Step-by-step build instructions     |
| `toolList`         | `CommonPubToolList`             | Required tools list                 |
| `downloads`        | `CommonPubDownloads`            | Downloadable files (STL, Gerber, etc.) |

**Interactive blocks (explainers):**

| Type                 | Extension                       | Description                         |
| -------------------- | ------------------------------- | ----------------------------------- |
| `quiz`               | `CommonPubQuiz`                 | Multiple-choice quiz                |
| `interactiveSlider`  | `CommonPubInteractiveSlider`    | Interactive slider control          |
| `checkpoint`         | `CommonPubCheckpoint`           | Progress checkpoint                 |
| `mathNotation`       | `CommonPubMathNotation`         | Mathematical notation               |

### BlockTuple Format

Content is serialized as an array of `[type, content]` tuples:

```ts
type BlockTuple = [string, Record<string, unknown>];

// Example
const blocks: BlockTuple[] = [
  ['heading', { level: 1, text: 'Getting Started' }],
  ['text', { html: '<p>Welcome to the tutorial.</p>' }],
  ['code', { language: 'typescript', code: 'const x = 1;' }],
  ['image', { src: '/uploads/photo.jpg', alt: 'A circuit board' }],
];
```

### Serialization

```ts
import { blockTuplesToDoc, docToBlockTuples, validateBlockTuples } from '@commonpub/editor';

// BlockTuples -> ProseMirror document (for TipTap)
const doc = blockTuplesToDoc(tuples, schema);

// ProseMirror document -> BlockTuples (for storage)
const tuples = docToBlockTuples(doc);

// Validate block tuples against registered schemas
const errors = validateBlockTuples(tuples);
```

### Block Registry

Register custom block types or use the built-in ones:

```ts
import { registerBlock, lookupBlock, listBlocks, registerCoreBlocks } from '@commonpub/editor';

// Register all 18 built-in block types
registerCoreBlocks();

// Register a custom block type
registerBlock({
  type: 'embed',
  schema: embedContentSchema,
  extension: CommonPubEmbed,
});

// Look up a registered block
const block = lookupBlock('heading');

// List all registered block types
const types = listBlocks(); // ['text', 'heading', 'code', ...]
```

### Individual Extensions

Use extensions directly for custom editor setups:

```ts
import { CommonPubText, CommonPubHeading, CommonPubCodeBlock } from '@commonpub/editor';
```

### Content Schemas

Zod schemas for validating block content:

```ts
import {
  textContentSchema,
  headingContentSchema,
  codeContentSchema,
  imageContentSchema,
  quoteContentSchema,
  calloutContentSchema,
} from '@commonpub/editor';
```

## Architecture

```
Editor Factory (createCommonPubEditor)
  -> TipTap Core
       -> Extensions (one per block type)
       -> ProseMirror Schema
            -> Serialization (BlockTuple <-> Doc)
                 -> Block Registry + Zod Schemas
```

## Development

```bash
pnpm build        # Compile TypeScript
pnpm test         # Run 69 tests
pnpm typecheck    # Type-check without emitting
```

## Dependencies

- `@tiptap/core` + extensions: Editor framework
- `@tiptap/pm`: ProseMirror bindings
- `shiki`: Syntax highlighting for code blocks
- `zod`: Block content validation
- `@commonpub/config`: Feature flags
- `@commonpub/schema`: Content type definitions
