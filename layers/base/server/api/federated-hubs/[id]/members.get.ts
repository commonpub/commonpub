import { getFederatedHub, listFederatedHubMembers } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireFeature('federateHubs');

  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  // Gate child content on parent-hub visibility (see posts.get.ts).
  const hub = await getFederatedHub(db, id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Federated hub not found' });
  }

  return listFederatedHubMembers(db, id);
});
