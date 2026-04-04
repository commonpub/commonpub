import { searchContent } from '@commonpub/server';
import type { ContentSearchResult, ContentSearchOptions } from '@commonpub/server';
import { z } from 'zod';

const searchQuerySchema = z.object({
  q: z.string().max(200).optional(),
  type: z.string().optional(),
  sort: z.enum(['relevance', 'recent', 'popular']).optional(),
  difficulty: z.string().optional(),
  tags: z.string().optional(),
  author: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<{ items: ContentSearchResult[]; total: number }> => {
  const db = useDB();
  const params = parseQueryParams(event, searchQuerySchema);
  const q = params.q?.trim();

  if (!q) {
    return { items: [], total: 0 };
  }

  // Get Meilisearch client if configured
  let meiliClient = null;
  try {
    const meiliUrl = process.env.MEILI_URL;
    const meiliKey = process.env.MEILI_MASTER_KEY;
    if (meiliUrl) {
      const { MeiliSearch } = await import('meilisearch');
      meiliClient = new MeiliSearch({ host: meiliUrl, apiKey: meiliKey });
    }
  } catch {
    // Meilisearch not available — will use Postgres fallback
  }

  const opts: ContentSearchOptions = {
    query: q,
    type: params.type,
    difficulty: params.difficulty,
    tags: params.tags?.split(',').map(t => t.trim()).filter(Boolean),
    authorUsername: params.author,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    sort: (params.sort as ContentSearchOptions['sort']) ?? 'relevance',
    limit: params.limit,
    offset: params.offset,
  };

  return searchContent(db, opts, meiliClient);
});
