import { PERMISSIONS } from '@commonpub/schema';

// The permission catalog (code constant) — drives the role editor's checkbox
// list. Gated on `roles.manage`.
export default defineEventHandler((event): readonly string[] => {
  requireFeature('admin');
  requirePermission(event, 'roles.manage');
  return PERMISSIONS;
});
