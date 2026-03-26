import { likeRemoteContent } from '@commonpub/server';
import { z } from 'zod';

const likeSchema = z.object({
  federatedContentId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { federatedContentId } = await parseBody(event, likeSchema);

  const success = await likeRemoteContent(db, user.id, federatedContentId, config.instance.domain);
  if (!success) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found' });
  }

  return { success };
});
