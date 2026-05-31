import { cancelMirror } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requirePermission(event, 'federation.manage');
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  await cancelMirror(db, id);
  return { success: true };
});
