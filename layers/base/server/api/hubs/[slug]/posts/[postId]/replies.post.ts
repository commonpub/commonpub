import { createReply, federateHubPostReply } from '@commonpub/server';
import type { HubReplyItem } from '@commonpub/server';
import { createReplySchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubReplyItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { slug, postId } = parseParams(event, { slug: 'string', postId: 'uuid' });
  const body = await readBody(event);

  const parsed = createReplySchema.safeParse({ ...body, postId });
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  const reply = await createReply(db, user.id, parsed.data);

  // Federate the reply as Create(Note) with inReplyTo (fire-and-forget)
  if (config.features.federation && config.features.federateHubs) {
    federateHubPostReply(db, user.id, parsed.data.content, postId, slug, config.instance.domain).catch((err) => {
      console.error('[hub-federation] Failed to federate post reply:', err);
    });
  }

  return reply;
});
