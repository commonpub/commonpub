import { federatedHubPostLikes } from '@commonpub/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

export default defineEventHandler(async (event): Promise<{ likedPostIds: string[] }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();

  const query = getQuery(event);
  const postIds = z.string().parse(query.postIds ?? '').split(',').filter(Boolean);

  if (postIds.length === 0) return { likedPostIds: [] };

  const liked = await db
    .select({ postId: federatedHubPostLikes.postId })
    .from(federatedHubPostLikes)
    .where(and(
      eq(federatedHubPostLikes.userId, user.id),
      inArray(federatedHubPostLikes.postId, postIds),
    ));

  return { likedPostIds: liked.map(l => l.postId) };
});
