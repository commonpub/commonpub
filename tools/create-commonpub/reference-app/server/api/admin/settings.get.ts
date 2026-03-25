import { getInstanceSettings } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireAdmin(event);
  const db = useDB();
  return getInstanceSettings(db);
});
