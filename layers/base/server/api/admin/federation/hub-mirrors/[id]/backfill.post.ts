import { backfillHubFromOutbox, fetchRemoteHubFollowers, repairFederatedHubPostActors } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireFeature('federateHubs');
  requireAuth(event);
  // TODO: admin role check — for now relies on admin layout auth

  const db = useDB();
  const config = useConfig();
  const { id } = parseParams(event, { id: 'uuid' });

  // Run all three operations
  const [backfillResult, followersResult, repaired] = await Promise.all([
    backfillHubFromOutbox(db, id, config.instance.domain).catch((err) => {
      console.error('[hub-backfill] Failed:', err);
      return { processed: 0, errors: 1 };
    }),
    fetchRemoteHubFollowers(db, id).catch((err) => {
      console.error('[hub-followers] Failed:', err);
      return { fetched: 0, errors: 1 };
    }),
    repairFederatedHubPostActors(db).catch(() => 0),
  ]);

  return {
    backfill: backfillResult,
    followers: followersResult,
    repairedActors: repaired,
  };
});
