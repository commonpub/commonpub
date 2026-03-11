# @snaplify/editor

TipTap block editor extensions and serialization for Snaplify.

## Overview

Block-based content editor built on [TipTap](https://tiptap.dev/). Content is stored as `BlockTuple` arrays, a compact serialization format that maps bidirectionally to TipTap's ProseMirror document structure. Each block type has a Zod schema, a TipTap extension, and a registry entry.

## Installation

```bash
pnpm add @snaplify/editor
```

## Usage

### Creating an Editor

```ts
import { createSnaplifyEditor } from '@snaplify/editor';

const editor = createSnaplifyEditor({
  content: existingBlockTuples, // optional
  onUpdate: (tuples) => {
    // Save block tuples
  },
});
```

### Block Types

| Type       | Extension           | Description                         |
| ---------- | ------------------- | ----------------------------------- |
| `text`     | `SnaplifyText`      | Rich text paragraph                 |
| `heading`  | `SnaplifyHeading`   | Heading (h1-h6)                     |
| `code`     | `SnaplifyCodeBlock` | Syntax-highlighted code block       |
| `image`    | `SnaplifyImage`     | Image with alt text and caption     |
| `quote`    | `SnaplifyQuote`     | Block quote with attribution        |
| `callout`  | `SnaplifyCallout`   | Callout box (info, warning, tip)    |

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
import { blockTuplesToDoc, docToBlockTuples, validateBlockTuples } from '@snaplify/editor';

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
import { registerBlock, lookupBlock, listBlocks, registerCoreBlocks } from '@snaplify/editor';

// Register all 6 core block types
registerCoreBlocks();

// Register a custom block type
registerBlock({
  type: 'embed',
  schema: embedContentSchema,
  extension: SnaplifyEmbed,
});

// Look up a registered block
const block = lookupBlock('heading');

// List all registered block types
const types = listBlocks(); // ['text', 'heading', 'code', ...]
```

### Individual Extensions

Use extensions directly for custom editor setups:

```ts
import { SnaplifyText, SnaplifyHeading, SnaplifyCodeBlock } from '@snaplify/editor';
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
} from '@snaplify/editor';
```

## Architecture

```
Editor Factory (createSnaplifyEditor)
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
- `lowlight`: Syntax highlighting for code blocks
- `zod`: Block content validation
- `@snaplify/config`: Feature flags
- `@snaplify/schema`: Content type definitions
