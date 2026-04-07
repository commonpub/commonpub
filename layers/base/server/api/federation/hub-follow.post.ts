import { sendHubFollow, getFederatedHub } from '@commonpub/server';
import { userFederatedHubFollows } from '@commonpub/schema';
import { eq, and } from 'drizzle-orm';
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

  const hub = await getFederatedHub(db, federatedHubId);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Federated hub not found' });
  }

  // Create per-user follow record (upsert)
  const userStatus = hub.followStatus === 'accepted' ? 'joined' : 'pending';
  await db
    .insert(userFederatedHubFollows)
    .values({
      userId: user.id,
      federatedHubId,
      status: userStatus,
    })
    .onConflictDoUpdate({
      target: [userFederatedHubFollows.userId, userFederatedHubFollows.federatedHubId],
      set: { status: userStatus, joinedAt: new Date() },
    });

  // Send instance-level Follow if not already accepted
  if (hub.followStatus !== 'accepted') {
    await sendHubFollow(db, hub.actorUri, config.instance.domain);
  }

  return { success: true, status: userStatus };
});
