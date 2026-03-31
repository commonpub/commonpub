import { users, follows } from '@commonpub/schema';
import { sql, desc, ilike, or, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { escapeLike } from '@commonpub/server';

const usersQuerySchema = z.object({
  q: z.string().max(200).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const query = parseQueryParams(event, usersQuerySchema);

  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;
  const search = query.q || query.search;

  const conditions = [isNull(users.deletedAt)];
  if (search) {
    const term = `%${escapeLike(search)}%`;
    conditions.push(or(ilike(users.username, term), ilike(users.displayName, term))!);
  }

  const where = and(...conditions);

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      headline: users.headline,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  // Get follower counts in bulk
  const userIds = rows.map((r) => r.id);
  const followerCounts: Record<string, number> = {};

  if (userIds.length > 0) {
    const counts = await db
      .select({
        followingId: follows.followingId,
        count: sql<number>`count(*)::int`,
      })
      .from(follows)
      .where(sql`${follows.followingId} = ANY(ARRAY[${sql.join(userIds.map((id) => sql`${id}::uuid`), sql`, `)}])`)
      .groupBy(follows.followingId);

    for (const c of counts) {
      followerCounts[c.followingId] = c.count;
    }
  }

  const items = rows.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.displayName,
    headline: r.headline,
    avatarUrl: r.avatarUrl,
    followerCount: followerCounts[r.id] ?? 0,
  }));

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(where);

  return { items, total: countResult?.count ?? items.length };
});
