import { userFederatedHubFollows } from '@commonpub/schema';
import { eq, and } from 'drizzle-orm';
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

  const [record] = await db
    .select({ status: userFederatedHubFollows.status })
    .from(userFederatedHubFollows)
    .where(
      and(
        eq(userFederatedHubFollows.userId, user.id),
        eq(userFederatedHubFollows.federatedHubId, federatedHubId),
      ),
    )
    .limit(1);

  if (!record) {
    return { joined: false, status: null };
  }

  return { joined: record.status === 'joined', status: record.status };
});
