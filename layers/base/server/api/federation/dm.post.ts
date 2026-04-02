import { federateDirectMessage, resolveRemoteHandle } from '@commonpub/server';
import { z } from 'zod';

const dmSchema = z.object({
  handle: z.string().min(3),
  body: z.string().min(1).max(10000),
});

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const input = await parseBody(event, dmSchema);

  const resolved = await resolveRemoteHandle(db, input.handle, config.instance.domain);
  if (!resolved) {
    throw createError({ statusCode: 404, statusMessage: 'Could not resolve remote user' });
  }

  await federateDirectMessage(db, user.id, resolved.actorUri, input.body, config.instance.domain);

  return {
    sent: true,
    recipientActorUri: resolved.actorUri,
    recipientName: resolved.displayName ?? resolved.preferredUsername ?? input.handle,
  };
});
