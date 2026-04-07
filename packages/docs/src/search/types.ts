import type { SearchDocument } from '../types.js';

/** Search result returned by any adapter */
export interface SearchResult {
  pageId: string;
  title: string;
  slug: string;
  snippet: string;
}

/** Search adapter interface — implemented by Postgres and Meilisearch adapters */
export interface SearchAdapter {
  index(documents: SearchDocument[]): Promise<void>;
  search(query: string, siteId: string, versionId: string, opts?: { limit?: number; offset?: number }): Promise<SearchResult[]>;
  delete(pageIds: string[]): Promise<void>;
}

/** Configuration for search adapter factory */
export interface SearchAdapterConfig {
  /** Meilisearch client instance (from 'meilisearch' package) */
  meiliClient?: MeiliSearchClient;
  /** Drizzle DB instance for Postgres adapter */
  db?: unknown;
}

/** Minimal Meilisearch client interface (duck-typed for loose coupling) */
export interface MeiliSearchClient {
  index(uid: string): MeiliIndex;
}

/** Minimal Meilisearch index interface */
export interface MeiliIndex {
  addDocuments(
    documents: Array<Record<string, unknown>>,
    options?: { primaryKey?: string },
  ): Promise<unknown>;
  search(query: string, options?: Record<string, unknown>): Promise<MeiliSearchResponse>;
  deleteDocuments(ids: string[]): Promise<unknown>;
  updateFilterableAttributes(attributes: string[]): Promise<unknown>;
  updateSearchableAttributes(attributes: string[]): Promise<unknown>;
}

/** Meilisearch search response shape */
export interface MeiliSearchResponse {
  hits: Array<MeiliSearchHit>;
}

/** Single hit from a Meilisearch search response */
export interface MeiliSearchHit {
  pageId: string;
  title: string;
  slug: string;
  _formatted?: {
    content?: string;
    title?: string;
  };
  [key: string]: unknown;
}
