// Types
export type {
  PageTreeNode,
  BreadcrumbItem,
  PrevNextLinks,
  TocEntry,
  RenderOptions,
  RenderResult,
  PageFrontmatter,
  SearchDocument,
  VersionInfo,
  DocsPage,
  DocsSite,
} from './types.js';

// Validators
export {
  createDocsSiteSchema,
  updateDocsSiteSchema,
  createDocsVersionSchema,
  createDocsPageSchema,
  updateDocsPageSchema,
} from './validators.js';

// Rendering
export { parseFrontmatter } from './render/frontmatter.js';
export { extractHeadings, generateHeadingId } from './render/headings.js';
export { renderMarkdown } from './render/pipeline.js';

// Navigation
export {
  buildPageTree,
  buildBreadcrumbs,
  buildPagePath,
} from './navigation/tree.js';

// Versioning
export {
  validateVersionString,
  compareVersions,
  selectDefaultVersion,
  prepareVersionCopy,
} from './versioning/manager.js';

// Search
export { stripMarkdown, stripBlockTuples, buildSearchDocument, buildSearchQuery } from './search/indexer.js';

// Search adapters
export type {
  SearchAdapter,
  SearchResult,
  SearchAdapterConfig,
  MeiliSearchClient,
  MeiliIndex,
} from './search/types.js';
export { PostgresSearchAdapter } from './search/postgresAdapter.js';
export type { SqlTagFn } from './search/postgresAdapter.js';
export { MeilisearchSearchAdapter } from './search/meilisearchAdapter.js';
export { createSearchAdapter } from './search/factory.js';
