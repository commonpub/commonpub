import { listFederatedHubs } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireFeature('federateHubs');
  requirePermission(event, 'federation.manage');

  const db = useDB();
  return listFederatedHubs(db);
});
