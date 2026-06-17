import { updateRole } from '@commonpub/server';
import { updateRoleSchema } from '@commonpub/schema';

// Edit a role's name/description/permissions (system roles included — e.g. tune
// the staff moderator set). The admin role always keeps its `*` bypass.
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  requireFeature('admin');
  requirePermission(event, 'roles.manage');
  const db = useDB();
  const actor = requireAuth(event);
  const { id } = parseParams(event, { id: 'uuid' });
  const input = await parseBody(event, updateRoleSchema);

  try {
    await updateRole(db, id, input, actor.id);
  } catch (err) {
    if (err instanceof Error && err.message === 'ROLE_NOT_FOUND') {
      throw createError({ statusCode: 404, statusMessage: 'Role not found' });
    }
    throw err;
  }
  invalidateAllPermissions();
  return { ok: true };
});
