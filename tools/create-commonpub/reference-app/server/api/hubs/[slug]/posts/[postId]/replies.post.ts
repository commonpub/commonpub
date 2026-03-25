import { createReply } from '@commonpub/server';
import type { HubReplyItem } from '@commonpub/server';
import { createReplySchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubReplyItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const { postId } = parseParams(event, { postId: 'uuid' });
  const body = await readBody(event);

  const parsed = createReplySchema.safeParse({ ...body, postId });
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return createReply(db, user.id, parsed.data);
});
