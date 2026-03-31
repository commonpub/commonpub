import { activities, followRelationships, instanceMirrors, federatedContent } from '@commonpub/schema';
import { sql } from 'drizzle-orm';

/**
 * GET /api/federation/health
 * Public health check for federation status. No auth required.
 */
export default defineEventHandler(async (event) => {
  const config = useConfig();
  if (!config.features.federation) {
    return { enabled: false };
  }

  const db = useDB();

  const [activityStats] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${activities.direction} = 'outbound' and ${activities.status} = 'pending')`,
      delivered: sql<number>`count(*) filter (where ${activities.direction} = 'outbound' and ${activities.status} = 'delivered')`,
      failed: sql<number>`count(*) filter (where ${activities.direction} = 'outbound' and ${activities.status} = 'failed')`,
      inbound: sql<number>`count(*) filter (where ${activities.direction} = 'inbound')`,
    })
    .from(activities);

  const [followStats] = await db
    .select({
      followers: sql<number>`count(*) filter (where ${followRelationships.status} = 'accepted')`,
    })
    .from(followRelationships);

  const [mirrorStats] = await db
    .select({
      active: sql<number>`count(*) filter (where ${instanceMirrors.status} = 'active')`,
    })
    .from(instanceMirrors);

  const [contentStats] = await db
    .select({
      total: sql<number>`count(*)`,
    })
    .from(federatedContent);

  return {
    enabled: true,
    domain: config.instance.domain,
    activities: {
      pending: Number(activityStats?.pending ?? 0),
      delivered: Number(activityStats?.delivered ?? 0),
      failed: Number(activityStats?.failed ?? 0),
      inbound: Number(activityStats?.inbound ?? 0),
    },
    followers: Number(followStats?.followers ?? 0),
    mirrors: Number(mirrorStats?.active ?? 0),
    federatedContent: Number(contentStats?.total ?? 0),
  };
});
