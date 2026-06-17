import { getUserRoleIds } from '@commonpub/server';

// The role IDs a user currently holds (system + custom) — for the admin UI's
// role assignment checkboxes.
export default defineEventHandler(async (event): Promise<{ roleIds: string[] }> => {
  requireFeature('admin');
  requirePermission(event, 'roles.manage');
  const { id } = parseParams(event, { id: 'uuid' });
  return { roleIds: await getUserRoleIds(useDB(), id) };
});
