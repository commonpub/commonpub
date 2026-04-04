/**
 * Search indexing plugin.
 * Keeps Meilisearch in sync with content changes via hooks.
 * If Meilisearch is not configured, this plugin is a no-op.
 */
import { onHook, indexContent, removeFromIndex, configureContentIndex } from '@commonpub/server';
import type { MeiliClient } from '@commonpub/server';

export default defineNitroPlugin(async () => {
  if (process.env.NODE_ENV === 'test') return;

  const meiliUrl = process.env.MEILI_URL;
  const meiliKey = process.env.MEILI_MASTER_KEY;

  if (!meiliUrl) {
    console.log('[search-index] Meilisearch not configured — search uses Postgres FTS fallback');
    return;
  }

  let client: MeiliClient;
  try {
    const { MeiliSearch } = await import('meilisearch');
    client = new MeiliSearch({ host: meiliUrl, apiKey: meiliKey }) as unknown as MeiliClient;
    await configureContentIndex(client);
    console.log('[search-index] Meilisearch content index configured');
  } catch (err) {
    console.warn('[search-index] Failed to connect to Meilisearch:', err instanceof Error ? err.message : err);
    return;
  }

  // Index on publish
  onHook('content:published', async ({ db, contentId }) => {
    try {
      await indexContent(db, contentId, client);
    } catch (err) {
      console.warn('[search-index] Failed to index content:', err instanceof Error ? err.message : err);
    }
  });

  // Re-index on update
  onHook('content:updated', async ({ db, contentId }) => {
    try {
      await indexContent(db, contentId, client);
    } catch (err) {
      console.warn('[search-index] Failed to re-index content:', err instanceof Error ? err.message : err);
    }
  });

  // Remove from index on delete
  onHook('content:deleted', async ({ contentId }) => {
    try {
      await removeFromIndex(contentId, client);
    } catch (err) {
      console.warn('[search-index] Failed to remove from index:', err instanceof Error ? err.message : err);
    }
  });
});
