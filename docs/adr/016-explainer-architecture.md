# ADR 016: Explainer Architecture

## Status

Accepted

## Context

The explainer system needs a clear separation between the pure logic (types, validation, quiz scoring, progress tracking, HTML export) and the UI layer (Svelte components for viewing and editing).

## Decision

Three-layer architecture:

### Layer 1: `@commonpub/explainer` — Pure TypeScript Package

Contains zero UI code. All functions are pure (state in → state out), serializable, and testable without a DOM.

**Modules:**

- `types.ts` — All TypeScript interfaces and type aliases
- `schemas.ts` — Zod validators for all section types (discriminated union)
- `sections/registry.ts` — Section type registry (mirrors `@commonpub/editor` block registry)
- `quiz/engine.ts` — Pure quiz scoring, answer checking, option shuffling
- `progress/tracker.ts` — Pure state machine for section completion and gating
- `render/tocGenerator.ts` — Sections + progress → TOC data
- `render/sectionRenderer.ts` — Sections → HTML strings (reuses BlockTuple rendering)
- `export/htmlExporter.ts` — Full self-contained HTML document generation
- `export/templates.ts` — HTML template literals
- `export/inlineAssets.ts` — CSS/JS inlining utilities

**Dependencies:** `@commonpub/editor` (for BlockTuple type), `zod`

### Layer 2: Reference App Svelte Components

Located in `apps/reference/src/lib/components/explainer/`. These are Svelte 5 components that consume Layer 1 APIs.

**Viewer components:** ExplainerViewer, ExplainerSection, ExplainerToc, ExplainerProgress, ExplainerQuiz, ExplainerCheckpoint, ExplainerNav

**Editor components:** ExplainerEditor, SectionEditor, SectionList, QuizEditor, InteractiveEditor

### Layer 3: GSAP Runtime (Phase 5b — Deferred)

- GSAP as optional peer dependency
- Loaded dynamically only when animations are present
- Graceful degradation: all content readable without GSAP
- Animation config stored in `VisualConfig` on interactive sections

## Consequences

### Positive

- Layer 1 is fully testable without DOM, browser, or Svelte
- Layer 1 is reusable by other apps (not SvelteKit-specific)
- HTML export works server-side (Node.js) with no browser dependency
- Clear dependency direction: Layer 2 → Layer 1, Layer 3 → Layer 1

### Negative

- Some logic duplication between Svelte quiz UI and exported HTML quiz JS
- Section renderer must handle all block types without TipTap's rendering pipeline

### Neutral

- GSAP is a runtime concern, not a package dependency
- Progress state shape defined in Layer 1, stored in localStorage by Layer 2
