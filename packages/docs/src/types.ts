/** Navigation item matching docsNav.structure JSONB shape */
export interface NavItem {
  id: string;
  title: string;
  pageId?: string;
  children?: NavItem[];
}

/** Computed tree node from flat pages */
export interface PageTreeNode {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  parentId: string | null;
  children: PageTreeNode[];
}

/** Breadcrumb navigation entry */
export interface BreadcrumbItem {
  title: string;
  slug: string;
  path: string;
}

/** Previous/next page links */
export interface PrevNextLinks {
  prev: { title: string; path: string } | null;
  next: { title: string; path: string } | null;
}

/** Table of contents entry extracted from headings */
export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

/** Options for the markdown rendering pipeline */
export interface RenderOptions {
  highlightTheme?: string;
  enableMermaid?: boolean;
  baseUrl?: string;
}

/** Result of rendering markdown */
export interface RenderResult {
  html: string;
  toc: TocEntry[];
  frontmatter: PageFrontmatter;
}

/** Parsed YAML frontmatter fields */
export interface PageFrontmatter {
  title?: string;
  description?: string;
  sidebarLabel?: string;
  sidebarPosition?: number;
}

/** Search document for indexing */
export interface SearchDocument {
  pageId: string;
  siteId: string;
  versionId: string;
  title: string;
  path: string;
  headings: string[];
  content: string;
}

/** Version info for display */
export interface VersionInfo {
  id: string;
  version: string;
  isDefault: boolean;
  createdAt: Date;
  pageCount: number;
}

/** Docs page shape for pure function signatures */
export interface DocsPage {
  id: string;
  versionId: string;
  title: string;
  slug: string;
  /** BlockTuple[] (JSONB) for new pages, legacy string for pre-migration pages */
  content: unknown;
  sortOrder: number;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Docs site shape for pure function signatures */
export interface DocsSite {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  themeTokens: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
}
