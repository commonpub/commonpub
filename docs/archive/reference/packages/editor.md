# @commonpub/editor

> TipTap extensions, BlockTuple serialization, block registry, and editor factory.

**npm**: `@commonpub/editor`
**Source**: `packages/editor/src/`
**Entry**: `packages/editor/src/index.ts`

---

## Exports

### Block Type System

| Export | Kind | Description |
|--------|------|-------------|
| `BlockTuple` | Type | `[type: string, content: unknown]` — fundamental content unit |
| `BlockDefinition` | Type | Registration shape for custom blocks |
| `textContentSchema` | Zod Schema | Text block content validator |
| `headingContentSchema` | Zod Schema | Heading block content validator |
| `codeContentSchema` | Zod Schema | Code block content validator |
| `imageContentSchema` | Zod Schema | Image block content validator |
| `quoteContentSchema` | Zod Schema | Quote block content validator |
| `calloutContentSchema` | Zod Schema | Callout block content validator |
| `TextContent` | Type | Inferred from `textContentSchema` |
| `HeadingContent` | Type | Inferred from `headingContentSchema` |
| `CodeContent` | Type | Inferred from `codeContentSchema` |
| `ImageContent` | Type | Inferred from `imageContentSchema` |
| `QuoteContent` | Type | Inferred from `quoteContentSchema` |
| `CalloutContent` | Type | Inferred from `calloutContentSchema` |

### Block Registry

| Export | Kind | Description |
|--------|------|-------------|
| `registerBlock` | Function | Register a custom block type |
| `lookupBlock` | Function | Look up a registered block by type name |
| `listBlocks` | Function | List all registered block types |
| `validateBlock` | Function | Validate a BlockTuple against its registered schema |
| `clearRegistry` | Function | Clear all registered blocks (for testing) |
| `registerCoreBlocks` | Function | Register all 6 built-in block types |

### Serialization

| Export | Kind | Description |
|--------|------|-------------|
| `blockTuplesToDoc` | Function | Convert BlockTuple[] to TipTap document JSON |
| `docToBlockTuples` | Function | Convert TipTap document JSON to BlockTuple[] |
| `validateBlockTuples` | Function | Validate an array of BlockTuples |
| `buildEditorSchema` | Function | Build a ProseMirror schema from registered blocks |

### TipTap Extensions (6)

| Export | Kind | Description |
|--------|------|-------------|
| `CommonPubText` | TipTap Extension | Rich text with marks |
| `CommonPubHeading` | TipTap Extension | Headings (h1–h6) |
| `CommonPubCodeBlock` | TipTap Extension | Code blocks with language |
| `CommonPubImage` | TipTap Extension | Images with alt text, caption |
| `CommonPubQuote` | TipTap Extension | Blockquotes |
| `CommonPubCallout` | TipTap Extension | Callout boxes (info, warning, error, success) |

### Editor Factory

| Export | Kind | Description |
|--------|------|-------------|
| `createCommonPubEditor` | Function | Create a configured TipTap editor instance |
| `CreateCommonPubEditorOptions` | Type | Editor factory options |

---

## API Reference

### Block Types

#### `BlockTuple`

The fundamental content representation in CommonPub. Content is stored as `BlockTuple[]` in the `contentItems.content` jsonb column.

```typescript
type BlockTuple = [type: string, content: unknown];
```

**Examples**:

```typescript
const blocks: BlockTuple[] = [
  ['heading', { level: 1, text: 'Getting Started' }],
  ['text', { html: '<p>Welcome to the project.</p>' }],
  ['code', { language: 'typescript', code: 'const x = 1;' }],
  ['image', { src: '/img/demo.png', alt: 'Demo screenshot', caption: 'Figure 1' }],
  ['quote', { text: 'Build things that matter.', attribution: 'Unknown' }],
  ['callout', { type: 'warning', title: 'Note', content: 'This is experimental.' }],
];
```

#### Block Content Schemas

| Block Type | Schema | Fields |
|-----------|--------|--------|
| `text` | `textContentSchema` | `{ html: string }` |
| `heading` | `headingContentSchema` | `{ level: 1\|2\|3\|4\|5\|6, text: string }` |
| `code` | `codeContentSchema` | `{ language: string, code: string }` |
| `image` | `imageContentSchema` | `{ src: string, alt: string, caption?: string }` |
| `quote` | `quoteContentSchema` | `{ text: string, attribution?: string }` |
| `callout` | `calloutContentSchema` | `{ type: 'info'\|'warning'\|'error'\|'success', title?: string, content: string }` |

### Registry

#### `registerBlock(definition: BlockDefinition): void`

Register a custom block type.

```typescript
interface BlockDefinition {
  type: string;           // Unique block type name
  schema: ZodSchema;      // Zod validator for content
  toNode?: Function;      // Convert to ProseMirror node
  fromNode?: Function;    // Convert from ProseMirror node
}
```

#### `lookupBlock(type: string): BlockDefinition | undefined`

Look up a block definition by type name.

#### `listBlocks(): BlockDefinition[]`

Returns all registered block definitions.

#### `validateBlock(tuple: BlockTuple): boolean`

Validates a BlockTuple's content against its registered schema.

#### `clearRegistry(): void`

Removes all registered blocks. Used in tests.

#### `registerCoreBlocks(): void`

Registers the 6 built-in block types: `text`, `heading`, `code`, `image`, `quote`, `callout`.

### Serialization

#### `blockTuplesToDoc(blocks: BlockTuple[]): object`

Converts a `BlockTuple[]` array to a TipTap/ProseMirror document JSON structure.

#### `docToBlockTuples(doc: object): BlockTuple[]`

Converts a TipTap/ProseMirror document JSON back to `BlockTuple[]`.

#### `validateBlockTuples(blocks: BlockTuple[]): { valid: boolean; errors: string[] }`

Validates an entire array of BlockTuples. Returns validation result with error messages for invalid blocks.

#### `buildEditorSchema(): Schema`

Builds a ProseMirror schema from all currently registered block types.

### Editor Factory

#### `createCommonPubEditor(options: CreateCommonPubEditorOptions): Editor`

Creates a fully configured TipTap editor instance with all CommonPub extensions.

```typescript
interface CreateCommonPubEditorOptions {
  element?: HTMLElement;     // DOM element to mount editor
  content?: BlockTuple[];    // Initial content
  editable?: boolean;        // Default: true
  onUpdate?: (blocks: BlockTuple[]) => void;  // Change callback
}
```

---

## Data Flow

```
User edits in TipTap
  → TipTap Document JSON (ProseMirror nodes)
  → docToBlockTuples() → BlockTuple[]
  → Zod validation (validateBlockTuples)
  → JSON.stringify → stored in contentItems.content (jsonb)

Content loaded from DB
  → JSON.parse → BlockTuple[]
  → blockTuplesToDoc() → TipTap Document JSON
  → TipTap renders in editor

Content federated
  → BlockTuple[] → contentToArticle() → AP Article
  → Activity builders wrap in Create/Update
```

---

## Internal Architecture

```
packages/editor/src/
├── index.ts              → All exports
├── blocks/
│   ├── types.ts          → BlockTuple, BlockDefinition
│   ├── schemas.ts        → 6 content Zod schemas + types
│   └── registry.ts       → registerBlock, lookupBlock, listBlocks, validateBlock, clearRegistry, registerCoreBlocks
├── serialization.ts      → blockTuplesToDoc, docToBlockTuples, validateBlockTuples, buildEditorSchema
├── editorKit.ts          → createCommonPubEditor factory
└── extensions/
    ├── text.ts           → CommonPubText
    ├── heading.ts        → CommonPubHeading
    ├── code.ts           → CommonPubCodeBlock
    ├── image.ts          → CommonPubImage
    ├── quote.ts          → CommonPubQuote
    └── callout.ts        → CommonPubCallout
```
