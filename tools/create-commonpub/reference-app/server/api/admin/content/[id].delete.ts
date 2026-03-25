import { removeContent } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<void> => {
  requireFeature('admin');
  const admin = requireAdmin(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  return removeContent(db, id, admin.id);
});
