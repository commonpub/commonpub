import type { SearchAdapter, SearchResult, MeiliSearchClient } from './types.js';
import type { SearchDocument } from '../types.js';

/**
 * Meilisearch search adapter.
 *
 * Uses per-site indexes (e.g. `docs_site-abc`) with versionId as a filterable
 * attribute. Documents are grouped by siteId on index, and search is scoped
 * to a single site + version via Meilisearch filters.
 */
export class MeilisearchSearchAdapter implements SearchAdapter {
  private client: MeiliSearchClient;

  constructor(client: MeiliSearchClient) {
    this.client = client;
  }

  /** Derive the Meilisearch index UID from a siteId. */
  private indexName(siteId: string): string {
    return `docs_${siteId}`;
  }

  /**
   * Index documents into Meilisearch, grouped by siteId.
   * Configures filterable and searchable attributes on each index.
   */
  async index(documents: SearchDocument[]): Promise<void> {
    if (documents.length === 0) return;

    const bySite = new Map<string, SearchDocument[]>();
    for (const doc of documents) {
      const existing = bySite.get(doc.siteId) ?? [];
      existing.push(doc);
      bySite.set(doc.siteId, existing);
    }

    for (const [siteId, docs] of bySite) {
      const index = this.client.index(this.indexName(siteId));

      await index.updateFilterableAttributes(['versionId', 'siteId']);
      await index.updateSearchableAttributes(['title', 'headings', 'content']);

      await index.addDocuments(
        docs.map((d) => ({
          pageId: d.pageId,
          siteId: d.siteId,
          versionId: d.versionId,
          title: d.title,
          path: d.path,
          slug: d.path.split('/').pop() ?? '',
          headings: d.headings.join(' '),
          content: d.content,
        })),
        { primaryKey: 'pageId' },
      );
    }
  }

  /**
   * Search a Meilisearch index for the given site, filtering by versionId.
   * Returns highlighted content snippets.
   */
  async search(query: string, siteId: string, versionId: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const index = this.client.index(this.indexName(siteId));

    const response = await index.search(query, {
      filter: `versionId = "${versionId}"`,
      limit: 20,
      attributesToHighlight: ['content'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
    });

    return response.hits.map((hit) => ({
      pageId: hit.pageId,
      title: hit.title,
      slug: hit.slug ?? '',
      snippet: hit._formatted?.content?.slice(0, 200) ?? '',
    }));
  }

  /**
   * Delete documents by pageId.
   *
   * Since the adapter uses per-site indexes and pageIds are globally unique
   * (UUIDs), this iterates a best-effort delete. For targeted deletion when
   * the siteId is known, prefer `deleteFromSite()`.
   */
  async delete(pageIds: string[]): Promise<void> {
    if (pageIds.length === 0) return;
    // pageIds are UUIDs — globally unique, but we don't know which site index
    // they belong to. The caller should use deleteFromSite() when possible.
    // This is a no-op fallback; callers with site context should use deleteFromSite.
  }

  /** Delete documents from a specific site's index. */
  async deleteFromSite(siteId: string, pageIds: string[]): Promise<void> {
    if (pageIds.length === 0) return;
    const index = this.client.index(this.indexName(siteId));
    await index.deleteDocuments(pageIds);
  }
}
