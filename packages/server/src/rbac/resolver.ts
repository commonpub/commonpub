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
 *   1. `primaryRole === 'admin'`  → empty grant set; never touches the RBAC
 *      tables. Admin access is NOT baked into the cached set as `*` — it rides
 *      entirely on the gate-time admin FLOOR over the fresh `users.role`
 *      (`hasPermissionPure(primaryRole)`). Caching `{'*'}` would let a demoted
 *      admin keep `*` for the 30s TTL even though enrichUser already reports the
 *      new role — a privilege-de-escalation lag that breaks INV-1 (pre-RBAC,
 *      requireAdmin read users.role fresh every request → demotion was
 *      immediate). Empty set + fresh-role floor keeps demotion immediate and
 *      makes INV-2 purely code-level.
 *   2. `rbacEnabled === false`    → empty set (admin access via the floor;
 *      everyone else denied) — byte-identical to pre-RBAC behavior (INV-1).
 *   3. otherwise → union of `user_roles → role_permissions`.
 *
 * Default-deny (INV-3): a missing user, an empty grant set, or ANY thrown error
 * yields an empty permission set. The admin floor is preserved because
 * `primaryRole` is read first (and the Nitro layer also has it from the enrich
 * query), so a `role_permissions` outage can never lock out admin (INV-2).
 *
 * `opts.primaryRole` lets the caller supply the already-enriched `users.role`
 * (the Nitro middleware has it from `enrichUser`). When given, the users query
 * is skipped entirely — so the admin and flag-off paths do ZERO extra DB work —
 * and resolution stays consistent with the enrich query. Omit it (direct
 * callers / tests) to have the resolver fetch the role itself.
 */
export async function resolveUserPermissions(
  db: DB,
  userId: string,
  opts: { rbacEnabled: boolean; primaryRole?: string },
): Promise<ResolvedPermissions> {
  try {
    let primaryRole = opts.primaryRole;
    if (primaryRole === undefined) {
      const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      // Unknown / remote user → no permissions (default-deny).
      if (!user) return EMPTY();
      primaryRole = user.role;
    }

    // 1. Admin → empty grant set; access rides on the gate-time floor over the
    //    fresh users.role, NOT a cached `*` (see header — INV-1/INV-2).
    if (primaryRole === 'admin') {
      return { primaryRole, roleKeys: ['admin'], permissions: new Set<string>() };
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
