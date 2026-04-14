import { joinFederatedHub } from '@commonpub/server';
import { z } from 'zod';

const schema = z.object({
  federatedHubId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ success: boolean; status: string }> => {
  requireFeature('federation');
  requireFeature('federateHubs');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { federatedHubId } = await parseBody(event, schema);

  try {
    const { status } = await joinFederatedHub(db, federatedHubId, user.id, config.instance.domain);
    return { success: true, status };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Federated hub not found') {
      throw createError({ statusCode: 404, statusMessage: 'Federated hub not found' });
    }
    throw err;
  }
});
