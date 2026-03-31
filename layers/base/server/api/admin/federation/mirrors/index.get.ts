import { listMirrors } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requireAdmin(event);
  const db = useDB();

  return listMirrors(db);
});
