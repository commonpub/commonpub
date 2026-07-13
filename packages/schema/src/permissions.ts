import { z } from 'zod';

/**
 * Global RBAC permission catalog — a CODE CONSTANT, not a table.
 *
 * Modeled exactly on `PUBLIC_API_SCOPES` (validators.ts) + `hasScope`
 * (packages/server/src/publicApi/scopes.ts). Permissions are capability-level
 * keys (one per coherent admin capability) and only change when code does, so
 * they need a compile-time type, not operator-editable data. ROLES are data
 * (see rbac.ts); the keys a role bundles are validated against THIS catalog on
 * write (like `filterKnownScopes`).
 *
 * Grant forms stored in `role_permissions.permissionKey`:
 *   - `*`                 — full wildcard (admin only)
 *   - an exact catalog key (e.g. `content.moderate`)
 *   - a segment wildcard `<prefix>.*` (e.g. `content.*`) where `<prefix>` is the
 *     first segment of at least one catalog key.
 *
 * Wildcard matching itself lives in the pure `hasPermissionPure`
 * (packages/auth/src/permissions.ts) — this module only defines + validates the
 * vocabulary.
 */
export const PERMISSIONS = [
  // Admin bypass — only ever granted to the `admin` role.
  '*',
  // Admin-only umbrella. `requireAdmin` is reimplemented as
  // `requirePermission(event, 'admin.access')`, so this key is the linchpin
  // routing all legacy admin gates through the new machinery.
  'admin.access',
  // Users
  'users.read',
  'users.manage',
  'users.delete',
  // Roles (RBAC self-administration — Phase 3 admin UI gates on this)
  'roles.manage',
  // Content + moderation
  'content.read',
  'content.moderate',
  'content.editorial',
  'reports.review',
  // Contests + events
  'contest.create',
  'contest.manage',
  // Read entrant PII (email/address/etc.) captured by contest submission forms.
  // Seeded to admin (via `*`) + staff; the entrant always reads their own. Named
  // `contest.pii` (one capability) to keep the catalog's single-dot convention.
  'contest.pii',
  'event.create',
  'event.manage',
  // Instance administration
  'settings.manage',
  'theme.manage',
  // Manage per-instance email branding/templates (email Phase 2).
  'email.manage',
  // Send admin broadcast emails to users (email Phase 3).
  'broadcast.send',
  'layout.manage',
  'navigation.manage',
  'search.manage',
  'apikeys.manage',
  'storage.manage',
  'categories.manage',
  'federation.manage',
  'audit.read',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

/**
 * Protected LEAF permissions: keys a SEGMENT wildcard (`<prefix>.*`) must NOT
 * satisfy. A role built with `contest.*` gains `contest.create`/`contest.manage`
 * but NOT `contest.pii` — the enforced entrant-PII boundary (RBAC-6). The full
 * wildcard `*`, the admin floor, and an EXACT `contest.pii` grant still satisfy
 * it (those precede the segment-wildcard branch in `hasPermissionPure`), so
 * admin (`*`) and staff (seeded `contest.pii` exactly) keep PII access; only the
 * wildcard shortcut is closed. See packages/auth/src/permissions.ts step 4.
 */
export const WILDCARD_PROTECTED_PERMISSIONS: ReadonlySet<string> = new Set(['contest.pii']);

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSIONS);

/** Valid first segments for `<prefix>.*` segment-wildcard grants. */
const PERMISSION_PREFIXES: ReadonlySet<string> = new Set(
  PERMISSIONS.filter((p) => p.includes('.')).map((p) => p.slice(0, p.indexOf('.'))),
);

/** True if `value` is an exact catalog key. */
export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_SET.has(value);
}

/**
 * True if `value` is a valid STORED grant: `*`, an exact catalog key, or a
 * recognized `<prefix>.*` segment wildcard. Used to validate
 * `role_permissions.permissionKey` on write (the catalog-as-gate), mirroring
 * `filterKnownScopes`.
 */
export function isPermissionGrant(value: string): boolean {
  if (value === '*') return true;
  if (isPermissionKey(value)) return true;
  if (value.endsWith('.*')) {
    return PERMISSION_PREFIXES.has(value.slice(0, -2));
  }
  return false;
}

/** Zod validator for a single stored grant (catalog-gated). */
export const permissionKeySchema = z
  .string()
  .refine(isPermissionGrant, { message: 'Unknown permission key' });

/**
 * Filter a stored grant array down to still-recognized grants. Defensive load
 * guard, exactly like `filterKnownScopes` — catches leftovers from a removed
 * catalog key or a typo that predates validation.
 */
export function filterKnownPermissions(grants: readonly string[]): string[] {
  return grants.filter((g) => isPermissionGrant(g));
}
