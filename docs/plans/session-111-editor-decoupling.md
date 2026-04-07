# Session 111 Plan — Editor Package Decoupling (`@commonpub/editor/vue`)

**Goal:** Move block editor Vue components and composables from the layer into `@commonpub/editor`, matching the `@commonpub/explainer/vue` pattern. Eliminate the `useBlockEditor` duplication. Make the full block editing stack consumable by any Vue 3 app.

## Current State

### What's already in `packages/editor/` (good — logic layer)
- 18 TipTap extensions (pure TS, one per block type)
- `createCommonPubEditor()` factory
- `blockTuplesToDoc()` / `docToBlockTuples()` serialization
- `markdownToBlockTuples()` / `blockTuplesToMarkdown()` conversion
- Block registry + Zod validators for all 20 block types
- `buildEditorSchema()` for TipTap
- **Zero Vue dependencies — fully portable**

### What's stuck in the layer (problem)
- **20 block editor components** in `layers/base/components/editors/blocks/`:
  TextBlock, HeadingBlock, CodeBlock, ImageBlock, QuoteBlock, CalloutBlock,
  GalleryBlock, VideoBlock, EmbedBlock, MarkdownBlock, MathBlock,
  PartsListBlock, BuildStepBlock, ToolListBlock, DownloadsBlock,
  QuizBlock, SliderBlock, CheckpointBlock, SectionHeaderBlock, DividerBlock
- **Editor infrastructure** in `layers/base/components/editors/`:
  BlockCanvas, BlockWrapper, BlockPicker, BlockInsertZone, EditorBlocks,
  EditorSection, EditorShell, EditorTagInput, EditorVisibility
- **Composable** in `layers/base/composables/useBlockEditor.ts`
- **DUPLICATE composable** in `packages/explainer/vue/composables/useBlockEditor.ts`

### What stays in the layer (Nuxt-specific)
- `ArticleEditor.vue`, `BlogEditor.vue`, `ProjectEditor.vue` — compose package components with Nuxt routing, $fetch API calls, auth
- `MarkdownImportDialog.vue` — uses $fetch
- `DocsPageTree.vue` — docs-specific
- `useContentSave.ts` — Nuxt $fetch
- `usePublishValidation.ts` — Nuxt-specific
- Edit pages (`pages/u/[username]/[type]/[slug]/edit.vue`) — routing + API wiring

## Architecture After Decoupling

```
@commonpub/editor
├── src/                          # Existing logic layer (no changes)
│   ├── extensions/               # 18 TipTap extensions
│   ├── blocks/                   # Registry, schemas, types
│   ├── serialization.ts          # BlockTuple <-> ProseMirror
│   ├── markdown/                 # MD conversion
│   └── editorKit.ts              # createCommonPubEditor()
│
├── vue/                          # NEW: Vue component layer
│   ├── index.ts                  # Public exports
│   ├── composables/
│   │   └── useBlockEditor.ts     # CANONICAL location (delete duplicates)
│   ├── components/
│   │   ├── blocks/               # 20 block editor components
│   │   │   ├── TextBlock.vue
│   │   │   ├── ImageBlock.vue    # Uses onUpload callback prop
│   │   │   └── ...
│   │   ├── BlockCanvas.vue       # Main editing surface
│   │   ├── BlockWrapper.vue      # Toolbar wrapper per block
│   │   ├── BlockPicker.vue       # Block type selection grid
│   │   ├── BlockInsertZone.vue   # Drop zone between blocks
│   │   ├── EditorBlocks.vue      # Block library sidebar
│   │   ├── EditorSection.vue     # Collapsible panel section
│   │   ├── EditorShell.vue       # 3-panel layout frame
│   │   ├── EditorTagInput.vue    # Tag/chip input
│   │   └── EditorVisibility.vue  # Public/unlisted/private dropdown
│   └── types.ts                  # Vue-specific types (EditorBlock, etc.)
│
└── package.json                  # Updated: add ./vue export, vue peer dep
```

### Import Patterns After

```typescript
// Logic (unchanged)
import { markdownToBlockTuples, type BlockTuple } from '@commonpub/editor';

// Vue components (NEW)
import { BlockCanvas, BlockPicker, useBlockEditor } from '@commonpub/editor/vue';
import type { EditorBlock } from '@commonpub/editor/vue';
```

### Layer After (thin wiring only)
```
layers/base/components/editors/
├── ArticleEditor.vue       # Composes @commonpub/editor/vue components
├── BlogEditor.vue          # Same pattern
├── ProjectEditor.vue       # Same pattern
├── ExplainerEditor.vue     # Legacy (uses @commonpub/explainer/vue)
├── MarkdownImportDialog.vue # Nuxt-specific ($fetch)
└── DocsPageTree.vue         # Docs-specific
```

## Implementation Steps

### Phase 1: Scaffold `packages/editor/vue/`

1. **Update `packages/editor/package.json`:**
   - Add `"./vue"` export pointing to `vue/index.ts`
   - Add `vue: "^3.4.0"` as optional peer dependency
   - Keep existing `.` export unchanged

2. **Create `packages/editor/vue/index.ts`:**
   - Export all block components
   - Export infrastructure components
   - Export composables
   - Export types

3. **Create `packages/editor/vue/types.ts`:**
   - Move `EditorBlock` interface from layer's `useBlockEditor.ts`
   - Move `BlockDefaults` type

### Phase 2: Move `useBlockEditor` composable

4. **Create `packages/editor/vue/composables/useBlockEditor.ts`:**
   - Move from `layers/base/composables/useBlockEditor.ts`
   - Parameterize `BLOCK_DEFAULTS` — accept as option instead of hardcoding
   - Return same API: `blocks`, `selectedBlockId`, `addBlock`, `removeBlock`, `updateBlock`, `moveBlock`, `duplicateBlock`, `getBlockTuples`

5. **Delete duplicate in explainer:**
   - Remove `packages/explainer/vue/composables/useBlockEditor.ts`
   - Update explainer imports to use `@commonpub/editor/vue`
   - Update explainer's `package.json` to add `@commonpub/editor` as dependency (already has it as workspace:*)

6. **Update layer:**
   - Delete `layers/base/composables/useBlockEditor.ts`
   - Update all layer imports to `@commonpub/editor/vue`

### Phase 3: Move block editor components

7. **Move 20 block components** from `layers/base/components/editors/blocks/` to `packages/editor/vue/components/blocks/`

8. **Abstract API dependencies:** Two blocks need file upload:
   - `ImageBlock.vue` — add `onUpload: (file: File) => Promise<string>` prop
   - `GalleryBlock.vue` — same pattern
   - Layer provides the callback: `(file) => $fetch('/api/files/upload', { method: 'POST', body: formData })`

9. **Remove Nuxt auto-import assumptions:**
   - Explicit Vue imports (`ref`, `computed`, `watch`, `onMounted`)
   - Explicit component imports (no auto-resolve)
   - No `$fetch`, `useRoute`, `useAuth`, `navigateTo`

### Phase 4: Move editor infrastructure

10. **Move infrastructure components:**
    - `BlockCanvas.vue` — needs explicit block component registry (prop or provide/inject) instead of Nuxt auto-resolved component names
    - `BlockWrapper.vue` — pure, no dependencies
    - `BlockPicker.vue` — pure, uses block registry
    - `BlockInsertZone.vue` — pure
    - `EditorBlocks.vue` — pure
    - `EditorSection.vue` — pure
    - `EditorShell.vue` — pure layout
    - `EditorTagInput.vue` — pure
    - `EditorVisibility.vue` — pure

11. **Block component resolution strategy for BlockCanvas:**
    - Option A: Static import map in the package (import all 20, map by type string)
    - Option B: `provide/inject` — layer provides component map, canvas resolves dynamically
    - **Recommended: Option A** — simpler, tree-shakeable, matches explainer pattern where SectionRenderer imports all module viewers statically

### Phase 5: Update consumers

12. **Update layer editors** (ArticleEditor, BlogEditor, ProjectEditor):
    - Replace local component imports with `@commonpub/editor/vue` imports
    - Pass `onUpload` callback to BlockCanvas/block components
    - Keep Nuxt-specific logic (API calls, routing, save)

13. **Update explainer package:**
    - Import `useBlockEditor` from `@commonpub/editor/vue` instead of local copy
    - Import shared block components from `@commonpub/editor/vue` for its editor blocks
    - Keep explainer-specific components (SectionEditorPanel, ModulePicker, etc.)

14. **Update docs editor page:**
    - Import BlockCanvas from `@commonpub/editor/vue`
    - Pass docs-specific block subset config

### Phase 6: Tests + verify

15. **Move/update tests:**
    - `useBlockEditor` unit tests — move to editor package
    - Verify all existing layer tests still pass
    - Verify explainer tests still pass (import path change)
    - Add component tests for key components (BlockCanvas, BlockPicker)

16. **Full verification:**
    - `pnpm typecheck` — 26/26
    - `pnpm test` — all suites pass
    - Manual smoke test: create article, blog, project, explainer, docs page — all editors work

17. **Publish:**
    - Bump `@commonpub/editor` to 0.6.0 (minor — new vue export)
    - Bump `@commonpub/explainer` patch (import path change)
    - Bump `@commonpub/layer` patch (import path change)
    - Deploy to both instances

## Key Design Decisions

### Why Option A (static component map) for BlockCanvas
The explainer package uses the same pattern — `SectionRenderer` imports all module viewers and resolves by type. It's simple, debuggable, and tree-shakeable. Dynamic resolution (provide/inject) adds complexity for no real gain since the block type set is known at build time.

### Why `onUpload` callback instead of built-in fetch
The package shouldn't know about API endpoints. The layer (or any consumer) provides the upload implementation. This is the same pattern as `v-model` — the component manages UI, the parent manages persistence.

### Why keep content-type editors in the layer
ArticleEditor/BlogEditor/ProjectEditor do too much Nuxt-specific work (auto-save with $fetch, publish validation with API calls, properties panel with tag management, cover image upload). Moving them would require abstracting every API call into callbacks, making the component signatures unwieldy. Better to keep them as thin layer shells that compose package primitives.

### What about the CpubEditor.vue wrapper?
`CpubEditor.vue` (the inline TipTap wrapper) could also move to the package. It uses `createCommonPubEditor()` from the logic layer and is a simple v-model component. Move it if there's time; it's not blocking.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Block component has hidden Nuxt dependency | Medium | Low | Grep for `$fetch`, `useRoute`, `navigateTo`, `useFetch` before moving each file |
| BlockCanvas dynamic component resolution breaks | Medium | Medium | Test with explicit import map before committing |
| Explainer import path change breaks tests | Low | Low | Search-and-replace, run tests |
| Circular dependency editor <-> explainer | Low | High | Editor has no explainer dependency; explainer depends on editor. One-way. |
| CSS custom properties not available in package tests | Low | Low | Package tests are logic-only; visual testing stays in layer |

## Estimated Scope

- ~35 files to move/modify
- ~15 files to delete (duplicates in layer)
- ~20 import path updates across layer
- ~5 import path updates in explainer
- No schema or server changes
- No API changes
- No database changes

## Sessions After This

### Session 112: Docs Cleanup + Content Import
- Kill docsNav dead code (table, functions, validators)
- Add UNIQUE(version_id, slug) constraint on docs_pages
- Add 1-2 new content import platforms (instructables, dev.to)

### Session 113: Explainer Sprint 4 Integration
- Wire ExplainerSectionEditor to content system
- Array config field editor
- SSR guards
- HTML export update

### Session 114: E2E Editor Tests
- Playwright tests for block editor (article creation flow)
- Playwright tests for explainer section editor
- Playwright tests for docs editor
