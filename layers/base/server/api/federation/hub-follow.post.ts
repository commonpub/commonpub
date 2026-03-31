import { sendHubFollow, getFederatedHub } from '@commonpub/server';
import { z } from 'zod';

const schema = z.object({
  federatedHubId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ success: boolean; status: string }> => {
  requireFeature('federation');
  requireFeature('federateHubs');
  requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { federatedHubId } = await parseBody(event, schema);

  const hub = await getFederatedHub(db, federatedHubId);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Federated hub not found' });
  }

  if (hub.followStatus === 'accepted') {
    return { success: true, status: 'accepted' };
  }

  await sendHubFollow(db, hub.actorUri, config.instance.domain);
  return { success: true, status: 'pending' };
});
