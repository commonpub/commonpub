import { updateUserRole } from '@commonpub/server';
import { adminUpdateRoleSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<void> => {
  requireFeature('admin');
  const admin = requireAdmin(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });
  const input = await parseBody(event, adminUpdateRoleSchema);

  return updateUserRole(db, id, input.role, admin.id);
});
