# Session 111 — Editor Package Decoupling

**Date:** 2026-04-07
**Goal:** Move block editor Vue components from the Nuxt layer into `@commonpub/editor/vue`

## What Was Done

### Phase 1: Scaffold `packages/editor/vue/`
- Added `./vue` export to package.json pointing to `vue/index.ts`
- Added `vue: "^3.4.0"` as optional peer dependency
- Created `vue/types.ts`, `vue/utils.ts`, `vue/provide.ts`, `vue/index.ts`

### Phase 2: Move `useBlockEditor` composable
- Created canonical `packages/editor/vue/composables/useBlockEditor.ts`
- Merged both layer and explainer versions (layer had full block defaults, explainer had subset)
- Added `blockDefaults` option for consumer-level customization
- Exported `BlockEditor` type as `ReturnType<typeof useBlockEditor>`
- Deleted layer copy (`layers/base/composables/useBlockEditor.ts`)
- Deleted explainer copy (`packages/explainer/vue/composables/useBlockEditor.ts`)

### Phase 3: Move 20 block editor components
- Moved all 20 blocks from `layers/base/components/editors/blocks/` to `packages/editor/vue/components/blocks/`
- Added explicit Vue imports (ref, computed, watch, etc.) replacing Nuxt auto-imports
- **ImageBlock**: `$fetch` → `onUpload` callback prop
- **GalleryBlock**: `$fetch` → `onUpload` callback prop
- **PartsListBlock**: `$fetch` → `onSearchProducts` callback prop
- Fixed `sanitizeBlockHtml` import path for QuoteBlock/CalloutBlock

### Phase 4: Move 9 editor infrastructure components
- Moved BlockCanvas, BlockWrapper, BlockPicker, BlockInsertZone, EditorBlocks, EditorSection, EditorShell, EditorTagInput, EditorVisibility
- BlockCanvas: explicit component imports instead of Nuxt auto-resolve, passes `onUpload`/`onSearchProducts` through to child blocks
- Added provide/inject keys for consumer customization:
  - `BLOCK_COMPONENTS_KEY` — override individual block components
  - `UPLOAD_HANDLER_KEY` — provide upload handler globally
  - `SEARCH_PRODUCTS_KEY` — provide product search handler globally

### Phase 5: Update consumers
- **Layer editors** (ArticleEditor, BlogEditor, ProjectEditor, ExplainerEditor): explicit imports from `@commonpub/editor/vue`, template names changed from `EditorsXxx` to `Xxx`
- **Page files** (docs edit, content edit): explicit imports, template names updated
- **`useMarkdownImport.ts`**: import path updated
- **Explainer package**: all imports updated to `@commonpub/editor/vue`
- Added missing `@tiptap/extension-paragraph` peer dep

### Phase 6: Tests + Publish + Deploy
- 35 new unit tests for `useBlockEditor` composable
- 26/26 typecheck passing
- 823 server, 211 editor (+35), 181 explainer, 373 protocol, 143 docs tests passing
- Published: `@commonpub/editor@0.6.0`, `@commonpub/explainer@0.7.3`, `@commonpub/layer@0.7.3`
- Deployed to both instances via CI/CD

## Architecture After

```
@commonpub/editor
├── src/                          # Logic layer (unchanged, compiled to dist/)
└── vue/                          # NEW: Vue component layer (shipped as source)
    ├── index.ts                  # Barrel export
    ├── types.ts                  # EditorBlock, BlockEditorOptions, etc.
    ├── provide.ts                # InjectionKeys for customization
    ├── utils.ts                  # sanitizeBlockHtml
    ├── composables/
    │   └── useBlockEditor.ts     # CANONICAL composable
    └── components/
        ├── BlockCanvas.vue       # Main editing surface
        ├── BlockWrapper.vue      # Block toolbar wrapper
        ├── BlockPicker.vue       # Block type selection
        ├── BlockInsertZone.vue   # Drop zone between blocks
        ├── EditorBlocks.vue      # Block library sidebar
        ├── EditorSection.vue     # Collapsible panel section
        ├── EditorShell.vue       # 3-panel layout
        ├── EditorTagInput.vue    # Tag/chip input
        ├── EditorVisibility.vue  # Visibility radio group
        └── blocks/               # 20 block editor components
```

Layer after:
```
layers/base/components/editors/
├── ArticleEditor.vue       # Imports from @commonpub/editor/vue
├── BlogEditor.vue          # Same
├── ProjectEditor.vue       # Same
├── ExplainerEditor.vue     # Same
├── MarkdownImportDialog.vue # Stays (Nuxt $fetch)
└── DocsPageTree.vue         # Stays (docs-specific)
```

## Customization Points

1. **`blockDefaults` option**: Pass to `useBlockEditor()` to override default content per block type
2. **`onUpload` prop**: BlockCanvas passes it to ImageBlock/GalleryBlock
3. **`onSearchProducts` prop**: BlockCanvas passes it to PartsListBlock
4. **provide/inject**: Use `BLOCK_COMPONENTS_KEY` to override individual block components, `UPLOAD_HANDLER_KEY`/`SEARCH_PRODUCTS_KEY` for handlers

## Files Changed

- 51 files: 715 insertions, 664 deletions
- 29 files moved from layer to package
- 4 files deleted (old composable duplicates)
- 1 new test file (35 tests)
- 8 files updated (layer/explainer imports)

### Post-audit fixes (same session)
- MarkdownBlock: normalized props from `{ source: string }` to `Record<string, unknown>` → published @0.6.1
- test-site: 8 files with broken imports fixed (gitignored, local only)
- BlockInsertZone `drop` — confirmed working via Vue 3 fallthrough attrs (not a bug)

### Playground added
- `packages/editor/playground/` — Vite dev server at port 4201
- Three views: Block Editor (full EditorShell + BlockCanvas), Components (12 block showcase), Data (live JSON)
- Mock upload handler via `provide(UPLOAD_HANDLER_KEY, ...)` using FileReader data URLs
- Run: `pnpm --filter='@commonpub/editor' playground`

## Next Steps

- Session 112: Docs cleanup + content import expansion
- Session 113: Explainer Sprint 4 integration
