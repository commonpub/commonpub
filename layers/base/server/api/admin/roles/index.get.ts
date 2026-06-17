import { listRolesWithPermissions } from '@commonpub/server';
import type { RoleWithPermissions } from '@commonpub/server';

// List all roles with their permission keys + member counts. Gated on
// `roles.manage` (RBAC self-administration).
export default defineEventHandler(async (event): Promise<RoleWithPermissions[]> => {
  requireFeature('admin');
  requirePermission(event, 'roles.manage');
  return listRolesWithPermissions(useDB());
});
