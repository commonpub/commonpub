# ADR-012: TipTap Editor Architecture

## Status

Accepted

## Context

@commonpub/editor needs to provide block-based content editing for projects, articles, and learning content. TipTap has no official Svelte adapter. We need an architecture that works for Phase 3 (pure logic) and Phase 4 (Svelte rendering in the reference app).

## Decision

@commonpub/editor is a **pure TypeScript package** with no Svelte dependency. It exports:

1. **Block type system** — `BlockTuple` type, `BlockDefinition` interface, block registry
2. **Zod content schemas** — Validation schemas for each block type's content
3. **TipTap extensions** — Pure TypeScript Node extensions for each block type
4. **Serialization** — `BlockTuple[] ↔ ProseMirror Doc` conversion functions
5. **Editor factory** — `createCommonPubEditor()` returns a configured TipTap `Editor` instance

### BlockTuple Format

Content is stored as `BlockTuple[]` — an array of `[type, content]` tuples:

```typescript
type BlockTuple = [string, Record<string, unknown>];

const content: BlockTuple[] = [
  ['heading', { text: 'Getting Started', level: 2 }],
  ['text', { html: '<p>Welcome.</p>' }],
  ['code', { code: 'console.log("hi")', language: 'typescript' }],
];
```

### Core Block Types (Phase 3)

| Block   | Content Schema                                                  |
| ------- | --------------------------------------------------------------- |
| text    | `{ html: string }`                                              |
| heading | `{ text: string, level: 1\|2\|3\|4 }`                           |
| code    | `{ code: string, language: string, filename?: string }`         |
| image   | `{ src: string, alt: string, caption?: string }`                |
| quote   | `{ html: string, attribution?: string }`                        |
| callout | `{ html: string, variant: 'info'\|'tip'\|'warning'\|'danger' }` |

### Separation of Concerns

- **@commonpub/editor** (Phase 3): Extensions, schemas, serialization, factory — pure TypeScript
- **Reference app** (Phase 4): Svelte NodeView rendering, floating toolbar, slash commands, drag-and-drop

## Alternatives Considered

1. **Full Svelte adapter in @commonpub/editor** — Too much scope for Phase 3. Svelte rendering is app-level concern.
2. **Custom ProseMirror (no TipTap)** — TipTap's extension system, commands, and input rules save significant effort.
3. **Markdown storage instead of BlockTuples** — BlockTuples preserve structured data (code language, callout variant) that Markdown can't express cleanly.

## Consequences

- @commonpub/editor has no Svelte dependency (only @tiptap/core, @tiptap/pm, zod)
- Phase 4 reference app must implement Svelte NodeViews for rich editing
- Block types are extensible — consumers can register domain-specific blocks
- Serialization must be thoroughly tested (round-trip all block types)
- Media-heavy blocks (video, gallery, embed, downloads) deferred to Phase 4+
