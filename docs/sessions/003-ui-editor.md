# Session 003: Core UI Kit + Block Editor (Phase 3)

## Date: 2026-03-09

## What Was Done

### Research & ADRs

- Created 3 research documents:
  - `docs/research/svelte-5-component-libraries.md` — Headless component patterns, svelte-package build
  - `docs/research/tiptap-svelte-5-integration.md` — Pure TS editor strategy, no Svelte adapter needed
  - `docs/research/svelte-component-testing.md` — @testing-library/svelte v5 + axe-core testing stack
- Created 2 ADRs:
  - `docs/adr/011-svelte-build-system.md` — svelte-package replaces tsc for @commonpub/ui
  - `docs/adr/012-tiptap-architecture.md` — Pure TypeScript editor with BlockTuple serialization

### @commonpub/ui — 15 Headless Components (116 tests)

- **Build infrastructure**: svelte-package, svelte-check, @sveltejs/vite-plugin-svelte in vitest, jsdom with browser resolve conditions
- **Components** (all accept `class` prop, all use `var(--*)` tokens):
  1. VisuallyHidden — Screen-reader-only content
  2. Button — Variants (primary/secondary/ghost/danger), sizes (sm/md/lg), loading state
  3. IconButton — Square toolbar button, requires aria-label
  4. Input — Text input with label association, error state, aria-invalid
  5. Textarea — Multi-line input with label, error state
  6. Select — Headless listbox with keyboard nav (arrows, Home, End, type-ahead, Escape)
  7. Tooltip — Show on hover/focus, hide on blur/Escape, role=tooltip
  8. Popover — Toggle trigger, focus trap, Escape/click-outside to close
  9. Menu — ARIA menu pattern with arrow key nav, type-ahead
  10. MenuItem — role=menuitem, Enter/Space activation, disabled state
  11. Dialog — role=dialog, aria-modal, focus trap, Escape to close, return focus
  12. Tabs — role=tablist/tab/tabpanel, arrow key nav, aria-selected
  13. Badge — Structural variant component (default/primary/success/warning/danger)
  14. Avatar — role=img, image with fallback initials from name
  15. Stack — Flex layout with direction, gap, align, justify props
  16. Separator — role=separator, horizontal/vertical orientation

### @commonpub/editor — Block Type System + Extensions (69 tests)

- **Block type system**: BlockTuple type, BlockDefinition interface, Zod content schemas
- **6 core block types** with schemas: text, heading, code, image, quote, callout
- **Block registry**: register, lookup, list, validate, clearRegistry, registerCoreBlocks
- **Serialization**: blockTuplesToDoc, docToBlockTuples, validateBlockTuples, buildEditorSchema
- **6 TipTap extensions**: CommonPubText, CommonPubHeading, CommonPubCodeBlock, CommonPubImage, CommonPubQuote, CommonPubCallout
  - Input rules: `# ` for headings, ` ``` ` for code, `> ` for quotes, `:::variant` for callouts
  - Keyboard shortcuts: Mod-Alt-1..4 for headings, Mod-Alt-c for code, Mod-Shift-b for quote
- **Editor factory**: createCommonPubEditor() with content loading, onUpdate callback, extensibility
- **Type-safe commands**: Proper TypeScript module augmentation for all custom commands

## Decisions Made

- Used `axe-core` directly instead of `vitest-axe` (v0.1.0 had empty dist, broken package)
- Svelte 5 snippets (`{@render children()}`) used for component composition; tests pass empty functions as snippets since testing-library doesn't need to render them
- Tabs component removed dynamic slot names (Svelte 5 doesn't support them) — tab panels are structural only, content rendering is the consumer's concern
- Editor extensions use TypeScript module augmentation (`declare module '@tiptap/core'`) for proper command typing
- Vitest excludes `.svelte-kit` and `dist` directories to prevent duplicate test runs

## Test Summary

| Package                         | Tests   | Files  |
| ------------------------------- | ------- | ------ |
| @commonpub/schema                | 43      | 2      |
| @commonpub/config                | 17      | 1      |
| @commonpub/auth                  | 42      | 6      |
| @commonpub/protocol              | 42      | 6      |
| @commonpub/test-utils            | 14      | 2      |
| @commonpub/ui                    | 116     | 16     |
| @commonpub/editor                | 69      | 11     |
| Stubs (docs/explainer/learning) | 3       | 3      |
| **Total**                       | **346** | **47** |

## Open Questions

- Svelte 5 snippet testing could be improved — currently passing empty functions. A test harness component pattern might be better for testing children rendering.
- The `.svelte-kit/__package__` build output from svelte-package could be committed (it generates dist-like output for package consumers) or gitignored.

## Next Steps

- Phase 4: Reference App + Content System
  - Svelte NodeView rendering for editor blocks
  - SvelteKit routes for content CRUD
  - Floating toolbar, slash command menu
  - Drag-and-drop reorder
