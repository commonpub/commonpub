import { listMirrors } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requirePermission(event, 'federation.manage');
  const db = useDB();

  return listMirrors(db);
});
