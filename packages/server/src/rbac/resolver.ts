import { eq } from 'drizzle-orm';
import { users, userRoles, rolePermissions, roles } from '@commonpub/schema';
import type { DB } from '../types.js';

/**
 * Resolved permission snapshot for one user. `permissions` is the effective
 * grant set (may contain `*` or `<prefix>.*` wildcards); the admin floor lives
 * in `hasPermissionPure(primaryRole)`, not here, so even an empty set still
 * lets an admin through downstream.
 */
export interface ResolvedPermissions {
  /** Denormalized `users.role` — the system/display role + admin-floor input. */
  primaryRole: string;
  /** Role keys the user holds (system + custom). */
  roleKeys: string[];
  /** Effective permission grants (union across all the user's roles). */
  permissions: Set<string>;
}

const EMPTY = (primaryRole = ''): ResolvedPermissions => ({
  primaryRole,
  roleKeys: primaryRole ? [primaryRole] : [],
  permissions: new Set<string>(),
});

/**
 * Core permission resolution — pure DB read, no caching (the Nitro wrapper at
 * `layers/base/server/utils/permissions.ts` caches this). PGlite-testable.
 *
 * Resolution order (mirrors docs/plans/rbac.md):
 *   1. `primaryRole === 'admin'`  → ALL (`{'*'}`); never touches the RBAC tables.
 *   2. `rbacEnabled === false`    → legacy mapping (admin handled above ⇒
 *      everyone else gets an empty set) — byte-identical to pre-RBAC behavior
 *      (INV-1: only admins ever held admin.access).
 *   3. otherwise → union of `user_roles → role_permissions`.
 *
 * Default-deny (INV-3): a missing user, an empty grant set, or ANY thrown error
 * yields an empty permission set. The admin floor is preserved because
 * `primaryRole` is read first (and the Nitro layer also has it from the enrich
 * query), so a `role_permissions` outage can never lock out admin (INV-2).
 */
export async function resolveUserPermissions(
  db: DB,
  userId: string,
  opts: { rbacEnabled: boolean },
): Promise<ResolvedPermissions> {
  try {
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Unknown / remote user → no permissions (default-deny).
    if (!user) return EMPTY();

    const primaryRole = user.role;

    // 1. Admin floor — code-level ALL, independent of the tables.
    if (primaryRole === 'admin') {
      return { primaryRole, roleKeys: ['admin'], permissions: new Set(['*']) };
    }

    // 2. Flag off → legacy: non-admins hold nothing.
    if (!opts.rbacEnabled) return EMPTY(primaryRole);

    // 3. Flag on → union of grants across all assigned roles.
    const rows = await db
      .select({ key: roles.key, permissionKey: rolePermissions.permissionKey })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    const roleKeys = new Set<string>();
    const permissions = new Set<string>();
    for (const row of rows) {
      roleKeys.add(row.key);
      if (row.permissionKey) permissions.add(row.permissionKey);
    }

    // If the user has no user_roles rows yet (e.g. not backfilled), fall back to
    // the denormalized primary role for display — but grant nothing.
    return {
      primaryRole,
      roleKeys: roleKeys.size > 0 ? [...roleKeys] : [primaryRole],
      permissions,
    };
  } catch {
    // Any DB error → default-deny. Admin floor still applies downstream via the
    // primaryRole the enrich query already supplied (INV-2).
    return EMPTY();
  }
}
