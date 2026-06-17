import { createRole } from '@commonpub/server';
import { createRoleSchema } from '@commonpub/schema';

// Create a custom role. Gated on `roles.manage`. New grants take effect on the
// next request (≤ cache TTL); invalidate the whole cache to be immediate.
export default defineEventHandler(async (event): Promise<{ id: string }> => {
  requireFeature('admin');
  requirePermission(event, 'roles.manage');
  const db = useDB();
  const actor = requireAuth(event);
  const input = await parseBody(event, createRoleSchema);

  let result;
  try {
    result = await createRole(db, input, actor.id);
  } catch (err) {
    if (err instanceof Error && err.message === 'ROLE_KEY_TAKEN') {
      throw createError({ statusCode: 409, statusMessage: 'A role with that key already exists' });
    }
    throw err;
  }
  invalidateAllPermissions();
  return result;
});
