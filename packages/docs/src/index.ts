// Types
export type {
  NavItem,
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
} from './types';

// Validators
export {
  createDocsSiteSchema,
  updateDocsSiteSchema,
  createDocsVersionSchema,
  createDocsPageSchema,
  updateDocsPageSchema,
  docsNavStructureSchema,
  updateDocsNavSchema,
} from './validators';

// Rendering
export { parseFrontmatter } from './render/frontmatter';
export { extractHeadings, generateHeadingId } from './render/headings';
export { renderMarkdown, sanitizeHtml } from './render/pipeline';

// Navigation
export {
  buildPageTree,
  buildBreadcrumbs,
  buildPagePath,
  flattenNav,
  getPrevNextLinks,
} from './navigation/tree';

// Versioning
export {
  validateVersionString,
  compareVersions,
  selectDefaultVersion,
  prepareVersionCopy,
} from './versioning/manager';

// Search
export { stripMarkdown, buildSearchDocument, buildSearchQuery } from './search/indexer';

// Search adapters
export type {
  SearchAdapter,
  SearchResult,
  SearchAdapterConfig,
  MeiliSearchClient,
  MeiliIndex,
} from './search/types';
export { PostgresSearchAdapter } from './search/postgresAdapter';
export type { SqlTagFn } from './search/postgresAdapter';
export { MeilisearchSearchAdapter } from './search/meilisearchAdapter';
export { createSearchAdapter } from './search/factory';
