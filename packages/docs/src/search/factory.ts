import type { SearchAdapter, SearchAdapterConfig } from './types.js';
import { PostgresSearchAdapter } from './postgresAdapter.js';
import type { SqlTagFn } from './postgresAdapter.js';
import { MeilisearchSearchAdapter } from './meilisearchAdapter.js';

/**
 * Create a search adapter based on the provided configuration.
 *
 * - If `meiliClient` is provided, returns a MeilisearchSearchAdapter.
 * - If `db` is provided (with a `sqlTag`), returns a PostgresSearchAdapter.
 * - Throws if neither is provided.
 */
export function createSearchAdapter(
  config: SearchAdapterConfig & { sqlTag?: SqlTagFn; language?: string },
): SearchAdapter {
  if (config.meiliClient) {
    return new MeilisearchSearchAdapter(config.meiliClient);
  }

  if (config.db) {
    if (!config.sqlTag) {
      throw new Error(
        'PostgresSearchAdapter requires a sqlTag function (import { sql } from "drizzle-orm")',
      );
    }

    return new PostgresSearchAdapter(
      config.db as { execute(query: unknown): Promise<{ rows: Array<Record<string, unknown>> }> },
      config.sqlTag,
      config.language,
    );
  }

  throw new Error('createSearchAdapter requires either meiliClient or db in config');
}
