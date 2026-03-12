# ADR 015: Explainer Data Model

## Status

Accepted

## Context

Explainers are full-page, section-based interactive learning experiences. We need to decide how to store and structure explainer sections, and how they relate to the existing content system.

Two approaches were considered:

1. **TipTap NodeView approach**: Sections as custom TipTap nodes, edited inline in the TipTap editor
2. **Structured JSON approach**: Sections as structured JSON in the `sections` JSONB field, with form-based editing

## Decision

**Structured JSON in `sections` JSONB field**, not TipTap nodes.

### Section Types

```typescript
type ExplainerSectionType = 'text' | 'interactive' | 'quiz' | 'checkpoint';
```

- **text**: Rich text content (BlockTuple[]) with optional visual config
- **interactive**: Content + controls (sliders, toggles) driving visualizations (Phase 5b)
- **quiz**: Questions with multiple-choice options, scoring, gate enforcement
- **checkpoint**: Progress gate requiring completion of previous sections

### Data Shape

Each section stored in `contentItems.sections` JSONB:

```typescript
interface ExplainerSectionBase {
  id: string;
  title: string;
  anchor: string;
  type: ExplainerSectionType;
  content: BlockTuple[];
}
```

Type-specific extensions add `questions`, `controls`, `visualConfig`, `passingScore`, `isGate`, `requiresPrevious`.

### Content Reuse

Each section's rich text uses `BlockTuple[]` from `@commonpub/editor`, keeping content representation consistent across the platform. The same `ContentEditor.svelte` TipTap wrapper is used for editing section text content.

## Consequences

### Positive

- **Portable**: Sections are plain JSON, easy to export to HTML, PDF, or other formats
- **Simple HTML export**: No TipTap runtime needed for rendering
- **Decoupled**: Explainer runtime doesn't depend on TipTap
- **Form-based editing**: Section management (add/remove/reorder, quiz building) is natural as forms, not inline editing
- **Type-safe**: Zod validators enforce section structure at runtime

### Negative

- No inline WYSIWYG editing of section structure (must use form UI)
- Section reordering requires custom UI (drag-and-drop list), not TipTap's built-in node manipulation
- Svelte NodeView (for embedding interactive widgets in TipTap) is deferred

### Neutral

- `content` field on contentItems still stores the overall explainer description/intro as BlockTuple[]
- `sections` field stores the structured section array
- Both fields coexist on the same content_items row
