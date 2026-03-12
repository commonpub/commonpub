# ADR-005: TipTap for Block Editor, CodeMirror for Docs

## Status

Accepted

## Context

Need rich content editing for projects/articles (block-based) and docs (markdown). hack-build has 13 block types and editor infrastructure to port.

## Decision

TipTap for block-based content editing in `@commonpub/editor`. CodeMirror 6 for raw markdown editing in `@commonpub/docs`.

## Rationale

- TipTap is framework-agnostic and extensible for custom block types
- hack-build's 13 block types + 16 interactive modules already designed
- Separate packages: @commonpub/editor (TipTap) and @commonpub/docs (CodeMirror)
- Tree-shakeable: read-only views don't bundle editor code
- CodeMirror 6 is the best-in-class code/markdown editor

## Consequences

- Content stored as TipTap JSON (not markdown) for projects/articles
- Docs stored as raw markdown (Standing Rule #4)
- @commonpub/editor separate from @commonpub/ui for tree-shaking
- Explainer modules in @commonpub/explainer for self-contained HTML export
