import { deleteRole } from '@commonpub/server';

// Delete a custom role (system roles are protected). Cascades its grants +
// user assignments via the FK.
export default defineEventHandler(async (event): Promise<{ deleted: true }> => {
  requireFeature('admin');
  requirePermission(event, 'roles.manage');
  const db = useDB();
  const actor = requireAuth(event);
  const { id } = parseParams(event, { id: 'uuid' });

  try {
    await deleteRole(db, id, actor.id);
  } catch (err) {
    if (err instanceof Error && err.message === 'ROLE_NOT_FOUND') {
      throw createError({ statusCode: 404, statusMessage: 'Role not found' });
    }
    if (err instanceof Error && err.message === 'ROLE_IS_SYSTEM') {
      throw createError({ statusCode: 400, statusMessage: 'System roles cannot be deleted' });
    }
    throw err;
  }
  invalidateAllPermissions();
  return { deleted: true };
});
