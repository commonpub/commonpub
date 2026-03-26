import { federateReply } from '@commonpub/server';
import { z } from 'zod';

const replySchema = z.object({
  federatedContentId: z.string().uuid(),
  content: z.string().min(1).max(10000),
});

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { federatedContentId, content } = await parseBody(event, replySchema);

  const success = await federateReply(db, user.id, federatedContentId, content, config.instance.domain);
  if (!success) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found' });
  }

  return { success };
});
