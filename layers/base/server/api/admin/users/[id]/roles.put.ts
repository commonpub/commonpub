import { setUserCustomRoles } from '@commonpub/server';
import { setUserRolesSchema } from '@commonpub/schema';

// Replace a user's CUSTOM (non-system) role assignments. The system/primary role
// is managed separately via role.put.ts; system role IDs here are ignored.
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  requireFeature('admin');
  requirePermission(event, 'roles.manage');
  const db = useDB();
  const actor = requireAuth(event);
  const { id } = parseParams(event, { id: 'uuid' });
  const input = await parseBody(event, setUserRolesSchema);

  // RBAC-5 self-assignment guard (defense-in-depth): a non-admin may not change
  // their OWN custom-role set — closes the mint-then-self-assign escalation even
  // before the grant ceiling. Platform admins are exempt.
  if (id === actor.id && actor.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Cannot change your own role assignments' });
  }

  // RBAC-5 privilege ceiling: an actor may only assign a role whose grants they
  // themselves hold.
  const actorGrants = {
    permissions: event.context.cpubPermissions?.permissions ?? new Set<string>(),
    primaryRole: actor.role,
  };

  try {
    await setUserCustomRoles(db, id, input.roleIds, actor.id, actorGrants);
  } catch (err) {
    if (err instanceof Error && err.message === 'GRANT_EXCEEDS_CEILING') {
      throw createError({ statusCode: 403, statusMessage: 'Cannot assign a role granting a permission you do not hold' });
    }
    throw err;
  }
  invalidatePermissions(id);
  return { ok: true };
});
