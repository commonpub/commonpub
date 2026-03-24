import { updateUserStatus } from '@commonpub/server';
import { adminUpdateStatusSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<void> => {
  requireFeature('admin');
  const admin = requireAdmin(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });
  const input = await parseBody(event, adminUpdateStatusSchema);

  return updateUserStatus(db, id, input.status, admin.id);
});
