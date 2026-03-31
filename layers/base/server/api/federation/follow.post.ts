import { sendFollow } from '@commonpub/server';
import { z } from 'zod';

const followSchema = z.object({
  actorUri: z.string().url(),
});

export default defineEventHandler(async (event): Promise<{ id: string }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { actorUri } = await parseBody(event, followSchema);

  return sendFollow(db, user.id, actorUri, config.instance.domain);
});
