import { buildSearchQuery } from './indexer.js';
import type { SearchAdapter, SearchResult } from './types.js';
import type { SearchDocument } from '../types.js';

/**
 * Drizzle DB instance — typed as an object with an `execute` method
 * to avoid importing drizzle-orm at the package level.
 */
interface DrizzleDB {
  execute(query: unknown): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/**
 * Tagged template for building SQL — mirrors drizzle-orm's `sql` tagged template.
 * The adapter accepts a pre-bound `sqlTag` function so it doesn't depend on drizzle-orm.
 */
export type SqlTagFn = (strings: TemplateStringsArray, ...values: unknown[]) => unknown;

/**
 * Postgres FTS search adapter.
 *
 * Searches live data via `to_tsvector` / `to_tsquery` — no separate index needed.
 * The `index()` and `delete()` methods are intentional no-ops.
 */
export class PostgresSearchAdapter implements SearchAdapter {
  private db: DrizzleDB;
  private sql: SqlTagFn;

  constructor(db: DrizzleDB, sqlTag: SqlTagFn) {
    this.db = db;
    this.sql = sqlTag;
  }

  /** No-op: Postgres FTS searches live data, no separate index needed. */
  async index(_documents: SearchDocument[]): Promise<void> {
    // Intentional no-op
  }

  async search(query: string, siteId: string, versionId: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const tsQuery = buildSearchQuery(query);
    if (!tsQuery) return [];

    const result = await this.db.execute(
      this.sql`
        SELECT
          dp.id AS "pageId",
          dp.title,
          dp.slug,
          ts_headline(
            'english',
            dp.content,
            to_tsquery('english', ${tsQuery}),
            'MaxWords=30, MinWords=15'
          ) AS snippet
        FROM docs_pages dp
        INNER JOIN docs_versions dv ON dp.version_id = dv.id
        WHERE dp.version_id = ${versionId}
          AND dv.site_id = ${siteId}
          AND to_tsvector('english', dp.title || ' ' || dp.content)
              @@ to_tsquery('english', ${tsQuery})
        LIMIT 20
      `,
    );

    return result.rows.map((r) => ({
      pageId: r.pageId as string,
      title: r.title as string,
      slug: r.slug as string,
      snippet: r.snippet as string,
    }));
  }

  /** No-op: Postgres FTS searches live data, no separate index to clean up. */
  async delete(_pageIds: string[]): Promise<void> {
    // Intentional no-op
  }
}
