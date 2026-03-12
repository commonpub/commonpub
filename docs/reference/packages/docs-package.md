# @commonpub/docs

> Markdown rendering pipeline, navigation trees, versioning, and search adapters for documentation sites.

**npm**: `@commonpub/docs`
**Source**: `packages/docs/src/`
**Entry**: `packages/docs/src/index.ts`

---

## Exports

### Types

| Export | Kind | Description |
|--------|------|-------------|
| `NavItem` | Type | Navigation tree node |
| `PageTreeNode` | Type | Hierarchical page tree node |
| `BreadcrumbItem` | Type | Breadcrumb path segment |
| `PrevNextLinks` | Type | Previous/next page links |
| `TocEntry` | Type | Table of contents heading entry |
| `RenderOptions` | Type | Markdown rendering options |
| `RenderResult` | Type | Rendered HTML + TOC + frontmatter |
| `PageFrontmatter` | Type | Parsed frontmatter fields |
| `SearchDocument` | Type | Indexable search document |
| `VersionInfo` | Type | Version metadata |
| `DocsPage` | Type | Page data shape |
| `DocsSite` | Type | Site data shape |

### Validators (7)

| Export | Kind | Description |
|--------|------|-------------|
| `createDocsSiteSchema` | Zod Schema | Site creation validator |
| `updateDocsSiteSchema` | Zod Schema | Site update validator |
| `createDocsVersionSchema` | Zod Schema | Version creation validator |
| `createDocsPageSchema` | Zod Schema | Page creation validator |
| `updateDocsPageSchema` | Zod Schema | Page update validator |
| `docsNavStructureSchema` | Zod Schema | Nav tree structure validator |
| `updateDocsNavSchema` | Zod Schema | Nav update validator |

### Rendering (4)

| Export | Kind | Description |
|--------|------|-------------|
| `parseFrontmatter` | Function | Extract YAML frontmatter from markdown |
| `extractHeadings` | Function | Extract heading hierarchy from markdown |
| `generateHeadingId` | Function | Generate URL-safe heading anchor ID |
| `renderMarkdown` | Function | Full markdown → HTML rendering pipeline |
| `sanitizeHtml` | Function | Sanitize rendered HTML |

### Navigation (5)

| Export | Kind | Description |
|--------|------|-------------|
| `buildPageTree` | Function | Build hierarchical page tree from flat list |
| `buildBreadcrumbs` | Function | Generate breadcrumb trail for a page |
| `buildPagePath` | Function | Resolve full URL path for a page |
| `flattenNav` | Function | Flatten nav tree to ordered list |
| `getPrevNextLinks` | Function | Get previous/next page links |

### Versioning (4)

| Export | Kind | Description |
|--------|------|-------------|
| `validateVersionString` | Function | Validate semver-like version string |
| `compareVersions` | Function | Compare two version strings |
| `selectDefaultVersion` | Function | Select the default version from a list |
| `prepareVersionCopy` | Function | Copy pages from one version to create another |

### Search (6)

| Export | Kind | Description |
|--------|------|-------------|
| `stripMarkdown` | Function | Remove markdown syntax for plain text |
| `buildSearchDocument` | Function | Build a searchable document from a page |
| `buildSearchQuery` | Function | Build a search query object |
| `PostgresSearchAdapter` | Class | Postgres FTS search adapter |
| `MeilisearchSearchAdapter` | Class | Meilisearch search adapter |
| `createSearchAdapter` | Function | Factory — creates appropriate adapter |

### Search Types

| Export | Kind | Description |
|--------|------|-------------|
| `SearchAdapter` | Interface | Search adapter contract |
| `SearchResult` | Type | Search result shape |
| `SearchAdapterConfig` | Type | Adapter configuration |
| `MeiliSearchClient` | Type | Meilisearch client type |
| `MeiliIndex` | Type | Meilisearch index type |
| `SqlTagFn` | Type | SQL tagged template type |

---

## API Reference

### Rendering

#### `parseFrontmatter(markdown: string): { content: string; frontmatter: PageFrontmatter }`

Extracts YAML frontmatter from a markdown string. Returns the content without frontmatter and the parsed frontmatter object.

```typescript
interface PageFrontmatter {
  title?: string;
  description?: string;
  order?: number;
  [key: string]: unknown;
}
```

#### `extractHeadings(markdown: string): TocEntry[]`

Extracts a heading hierarchy from markdown content.

```typescript
interface TocEntry {
  id: string;       // URL-safe anchor ID
  text: string;     // Heading text
  level: number;    // 1-6
}
```

#### `generateHeadingId(text: string): string`

Generates a URL-safe anchor ID from heading text (lowercase, hyphens, strip special chars).

#### `renderMarkdown(content: string, options?: RenderOptions): RenderResult`

Full markdown rendering pipeline: frontmatter extraction → markdown → HTML → heading IDs → syntax highlighting → sanitization.

```typescript
interface RenderOptions {
  sanitize?: boolean;    // Default: true
}

interface RenderResult {
  html: string;              // Rendered HTML
  toc: TocEntry[];           // Table of contents
  frontmatter: PageFrontmatter;  // Parsed frontmatter
}
```

#### `sanitizeHtml(html: string): string`

Sanitizes HTML to prevent XSS while preserving safe markup.

### Navigation

#### `buildPageTree(pages: DocsPage[]): PageTreeNode[]`

Builds a hierarchical tree from a flat list of pages using `parentId` references.

```typescript
interface PageTreeNode {
  page: DocsPage;
  children: PageTreeNode[];
}
```

#### `buildBreadcrumbs(pages: DocsPage[], currentPageId: string): BreadcrumbItem[]`

Generates the breadcrumb trail from root to the current page.

```typescript
interface BreadcrumbItem {
  title: string;
  slug: string;
  path: string;
}
```

#### `buildPagePath(pages: DocsPage[], pageId: string): string`

Resolves the full URL path for a page by walking up the parent chain.

#### `flattenNav(navItems: NavItem[]): NavItem[]`

Flattens a hierarchical nav tree into an ordered flat list (for prev/next navigation).

```typescript
interface NavItem {
  id: string;
  title: string;
  slug: string;
  children?: NavItem[];
}
```

#### `getPrevNextLinks(navItems: NavItem[], currentSlug: string): PrevNextLinks`

Gets the previous and next page links relative to the current page in the nav tree.

```typescript
interface PrevNextLinks {
  prev: { title: string; slug: string } | null;
  next: { title: string; slug: string } | null;
}
```

### Versioning

#### `validateVersionString(version: string): boolean`

Validates that a string is a valid version (semver-like format).

#### `compareVersions(a: string, b: string): number`

Compares two version strings. Returns negative if `a < b`, positive if `a > b`, zero if equal.

#### `selectDefaultVersion(versions: VersionInfo[]): VersionInfo`

Selects the default version from a list (uses `isDefault` flag, falls back to latest).

```typescript
interface VersionInfo {
  id: string;
  version: string;
  isDefault: boolean;
}
```

#### `prepareVersionCopy(sourcePages: DocsPage[], newVersionId: string): Omit<DocsPage, 'id'>[]`

Creates copies of all pages from a source version, ready to be inserted under a new version.

### Search

#### `stripMarkdown(markdown: string): string`

Strips all markdown syntax from content, returning plain text for indexing.

#### `buildSearchDocument(page: DocsPage, siteSlug: string): SearchDocument`

Builds a searchable document from a docs page.

```typescript
interface SearchDocument {
  id: string;
  title: string;
  content: string;      // Stripped markdown
  slug: string;
  siteSlug: string;
  path: string;
}
```

#### `buildSearchQuery(query: string): object`

Builds a search query object for the search adapter.

#### `createSearchAdapter(config: SearchAdapterConfig): SearchAdapter`

Factory that creates the appropriate search adapter based on configuration.

```typescript
interface SearchAdapterConfig {
  type: 'postgres' | 'meilisearch';
  // Postgres: requires sql tagged template function
  // Meilisearch: requires client and index name
}

interface SearchAdapter {
  index(documents: SearchDocument[]): Promise<void>;
  search(query: string, siteSlug?: string): Promise<SearchResult[]>;
  remove(documentIds: string[]): Promise<void>;
}

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  path: string;
  score: number;
}
```

#### `PostgresSearchAdapter`

Uses PostgreSQL full-text search (`tsvector`, `tsquery`). Fallback adapter that works without external services.

#### `MeilisearchSearchAdapter`

Uses Meilisearch for fast, typo-tolerant full-text search. Primary adapter for production use.

---

## Internal Architecture

```
packages/docs/src/
├── index.ts                  → All exports
├── types.ts                  → All type definitions
├── validators.ts             → 7 Zod validation schemas
├── render/
│   ├── frontmatter.ts        → parseFrontmatter
│   ├── headings.ts           → extractHeadings, generateHeadingId
│   └── pipeline.ts           → renderMarkdown, sanitizeHtml
├── navigation/
│   └── tree.ts               → buildPageTree, buildBreadcrumbs, buildPagePath, flattenNav, getPrevNextLinks
├── versioning/
│   └── manager.ts            → validateVersionString, compareVersions, selectDefaultVersion, prepareVersionCopy
└── search/
    ├── types.ts              → SearchAdapter interface, SearchResult, config types
    ├── indexer.ts            → stripMarkdown, buildSearchDocument, buildSearchQuery
    ├── postgresAdapter.ts    → PostgresSearchAdapter class
    ├── meilisearchAdapter.ts → MeilisearchSearchAdapter class
    └── factory.ts            → createSearchAdapter
```
