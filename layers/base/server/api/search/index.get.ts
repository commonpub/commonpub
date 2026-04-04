import { searchContent, listHubs, escapeLike } from '@commonpub/server';
import type { ContentSearchOptions, MeiliClient } from '@commonpub/server';
import { users, follows, hubs } from '@commonpub/schema';
import { sql, desc, ilike, or, and, isNull, eq } from 'drizzle-orm';
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

export default defineEventHandler(async (event): Promise<{ items: unknown[]; total: number }> => {
  const db = useDB();
  const config = useConfig();
  const params = parseQueryParams(event, searchQuerySchema);
  const q = params.q?.trim();

  if (!q) {
    return { items: [], total: 0 };
  }

  const limit = Math.min(params.limit ?? 24, 100);
  const offset = params.offset ?? 0;

  // --- Community search ---
  if (params.type === 'community') {
    const includeFederated = !!config.features.seamlessFederation;
    const result = await listHubs(db, { search: q, limit, offset }, { includeFederated });
    return {
      items: result.items.map((hub) => ({
        _resultType: 'community',
        id: hub.id,
        name: hub.name,
        slug: hub.slug,
        description: hub.description,
        iconUrl: hub.iconUrl,
        bannerUrl: hub.bannerUrl,
        memberCount: hub.memberCount,
        postCount: hub.postCount,
        source: (hub as unknown as Record<string, unknown>).source ?? 'local',
      })),
      total: result.total,
    };
  }

  // --- People search ---
  if (params.type === 'people') {
    const term = `%${escapeLike(q)}%`;
    const where = and(
      isNull(users.deletedAt),
      or(ilike(users.username, term), ilike(users.displayName, term)),
    );

    const [rows, countResult] = await Promise.all([
      db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        headline: users.headline,
        avatarUrl: users.avatarUrl,
      })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(where),
    ]);

    // Follower counts
    const userIds = rows.map((r) => r.id);
    const followerCounts: Record<string, number> = {};
    if (userIds.length > 0) {
      const counts = await db
        .select({ followingId: follows.followingId, count: sql<number>`count(*)::int` })
        .from(follows)
        .where(sql`${follows.followingId} = ANY(ARRAY[${sql.join(userIds.map((id) => sql`${id}::uuid`), sql`, `)}])`)
        .groupBy(follows.followingId);
      for (const c of counts) followerCounts[c.followingId] = c.count;
    }

    return {
      items: rows.map((r) => ({
        _resultType: 'person',
        id: r.id,
        username: r.username,
        displayName: r.displayName,
        headline: r.headline,
        avatarUrl: r.avatarUrl,
        followerCount: followerCounts[r.id] ?? 0,
      })),
      total: countResult[0]?.count ?? rows.length,
    };
  }

  // --- Content search (default) ---
  let meiliClient = null;
  try {
    const meiliUrl = process.env.MEILI_URL;
    const meiliKey = process.env.MEILI_MASTER_KEY;
    if (meiliUrl) {
      const { MeiliSearch } = await import('meilisearch');
      meiliClient = new MeiliSearch({ host: meiliUrl, apiKey: meiliKey }) as unknown as MeiliClient;
    }
  } catch { /* Meilisearch not available */ }

  const opts: ContentSearchOptions = {
    query: q,
    type: params.type,
    difficulty: params.difficulty,
    tags: params.tags?.split(',').map(t => t.trim()).filter(Boolean),
    authorUsername: params.author,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    sort: (params.sort as ContentSearchOptions['sort']) ?? 'relevance',
    limit,
    offset,
  };

  const result = await searchContent(db, opts, meiliClient);
  return {
    items: result.items.map((item) => ({ ...item, _resultType: 'content' })),
    total: result.total,
  };
});
