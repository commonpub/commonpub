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

  await setUserCustomRoles(db, id, input.roleIds, actor.id);
  invalidatePermissions(id);
  return { ok: true };
});
