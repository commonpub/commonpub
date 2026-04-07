import { sendPostToRemoteHub, getFederatedHubPost, getFederatedHub, createFederatedHubPostReply } from '@commonpub/server';
import type { FederatedHubPostReplyItem } from '@commonpub/server';
import { z } from 'zod';

const replySchema = z.object({
  federatedHubPostId: z.string().uuid(),
  content: z.string().min(1).max(10000),
  parentId: z.string().uuid().optional(),
});

export default defineEventHandler(async (event): Promise<FederatedHubPostReplyItem> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { federatedHubPostId, content, parentId } = await parseBody(event, replySchema);

  const post = await getFederatedHubPost(db, federatedHubPostId);
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Post not found' });
  }

  const hub = await getFederatedHub(db, post.federatedHubId);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  // Store locally
  const reply = await createFederatedHubPostReply(db, user.id, {
    federatedHubPostId,
    content,
    parentId,
  });

  // Send via AP (fire-and-forget — don't block on remote delivery)
  sendPostToRemoteHub(
    db,
    user.id,
    user.username,
    hub.actorUri,
    content,
    config.instance.domain,
    'text',
    post.objectUri,
  ).catch(() => { /* best-effort federation delivery */ });

  return reply;
});
