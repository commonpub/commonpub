# ADR 020: Docs Architecture

## Status

Accepted

## Context

Phase 9 delivers `@commonpub/docs` — a docs site module with CodeMirror editor, markdown rendering, versioning, and search. The schema tables (`docsSites`, `docsVersions`, `docsPages`, `docsNav`) already exist. This ADR defines the architecture for the pure TS package and reference app integration.

## Decisions

### 1. Content Storage

Raw markdown in `docsPages.content` per Standing Rule 4. No TipTap JSON, no MDX — plain GFM markdown with optional YAML frontmatter.

### 2. Rendering Pipeline

```
unified → remark-parse → remark-gfm → remark-frontmatter → remark-rehype → rehype-shiki → rehype-stringify
```

- Shiki for syntax highlighting (theme-aware, no runtime JS)
- Mermaid diagrams deferred to Phase 9b (dynamic import when detected)
- Pipeline is async, returns `{ html, toc, frontmatter }`

### 3. Navigation

`docsNav.structure` JSONB is the source of truth — a recursive array of `NavItem` objects with `id`, `title`, `pageId?`, `children?`. The `docsPages.parentId` + `sortOrder` columns serve as fallback when no nav structure exists.

### 4. Versioning

Copy-on-create model: creating a new version copies all pages from a source version. Each version is independent after creation. One version per site is marked `isDefault`.

### 5. Search

Postgres full-text search in v1 using `to_tsvector`/`to_tsquery` on `docsPages.content` + `docsPages.title`. Meilisearch integration deferred to Phase 12.

### 6. Editor

CodeMirror 6 lives in reference app components only. The `@commonpub/docs` package stays pure TypeScript — no Svelte or browser dependencies.

### 7. Frontmatter

YAML frontmatter between `---` delimiters. Extracts: `title`, `description`, `sidebar_label`, `sidebar_position`. These override the corresponding DB fields when present.

### 8. Page Paths

Nested via `parentId`. URL structure: `/docs/[siteSlug]/[...pagePath]` where `pagePath` is constructed by walking the parent chain: `/parent-slug/child-slug`.

### 9. Deletion

Hard delete with CASCADE for all docs entities (sites, versions, pages, nav). No soft delete — docs are not content items.

### 10. Ownership

Site owner manages everything. No collaborator model in v1 — single-owner simplicity.

## Consequences

- Pure TS package is reusable outside SvelteKit
- Rendering is server-side only (no client JS for markdown)
- Version copies may duplicate content but are simple to reason about
- Postgres FTS is sufficient for typical docs scale (< 10k pages)
- No real-time collaboration — single owner edits sequentially
