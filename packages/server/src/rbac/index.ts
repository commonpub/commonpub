// Global RBAC (session 175). Pure resolution core; the cached Nitro wrapper +
// server gate live in layers/base/server/utils/. See docs/plans/rbac.md.
export { resolveUserPermissions } from './resolver.js';
export type { ResolvedPermissions } from './resolver.js';
export { seedRbac, SYSTEM_ROLE_SEEDS, STAFF_PERMISSION_SET } from './seed.js';
export type { SystemRoleSeed } from './seed.js';
export {
  listRolesWithPermissions,
  createRole,
  updateRole,
  deleteRole,
  setUserCustomRoles,
  getUserRoleIds,
} from './admin.js';
export type { RoleWithPermissions, CreateRoleInput, UpdateRoleInput, ActorGrants } from './admin.js';
