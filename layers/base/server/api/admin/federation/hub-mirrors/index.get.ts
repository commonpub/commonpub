import { listFederatedHubs } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireFeature('federateHubs');
  requireAdmin(event);

  const db = useDB();
  return listFederatedHubs(db);
});
