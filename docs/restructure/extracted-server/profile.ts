import { eq, and, sql } from 'drizzle-orm';
import { contentItems, users, follows } from '@commonpub/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ContentListItem, UserProfile } from '../types';
import { listContent } from './content';

type DB = NodePgDatabase<Record<string, unknown>>;

export async function getUserByUsername(db: DB, username: string): Promise<UserProfile | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (rows.length === 0) return null;

  const user = rows[0]!;

  // Get content counts by type
  const contentCounts = await db
    .select({
      type: contentItems.type,
      count: sql<number>`count(*)::int`,
    })
    .from(contentItems)
    .where(and(eq(contentItems.authorId, user.id), eq(contentItems.status, 'published')))
    .groupBy(contentItems.type);

  const countMap: Record<string, number> = {};
  for (const row of contentCounts) {
    countMap[row.type] = row.count;
  }

  // Get follower/following counts
  const [followerResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followingId, user.id));

  const [followingResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followerId, user.id));

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio ?? null,
    createdAt: user.createdAt,
    stats: {
      projects: countMap['project'] ?? 0,
      guides: countMap['guide'] ?? 0,
      explainers: countMap['explainer'] ?? 0,
      articles: countMap['article'] ?? 0,
      followers: followerResult?.count ?? 0,
      following: followingResult?.count ?? 0,
    },
  };
}

export async function getUserContent(
  db: DB,
  userId: string,
  type?: string,
): Promise<{ items: ContentListItem[]; total: number }> {
  return listContent(db, {
    authorId: userId,
    status: 'published',
    type,
    limit: 20,
  });
}
