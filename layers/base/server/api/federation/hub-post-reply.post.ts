import { sendPostToRemoteHub, getFederatedHubPost, getFederatedHub } from '@commonpub/server';
import { z } from 'zod';

const replySchema = z.object({
  federatedHubPostId: z.string().uuid(),
  content: z.string().min(1).max(10000),
});

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { federatedHubPostId, content } = await parseBody(event, replySchema);

  const post = await getFederatedHubPost(db, federatedHubPostId);
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Post not found' });
  }

  const hub = await getFederatedHub(db, post.federatedHubId);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const success = await sendPostToRemoteHub(
    db,
    user.id,
    user.username,
    hub.actorUri,
    content,
    config.instance.domain,
    'text',
    post.objectUri,
  );

  if (!success) {
    throw createError({ statusCode: 502, statusMessage: 'Could not reach remote hub' });
  }

  return { success };
});
