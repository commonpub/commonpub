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

  // RBAC-5 privilege ceiling — an actor may only set grants they hold (the
  // admin `*` is force-retained, so a non-admin can never edit the admin role).
  const actorGrants = {
    permissions: event.context.cpubPermissions?.permissions ?? new Set<string>(),
    primaryRole: actor.role,
  };

  try {
    await updateRole(db, id, input, actor.id, actorGrants);
  } catch (err) {
    if (err instanceof Error && err.message === 'ROLE_NOT_FOUND') {
      throw createError({ statusCode: 404, statusMessage: 'Role not found' });
    }
    if (err instanceof Error && err.message === 'GRANT_EXCEEDS_CEILING') {
      throw createError({ statusCode: 403, statusMessage: 'Cannot grant a permission you do not hold' });
    }
    throw err;
  }
  invalidateAllPermissions();
  return { ok: true };
});
