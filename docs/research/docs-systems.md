# Docs Systems Research

## Prior Art

### Docusaurus (Meta)

- File-system routing with MDX
- Versioning by copying entire docs directory (snapshot model)
- Sidebar config as separate `sidebars.js` (nav as separate structure)
- Algolia DocSearch for search
- Frontmatter: `title`, `description`, `sidebar_label`, `sidebar_position`, `slug`
- Plugin architecture for custom content types

### VitePress (Vue)

- File-system routing with Markdown + Vue SFC
- Sidebar defined in `config.ts` (not derived from files)
- Built-in local search via MiniSearch (heading + content extraction)
- Frontmatter for metadata overrides
- Versioning via branches or subdirectories (manual)

### Mintlify

- MDX-based, hosted SaaS
- Navigation defined in `mint.json` (centralized nav config)
- Built-in search with heading extraction
- API reference auto-generation from OpenAPI
- Versioning via tabs/groups

### Nextra (Vercel)

- File-system routing with MDX
- `_meta.json` files for nav ordering (co-located with pages)
- Built-in Flexsearch for full-text search
- Frontmatter for page metadata
- No built-in versioning

### GitBook

- Web-based editor (WYSIWYG + Markdown)
- Database-backed content (not files)
- Versioning via "change requests" (branch model)
- Built-in search via content indexing
- Navigation as drag-and-drop tree

## Key Takeaways

1. **DB-backed vs file-system routing**: GitBook uses DB-backed content, others use files. For CommonPub, DB-backed is the right choice since we already have `docsPages` table with raw markdown (Standing Rule 4).

2. **Versioning by snapshot**: Docusaurus copies entire directory; we copy all pages when creating a new version. This is simpler than branch-based versioning and matches our `docsVersions` table design.

3. **Nav as separate structure**: All major systems separate navigation from content. Our `docsNav.structure` JSONB is the source of truth, with `docsPages.parentId` + `sortOrder` as fallback.

4. **Search via heading extraction + FTS**: VitePress/Nextra extract headings for search. Postgres FTS on `docsPages.content` + heading extraction gives us good search in v1 without Meilisearch.

5. **Frontmatter for metadata**: Universal pattern. Extract `title`, `description`, `sidebar_label`, `sidebar_position` from YAML frontmatter to override DB fields.

6. **Rendering pipeline**: unified/remark/rehype is the standard for programmatic Markdown processing. Shiki for syntax highlighting (used by VitePress, Astro).

7. **Editor**: CodeMirror 6 is the standard for web-based code/markdown editing (used by GitBook, many others). Keeps package pure TS; editor is app-layer concern.
