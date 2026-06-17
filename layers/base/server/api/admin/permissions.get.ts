import { PERMISSIONS } from '@commonpub/schema';

// The grantable permission catalog — drives the role editor's checkbox list.
// `*` and `admin.access` are the admin bypass: they're reserved to the `admin`
// system role and stripped from every other role server-side (see
// rbac/admin.ts sanitizeGrants), so we don't offer them in the editor (a
// checkbox for them would silently never stick). Gated on `roles.manage`.
const ADMIN_BYPASS_GRANTS = new Set(['*', 'admin.access']);

export default defineEventHandler((event): string[] => {
  requireFeature('admin');
  requirePermission(event, 'roles.manage');
  return PERMISSIONS.filter((p) => !ADMIN_BYPASS_GRANTS.has(p));
});
