import { getLikedFederatedHubPostIds } from '@commonpub/server';
import { z } from 'zod';

export default defineEventHandler(async (event): Promise<{ likedPostIds: string[] }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();

  const query = getQuery(event);
  const postIds = z.string().parse(query.postIds ?? '').split(',').filter(Boolean);

  const likedPostIds = await getLikedFederatedHubPostIds(db, user.id, postIds);
  return { likedPostIds };
});
