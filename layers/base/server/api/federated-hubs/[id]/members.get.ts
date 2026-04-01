import { listFederatedHubMembers } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireFeature('federateHubs');

  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  return listFederatedHubMembers(db, id);
});
