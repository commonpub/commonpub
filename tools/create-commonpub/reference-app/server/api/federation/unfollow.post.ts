import { unfollowRemote } from '@commonpub/server';
import { z } from 'zod';

const unfollowSchema = z.object({
  actorUri: z.string().url(),
});

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireFeature('federation');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { actorUri } = await parseBody(event, unfollowSchema);

  await unfollowRemote(db, user.id, actorUri, config.instance.domain);
  return { success: true };
});
