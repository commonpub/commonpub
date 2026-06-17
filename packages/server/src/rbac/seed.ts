import { eq, sql } from 'drizzle-orm';
import { roles, rolePermissions } from '@commonpub/schema';
import type { DB } from '../types.js';

/**
 * RBAC system-role seed (session 201, Phase 2). The machinery shipped in Phase 0/1
 * but the seed + backfill were never run, so the `roles`/`role_permissions`/
 * `user_roles` tables were empty — flipping `features.rbac` was a no-op. This seeds
 * the five system roles, their permission sets, and backfills `user_roles` from the
 * denormalized `users.role`.
 *
 * Mirrors the SQL appended to migration 0025 (the deploy path, run once via
 * db-migrate.mjs). This TS version is for fresh installs + PGlite tests. Both are
 * ADDITIVE / idempotent (`ON CONFLICT DO NOTHING`) so re-running never clobbers an
 * operator's later edits to a system role's permission set.
 */

/** The moderator capability set granted to `staff` (NOT `admin.access`). */
export const STAFF_PERMISSION_SET = [
  'content.read',
  'content.moderate',
  'content.editorial',
  'reports.review',
  'contest.create',
  'contest.manage',
  'event.create',
  'event.manage',
  'audit.read',
  'users.read',
] as const;

export interface SystemRoleSeed {
  key: string;
  name: string;
  description: string;
  priority: number;
  permissions: readonly string[];
}

/** The five system roles, priority mirrors the legacy roleGuard hierarchy. */
export const SYSTEM_ROLE_SEEDS: readonly SystemRoleSeed[] = [
  { key: 'member', name: 'Member', description: 'Default role for every registered user.', priority: 10, permissions: [] },
  { key: 'pro', name: 'Pro', description: 'Pro tier member.', priority: 20, permissions: [] },
  { key: 'verified', name: 'Verified', description: 'Verified member.', priority: 30, permissions: [] },
  {
    key: 'staff',
    name: 'Staff',
    description: 'Moderator: content moderation, contests, events, and reports. No admin panel access.',
    priority: 40,
    permissions: STAFF_PERMISSION_SET,
  },
  { key: 'admin', name: 'Admin', description: 'Full administrative access.', priority: 50, permissions: ['*'] },
];

/**
 * Idempotently seed the system roles + permissions and backfill `user_roles`.
 * Safe to run repeatedly; never deletes (so operator edits survive a redeploy).
 */
export async function seedRbac(db: DB): Promise<void> {
  for (const seed of SYSTEM_ROLE_SEEDS) {
    await db
      .insert(roles)
      .values({
        key: seed.key,
        name: seed.name,
        description: seed.description,
        isSystem: true,
        priority: seed.priority,
      })
      .onConflictDoNothing({ target: roles.key });

    const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, seed.key)).limit(1);
    if (!role || seed.permissions.length === 0) continue;

    await db
      .insert(rolePermissions)
      .values(seed.permissions.map((permissionKey) => ({ roleId: role.id, permissionKey })))
      .onConflictDoNothing();
  }

  // Backfill: every user gets the user_roles row matching their denormalized
  // users.role. New users are backfilled by updateUserRole / signup going forward.
  await db.execute(sql`
    INSERT INTO user_roles (user_id, role_id)
    SELECT u.id, r.id FROM users u JOIN roles r ON r.key = u.role::text
    ON CONFLICT DO NOTHING
  `);
}
