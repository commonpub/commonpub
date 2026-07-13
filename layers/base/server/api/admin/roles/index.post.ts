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

  // RBAC-5 privilege ceiling: an actor may only grant permissions they hold.
  // `actor.role` is the authoritative enriched role (admin floor); a `*`/admin
  // actor clears the ceiling on everything.
  const actorGrants = {
    permissions: event.context.cpubPermissions?.permissions ?? new Set<string>(),
    primaryRole: actor.role,
  };

  let result;
  try {
    result = await createRole(db, input, actor.id, actorGrants);
  } catch (err) {
    if (err instanceof Error && err.message === 'ROLE_KEY_TAKEN') {
      throw createError({ statusCode: 409, statusMessage: 'A role with that key already exists' });
    }
    if (err instanceof Error && err.message === 'ROLE_KEY_RESERVED') {
      throw createError({ statusCode: 400, statusMessage: 'That key is reserved for a system role' });
    }
    if (err instanceof Error && err.message === 'GRANT_EXCEEDS_CEILING') {
      throw createError({ statusCode: 403, statusMessage: 'Cannot grant a permission you do not hold' });
    }
    throw err;
  }
  invalidateAllPermissions();
  return result;
});
