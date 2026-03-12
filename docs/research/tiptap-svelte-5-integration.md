# Research: TipTap + Svelte 5 Integration

## Date: 2026-03-09

## Question

TipTap has no official Svelte adapter. How should @commonpub/editor integrate TipTap with Svelte 5?

## Findings

### TipTap Architecture

TipTap is built in layers:

1. **`@tiptap/pm`** — ProseMirror core (schema, state, view, transform)
2. **`@tiptap/core`** — Extension system, Editor class, commands framework
3. **`@tiptap/starter-kit`** — Bundle of common extensions (paragraph, bold, italic, etc.)
4. **Framework adapters** — React (`@tiptap/react`), Vue (`@tiptap/vue-3`) — thin wrappers

### Key Insight: Core is Framework-Agnostic

`@tiptap/core` exports a plain `Editor` class that:

- Manages ProseMirror state
- Provides command API
- Emits events (`update`, `selectionUpdate`, `focus`, `blur`)
- Can be mounted to any DOM element via `editor.mount(element)`

The framework adapters (`@tiptap/react`, `@tiptap/vue-3`) are thin (~200 LOC) and mainly:

- Create/destroy editor lifecycle tied to component mount/unmount
- Provide reactive state bindings
- Handle NodeView rendering in the framework's component model

### Options for Svelte 5

**Option A: Pure TS extensions in @commonpub/editor + vanilla mount in app**

- @commonpub/editor exports: extensions, block schemas, serialization, `createCommonPubEditor()` factory
- Consumer (Phase 4 app) mounts editor to DOM element using `editor.mount()`
- Svelte 5 `$effect` handles lifecycle
- NodeViews use vanilla DOM (or Svelte component rendering in Phase 4)

**Option B: Build a full Svelte adapter**

- Create `<Editor>` component, `<NodeViewWrapper>`, etc.
- Significant effort, mirrors what React/Vue adapters do
- Not needed for MVP

### Decision

**Option A** — Keep @commonpub/editor as pure TypeScript:

- Extensions are pure TS (no framework dependency)
- Block schemas use Zod (framework-agnostic)
- Serialization is pure TS (BlockTuple[] ↔ ProseMirror Doc)
- `createCommonPubEditor()` returns a TipTap `Editor` instance
- Svelte rendering is the consumer's concern (Phase 4)

This aligns with the plan's architecture: @commonpub/editor has no Svelte dependency.

### Serialization: BlockTuple Format

Content stored as `BlockTuple[]` — an array of `[type, content]` pairs:

```typescript
type BlockTuple = [string, Record<string, unknown>];

// Example:
const blocks: BlockTuple[] = [
  ['heading', { text: 'Getting Started', level: 2 }],
  ['text', { html: '<p>Welcome to the guide.</p>' }],
  ['code', { code: 'console.log("hello")', language: 'typescript' }],
];
```

Conversion functions:

- `blockTuplesToDoc(blocks)` → ProseMirror Node (for editor loading)
- `docToBlockTuples(doc)` → BlockTuple[] (for storage)
- `validateBlockTuples(raw)` → validated BlockTuple[] (Zod parsing)

### NodeView Strategy (Phase 4)

For custom block rendering in Svelte:

- TipTap's `NodeViewRenderer` accepts a constructor function
- Can create a vanilla DOM container, mount Svelte component into it
- Svelte 5's `mount()` API makes this straightforward
- Each block type gets a Svelte component for editing UI

## Sources

- TipTap documentation (tiptap.dev)
- @tiptap/core source (GitHub)
- @tiptap/react adapter source (~200 LOC reference)
- ProseMirror guide (prosemirror.net)
