import { toggleFederatedHubPostLike } from '@commonpub/server';
import { z } from 'zod';

const schema = z.object({
  federatedHubPostId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ success: boolean; liked: boolean }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { federatedHubPostId } = await parseBody(event, schema);

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
