import { getFederatedHub } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireFeature('federateHubs');

  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  const hub = await getFederatedHub(db, id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Federated hub not found' });
  }

  return hub;
});
