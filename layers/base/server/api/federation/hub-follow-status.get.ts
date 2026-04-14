import { getFederatedHubFollowStatus } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  federatedHubId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ joined: boolean; status: string | null }> => {
  requireFeature('federation');
  requireFeature('federateHubs');

  const user = getOptionalUser(event);
  if (!user) {
    return { joined: false, status: null };
  }

  const db = useDB();
  const { federatedHubId } = parseQueryParams(event, querySchema);

  return getFederatedHubFollowStatus(db, federatedHubId, user.id);
});
