import { updateUserRole } from '@commonpub/server';
import { adminUpdateRoleSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<void> => {
  requireFeature('admin');
  const admin = requirePermission(event, 'users.manage');
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });
  const input = await parseBody(event, adminUpdateRoleSchema);

  // Minting an admin is admin-only: `users.manage` lets a custom role manage
  // non-admin users, but must not be a backdoor to creating admins (which would
  // turn `users.manage` into root). Promotion to the admin system role requires
  // the admin floor itself.
  if (input.role === 'admin') requirePermission(event, 'admin.access');

  try {
    await updateUserRole(db, id, input.role, admin.id);
  } catch (err) {
    if (err instanceof Error && err.message === 'LAST_ADMIN') {
      throw createError({ statusCode: 400, statusMessage: 'Cannot demote the only admin account' });
    }
    if (err instanceof Error && err.message === 'User not found') {
      throw createError({ statusCode: 404, statusMessage: 'User not found' });
    }
    throw err;
  }
  // The role change alters effective permissions — drop the cached set so the
  // next request resolves fresh (cache lives in the layer; commit happened above).
  invalidatePermissions(id);
});
