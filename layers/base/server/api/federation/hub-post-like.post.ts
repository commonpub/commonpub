import { toggleFederatedHubPostLike, getFederatedHub, getFederatedHubPost } from '@commonpub/server';
import { z } from 'zod';

const schema = z.object({
  federatedHubPostId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ success: boolean; liked: boolean }> => {
  requireFeature('federation');
  requireFeature('federateHubs');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { federatedHubPostId } = await parseBody(event, schema);

  // Gate the interaction on parent-hub visibility: don't allow liking a post that
  // belongs to a hidden/unfollowed federated hub (mirrors hub-post-reply + the §2e
  // read-route gating).
  const post = await getFederatedHubPost(db, federatedHubPostId);
  if (!post || !(await getFederatedHub(db, post.federatedHubId))) {
    throw createError({ statusCode: 404, statusMessage: 'Post not found' });
  }

  const localActorUri = `https://${config.instance.domain}/users/${user.username}`;

  try {
    const { liked } = await toggleFederatedHubPostLike(db, federatedHubPostId, user.id, localActorUri);
    return { success: true, liked };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Post not found') {
      throw createError({ statusCode: 404, statusMessage: 'Post not found' });
    }
    throw err;
  }
});
