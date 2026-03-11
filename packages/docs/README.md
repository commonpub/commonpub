# @snaplify/docs

Pluggable documentation site module for Snaplify.

## Overview

Everything needed to run versioned documentation sites within a Snaplify instance: markdown rendering (unified + remark + rehype + shiki), hierarchical navigation, version management, and search with pluggable adapters (Meilisearch primary, Postgres FTS fallback).

Docs are stored as raw markdown, never TipTap JSON.

## Installation

```bash
pnpm add @snaplify/docs
```

## Usage

### Markdown Rendering

```ts
import { renderMarkdown } from '@snaplify/docs';

const result = await renderMarkdown('# Hello\n\nSome **bold** text.', {
  highlightCode: true,
});
// result.html: rendered HTML with syntax highlighting
// result.headings: extracted heading tree for TOC
```

### Frontmatter Parsing

```ts
import { parseFrontmatter } from '@snaplify/docs';

const { data, content } = parseFrontmatter(`---
title: Getting Started
order: 1
---

Content here...`);
// data: { title: 'Getting Started', order: 1 }
// content: 'Content here...'
```

### Heading Extraction

```ts
import { extractHeadings, generateHeadingId } from '@snaplify/docs';

const headings = extractHeadings(markdownContent);
// [{ level: 2, text: 'Installation', id: 'installation' }, ...]
```

### Navigation

```ts
import {
  buildPageTree,
  buildBreadcrumbs,
  flattenNav,
  getPrevNextLinks,
} from '@snaplify/docs';

// Build a tree from flat page list + nav structure
const tree = buildPageTree(pages, navStructure);

// Generate breadcrumbs for a page
const crumbs = buildBreadcrumbs(tree, currentPageId);

// Get prev/next navigation links
const { prev, next } = getPrevNextLinks(tree, currentPageId);
```

### Versioning

```ts
import {
  validateVersionString,
  compareVersions,
  selectDefaultVersion,
  prepareVersionCopy,
} from '@snaplify/docs';

// Validate semver-like version strings
validateVersionString('1.2.0'); // true

// Compare versions for sorting
compareVersions('2.0.0', '1.5.0'); // 1

// Select the default (latest) version
const latest = selectDefaultVersion(versions);

// Prepare a copy-on-create version snapshot
const newVersion = prepareVersionCopy(existingVersion, '2.0.0');
```

### Search

#### Search Adapter Interface

```ts
import { createSearchAdapter } from '@snaplify/docs';
import type { SearchAdapter, SearchResult } from '@snaplify/docs';

// Auto-select adapter based on environment
const search = createSearchAdapter({
  meiliUrl: process.env.MEILI_URL,      // optional
  meiliKey: process.env.MEILI_MASTER_KEY, // optional
  sql: db,                                // Postgres fallback
});

// Index a document
await search.index(document);

// Search
const results: SearchResult[] = await search.search('query string');
```

#### Meilisearch Adapter

Used when `MEILI_URL` is configured. Full-text search with typo tolerance, ranking, and highlighting.

#### Postgres FTS Adapter

Fallback when Meilisearch is not available. Uses PostgreSQL's built-in `tsvector` + `tsquery` with headline extraction.

#### Building Search Documents

```ts
import { stripMarkdown, buildSearchDocument, buildSearchQuery } from '@snaplify/docs';

// Strip markdown to plain text for indexing
const text = stripMarkdown(markdownContent);

// Build a search document
const doc = buildSearchDocument(page, siteSlug, versionId);
```

### Validators

```ts
import {
  createDocsSiteSchema,
  updateDocsSiteSchema,
  createDocsVersionSchema,
  createDocsPageSchema,
  updateDocsPageSchema,
  docsNavStructureSchema,
  updateDocsNavSchema,
} from '@snaplify/docs';
```

## Development

```bash
pnpm build        # Compile TypeScript
pnpm test         # Run 101 tests
pnpm typecheck    # Type-check without emitting
```

## Dependencies

- `unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-stringify`: Markdown pipeline
- `remark-frontmatter`: YAML frontmatter
- `@shikijs/rehype` + `shiki`: Syntax highlighting
- `rehype-slug`: Auto-generate heading IDs
- `meilisearch`: Meilisearch client
- `yaml`: Frontmatter parsing
- `zod`: Validation
- `@snaplify/config`: Feature flags
- `@snaplify/schema`: Docs table definitions
